/**
 * Boss Timer 后端守门人（Cloudflare Workers + KV）— 网页编辑器专用纯 JS 版
 * （与 worker/src/index.ts 逻辑一致，去掉了 TypeScript 类型标注）
 *
 * 职责：
 *  - 唯一权威数据源：击杀记录只由本 Worker 写入，时间戳以服务器时钟为准
 *  - 合理性校验：Boss 未到刷新周期时的重复击杀上报需用户确认（force）
 *  - 频率限制：同一身份单位时间内操作数有限（管理员不受限）
 *  - 违规检测：被拒绝的异常操作累计到一定次数自动封禁 24 小时
 *  - 自动还原：封禁（含管理员手动封禁）时，还原该设备在本区服的全部操作记录；他人后来的操作不受影响
 *  - 操作日志：所有操作（含被拒绝的）公开可查，人人可见即威慑
 *  - 管理接口：封禁 / 解封 / 撤销某次操作（需要管理员密钥）
 */

/* ---------------- 与前端保持一致的 Boss 配置（校验用） ---------------- */

const BOSSES = {
  'snail-king': { name: '蜗牛王', respawnMinutes: 45, lines: 60 },
  'tree-spirit-king': { name: '树妖王', respawnMinutes: 45, lines: 60 },
  'giant-crab': { name: '巨居蟹', respawnMinutes: 20, lines: 60 },
  'mushroom-king': { name: '蘑菇王', respawnMinutes: 30, lines: 60 },
  'zombie-mushroom-king': { name: '僵尸蘑菇王', respawnMinutes: 30, lines: 60 },
  faust: { name: '浮士德', respawnMinutes: 30, lines: 60 },
  doll: { name: '多尔', respawnMinutes: 45, lines: 60 },
  balrog: { name: '蝙蝠怪', respawnMinutes: 180, lines: 60 },
}

/* ---------------- 常量 ---------------- */

/** 每个身份 60 秒内允许的操作数（超过即视为异常） */
const RATE_LIMIT_PER_MIN = 3
/** 每个 IP 60 秒内允许的操作数（防换身份刷接口） */
const RATE_LIMIT_IP_PER_MIN = 60
/** 提前刷新的容忍：刷新周期 - 此值 之后才允许再次记录击杀 */
const RESPAWN_TOLERANCE_MS = 3 * 60 * 1000
/** 1 小时内异常操作达到此次数 → 自动封禁 24 小时 */
const AUTO_BAN_VIOLATIONS = 10
const AUTO_BAN_MS = 24 * 3600 * 1000
/** 每个区服保留的日志条数 */
const MAX_LOGS = 300

/* ---------------- 工具 ---------------- */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  })
}

const fail = (error, status = 400, extra) =>
  json({ ok: false, error, ...extra }, status)

function isAdmin(req, env) {
  if (!env.ADMIN_KEY) return false
  return req.headers.get('x-admin-key') === env.ADMIN_KEY
}

function validServerId(s) {
  return typeof s === 'string' && /^[a-z0-9-]{1,32}$/.test(s)
}

function validIdentity(u) {
  if (!u || typeof u !== 'object') return false
  return (
    typeof u.id === 'string' && u.id.length >= 8 && u.id.length <= 64 &&
    typeof u.name === 'string' && u.name.trim().length >= 1 && u.name.length <= 24 &&
    typeof u.fp === 'string' && u.fp.length >= 8 && u.fp.length <= 128
  )
}

const recordKey = (bossId, line) => `${bossId}:${line}`

async function loadDoc(kv, server) {
  const doc = await kv.get(`state:${server}`, 'json')
  if (doc && typeof doc.r === 'object' && typeof doc.d === 'object') return doc
  return { r: {}, d: {} }
}

async function loadBans(kv) {
  const b = await kv.get('bans', 'json')
  if (b && typeof b.fp === 'object' && typeof b.uid === 'object') return b
  return { fp: {}, uid: {} }
}

/** 返回命中的封禁条目；过期条目跳过 */
function checkBan(bans, user) {
  const now = Date.now()
  for (const e of [bans.fp[user.fp], bans.uid[user.id]]) {
    if (!e) continue
    if (e.until && e.until <= now) continue
    return e
  }
  return null
}

/** 简单滑动窗口限频：窗口内操作数超限返回 true */
async function rateLimited(kv, key, limit) {
  const now = Date.now()
  const winStart = now - 60_000
  const arr = (await kv.get(key, 'json')) ?? []
  const recent = arr.filter((t) => t > winStart)
  recent.push(now)
  await kv.put(key, JSON.stringify(recent), { expirationTtl: 120 })
  return recent.length > limit
}

async function addViolation(kv, fp) {
  const key = `viol:${fp}`
  const n = ((await kv.get(key, 'json')) ?? 0) + 1
  await kv.put(key, JSON.stringify(n), { expirationTtl: 3600 })
  return n
}

async function appendLog(kv, server, entry) {
  const key = `logs:${server}`
  const logs = (await kv.get(key, 'json')) ?? []
  logs.unshift(entry)
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
  await kv.put(key, JSON.stringify(logs))
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** 对某身份执行自动封禁（返回是否触发了新封禁） */
async function maybeAutoBan(kv, user, violations) {
  if (violations < AUTO_BAN_VIOLATIONS) return false
  const bans = await loadBans(kv)
  if (checkBan(bans, user)) return false
  bans.fp[user.fp] = {
    name: user.name,
    reason: `系统自动：1 小时内异常操作 ${violations} 次`,
    at: Date.now(),
    until: Date.now() + AUTO_BAN_MS,
    auto: true,
  }
  await kv.put('bans', JSON.stringify(bans))
  return true
}

/**
 * 还原某设备在本区服的全部操作记录（封禁时调用）
 * 范围：操作日志中该设备指纹的所有成功操作（击杀 / 清除 / 批量清除，不限时间）
 * 规则：按时间倒序还原为操作前的旧值；若之后已被他人动过则跳过，
 *       因此未被封禁的人后来点击的记录不受影响
 */
async function autoRestoreAbnormal(kv, server, fp, name) {
  const now = Date.now()
  const logs = (await kv.get(`logs:${server}`, 'json')) ?? []
  const targets = logs.filter((l) => l.ok && l.user.fp === fp && l.prev)
  if (targets.length === 0) return 0

  const doc = await loadDoc(kv, server)
  let restored = 0
  // logs 新条目在前，本身即按时间倒序
  for (const entry of targets) {
    for (const [key, oldVal] of Object.entries(entry.prev)) {
      if (entry.op === 'kill') {
        // kill 写入的是击杀时间戳：当前值仍是该次操作写入的，才还原
        if (doc.r[key] !== entry.at) continue
      } else {
        // clear / clearBoss / clearAll 写入的是墓碑：墓碑仍是该次操作写入的，才还原
        if (key in doc.r || doc.d[key] !== entry.at) continue
      }
      if (oldVal === null) {
        delete doc.r[key]
        doc.d[key] = now
      } else {
        doc.r[key] = oldVal
        delete doc.d[key]
      }
      restored++
    }
  }
  if (restored > 0) await kv.put(`state:${server}`, JSON.stringify(doc))
  await appendLog(kv, server, {
    id: newId(), at: now,
    user: { id: 'system', name: '系统', fp: 'system' },
    op: 'auto_restore', ok: true,
    target: name,
    detail: `已封禁该设备并还原其全部操作记录（共 ${restored} 条），其他玩家的记录不受影响`,
  })
  return restored
}

/* ---------------- 操作处理 ---------------- */

async function handleOp(req, env) {
  let body
  try {
    body = await req.json()
  } catch {
    return fail('bad_json')
  }

  const { server, op } = body
  if (!validServerId(server)) return fail('bad_server')
  if (!['kill', 'clear', 'clearBoss', 'clearAll'].includes(op)) return fail('bad_op')
  if (!validIdentity(body.user)) return fail('bad_identity')
  const user = {
    id: body.user.id,
    name: body.user.name.trim().slice(0, 24),
    fp: body.user.fp,
  }

  const kv = env.KV

  // 0) 管理员：密钥正确即信任，跳过封禁检查、限频与违规计数
  const admin = isAdmin(req, env)

  // 1) 封禁检查（管理员不受限）
  const bans = await loadBans(kv)
  const banned = admin ? null : checkBan(bans, user)
  if (banned) {
    await appendLog(kv, server, {
      id: newId(), at: Date.now(), user, op, ok: false,
      reason: '已被封禁的操作被拒绝',
    })
    return fail('banned', 403, { reason: banned.reason, until: banned.until ?? null })
  }

  // 2) 限频（身份 + IP 双维度，管理员不受限）
  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (!admin && (await rateLimited(kv, `rl:u:${user.fp}`, RATE_LIMIT_PER_MIN))) {
    const v = await addViolation(kv, user.fp)
    const autoBanned = await maybeAutoBan(kv, user, v)
    if (autoBanned) await autoRestoreAbnormal(kv, server, user.fp, user.name)
    await appendLog(kv, server, {
      id: newId(), at: Date.now(), user, op, ok: false, reason: '操作过于频繁',
    })
    return fail('rate_limited', 429, { violations: v, limit: AUTO_BAN_VIOLATIONS })
  }
  if (!admin && (await rateLimited(kv, `rl:ip:${ip}`, RATE_LIMIT_IP_PER_MIN))) {
    return fail('rate_limited', 429)
  }

  // 3) clearAll 仅限管理员（杀伤力太大）
  if (op === 'clearAll' && !admin) {
    await appendLog(kv, server, {
      id: newId(), at: Date.now(), user, op, ok: false, reason: '全部清空仅限管理员',
    })
    return fail('admin_only', 403)
  }

  const doc = await loadDoc(kv, server)
  const now = Date.now()
  const prev = {}
  let target = ''
  let detail = ''

  // 4) 按操作类型校验并落库
  if (op === 'kill') {
    const boss = body.bossId ? BOSSES[body.bossId] : undefined
    const line = body.line
    if (!boss || typeof line !== 'number' || !Number.isInteger(line) || line < 1 || line > boss.lines) {
      return fail('bad_target')
    }
    const key = recordKey(body.bossId, line)
    target = `${boss.name} ${line}线`
    const existing = doc.r[key]
    // 合理性：距离上次击杀不足（刷新周期 - 容忍值）时
    if (existing && now - existing < boss.respawnMinutes * 60_000 - RESPAWN_TOLERANCE_MS) {
      if (body.force === true) {
        // 用户已在前端确认强制重置：放行，但记一次违规（累计过多照样自动封禁）
        const v = admin ? undefined : await addViolation(kv, user.fp)
        const autoBanned = v !== undefined && (await maybeAutoBan(kv, user, v))
        detail = `强制重置（距上次击杀不足刷新周期，用户已确认）${autoBanned ? '；已触发自动封禁并自动还原异常操作' : ''}`
        if (autoBanned) {
          // 先落库本次操作，再还原历史异常操作（本次是用户确认过的，不还原）
          prev[key] = existing ?? null
          doc.r[key] = now
          delete doc.d[key]
          await kv.put(`state:${server}`, JSON.stringify(doc))
          const entry = {
            id: newId(), at: now, user, op, target, detail, ok: true, prev,
          }
          await appendLog(kv, server, entry)
          await autoRestoreAbnormal(kv, server, user.fp, user.name)
          return json({ ok: true, at: now, logId: entry.id, autoBanned: true, violations: v, limit: AUTO_BAN_VIOLATIONS })
        }
      } else {
        const v = admin ? undefined : await addViolation(kv, user.fp)
        const autoBanned = v !== undefined && (await maybeAutoBan(kv, user, v))
        const waitMin = Math.ceil((boss.respawnMinutes * 60_000 - (now - existing)) / 60_000)
        await appendLog(kv, server, {
          id: newId(), at: now, user, op, target, ok: false,
          reason: `距离上次击杀不足刷新周期（约还需 ${waitMin} 分钟）`,
        })
        if (autoBanned) await autoRestoreAbnormal(kv, server, user.fp, user.name)
        return fail('too_early', 409, {
          waitMin, autoBanned, violations: v, limit: AUTO_BAN_VIOLATIONS,
        })
      }
    }
    prev[key] = existing ?? null
    doc.r[key] = now // 时间戳以服务器时钟为准，不信客户端
    delete doc.d[key]
  } else if (op === 'clear') {
    const boss = body.bossId ? BOSSES[body.bossId] : undefined
    const line = body.line
    if (!boss || typeof line !== 'number' || !Number.isInteger(line) || line < 1 || line > boss.lines) {
      return fail('bad_target')
    }
    const key = recordKey(body.bossId, line)
    target = `${boss.name} ${line}线`
    prev[key] = doc.r[key] ?? null
    delete doc.r[key]
    doc.d[key] = now
  } else if (op === 'clearBoss') {
    const boss = body.bossId ? BOSSES[body.bossId] : undefined
    if (!boss) return fail('bad_target')
    target = `${boss.name}（全部线路）`
    let n = 0
    for (const key of Object.keys(doc.r)) {
      if (key.startsWith(`${body.bossId}:`)) {
        prev[key] = doc.r[key]
        delete doc.r[key]
        doc.d[key] = now
        n++
      }
    }
    detail = `清除 ${n} 条记录`
  } else {
    // clearAll（仅管理员能走到这里）
    target = '全部 Boss'
    let n = 0
    for (const key of Object.keys(doc.r)) {
      prev[key] = doc.r[key]
      delete doc.r[key]
      doc.d[key] = now
      n++
    }
    detail = `清除 ${n} 条记录`
  }

  await kv.put(`state:${server}`, JSON.stringify(doc))
  const entry = {
    id: newId(), at: now, user, op, target, detail: detail || undefined, ok: true, prev,
  }
  await appendLog(kv, server, entry)
  return json({ ok: true, at: now, logId: entry.id })
}

/* ---------------- 撤销 ---------------- */

async function handleUndo(req, env) {
  if (!isAdmin(req, env)) return fail('admin_only', 403)
  let body
  try {
    body = await req.json()
  } catch {
    return fail('bad_json')
  }
  if (!validServerId(body.server) || typeof body.logId !== 'string') return fail('bad_request')

  const kv = env.KV
  const logsKey = `logs:${body.server}`
  const logs = (await kv.get(logsKey, 'json')) ?? []
  const entry = logs.find((l) => l.id === body.logId)
  if (!entry || !entry.ok || !entry.prev) return fail('log_not_found', 404)

  const doc = await loadDoc(kv, body.server)
  const now = Date.now()
  for (const [key, oldVal] of Object.entries(entry.prev)) {
    if (oldVal === null) {
      // 操作前不存在 → 撤销即删除
      delete doc.r[key]
      doc.d[key] = now
    } else {
      doc.r[key] = oldVal
      delete doc.d[key]
    }
  }
  await kv.put(`state:${body.server}`, JSON.stringify(doc))

  const undoBy = validIdentity(body.user) ? body.user.name : '管理员'
  await appendLog(kv, body.server, {
    id: newId(), at: now,
    user: validIdentity(body.user) ? body.user : { id: 'admin', name: '管理员', fp: 'admin' },
    op: 'undo', ok: true,
    target: entry.target,
    detail: `撤销了 ${entry.user.name} 的「${entry.op}」操作（by ${undoBy}）`,
  })
  return json({ ok: true })
}

/* ---------------- 封禁管理 ---------------- */

async function handleBan(req, env) {
  if (!isAdmin(req, env)) return fail('admin_only', 403)
  const body = await req.json().catch(() => ({}))
  if (!body.fp && !body.uid) return fail('bad_request')
  const bans = await loadBans(env.KV)
  const entry = {
    name: body.name,
    reason: body.reason || '管理员手动封禁',
    at: Date.now(),
  }
  if (body.hours && body.hours > 0) entry.until = Date.now() + body.hours * 3600 * 1000
  if (body.fp) bans.fp[body.fp] = entry
  if (body.uid) bans.uid[body.uid] = entry
  await env.KV.put('bans', JSON.stringify(bans))
  // 手动封禁同样还原该设备在本区服的全部操作记录
  let restored = 0
  if (body.fp && validServerId(body.server)) {
    restored = await autoRestoreAbnormal(env.KV, body.server, body.fp, body.name ?? '')
  }
  return json({ ok: true, restored })
}

async function handleUnban(req, env) {
  if (!isAdmin(req, env)) return fail('admin_only', 403)
  const body = await req.json().catch(() => ({}))
  const bans = await loadBans(env.KV)
  if (body.fp) delete bans.fp[body.fp]
  if (body.uid) delete bans.uid[body.uid]
  await env.KV.put('bans', JSON.stringify(bans))
  return json({ ok: true })
}

/* ---------------- 路由 ---------------- */

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(req.url)
    const p = url.pathname

    // 健康检查
    if (p === '/api/health') return json({ ok: true, now: Date.now() })

    // 公开读：当前状态
    const stateMatch = p.match(/^\/api\/state\/([a-z0-9-]+)$/)
    if (stateMatch && req.method === 'GET') {
      const doc = await loadDoc(env.KV, stateMatch[1])
      return json({ ok: true, doc, now: Date.now() })
    }

    // 公开读：操作日志（透明即威慑，所有人可见谁在乱来）
    const logsMatch = p.match(/^\/api\/logs\/([a-z0-9-]+)$/)
    if (logsMatch && req.method === 'GET') {
      const logs = (await env.KV.get(`logs:${logsMatch[1]}`, 'json')) ?? []
      return json({ ok: true, logs: logs.slice(0, 100) })
    }

    // 写操作
    if (p === '/api/op' && req.method === 'POST') return handleOp(req, env)

    // 管理接口
    if (p === '/api/admin/undo' && req.method === 'POST') return handleUndo(req, env)
    if (p === '/api/admin/ban' && req.method === 'POST') return handleBan(req, env)
    if (p === '/api/admin/unban' && req.method === 'POST') return handleUnban(req, env)
    if (p === '/api/admin/bans' && req.method === 'GET') {
      if (!isAdmin(req, env)) return fail('admin_only', 403)
      return json({ ok: true, bans: await loadBans(env.KV), now: Date.now() })
    }

    return fail('not_found', 404)
  },
}
