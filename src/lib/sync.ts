/** 多人联机同步层（3.0 安全版）：Cloudflare Worker 后端 + 轮询
 *
 * 与旧版（公共 MQTT）的区别：
 *  - 数据唯一权威在服务端，时间戳以服务器时钟为准，客户端时钟造假无效
 *  - 写操作携带身份（昵称 + 设备指纹），服务端做合理性校验 / 限频 / 封禁
 *  - 前端本地乐观更新保证手感，下一次轮询以服务端数据为准收敛
 *
 * 数据仍为"键值 + 时间戳"结构：r 为击杀记录，d 为删除墓碑。
 */
import { toast } from 'sonner'
import { apiFetch, getAdminKey, opErrorMessage } from './api'
import { getIdentity } from './identity'

export interface SyncDoc {
  /** key -> 击杀时间戳 */
  r: Record<string, number>
  /** key -> 删除（墓碑）时间戳 */
  d: Record<string, number>
}

export type SyncStatus = 'connecting' | 'online' | 'offline'

/** 需要用户先设置昵称时的通知（由页面层弹出昵称对话框） */
const identityListeners = new Set<() => void>()
export function onIdentityNeeded(cb: () => void): () => void {
  identityListeners.add(cb)
  return () => identityListeners.delete(cb)
}
function requestIdentity() {
  identityListeners.forEach((f) => f())
}

/** 文档 -> 界面可见的记录表 */
export function visibleRecords(doc: SyncDoc): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(doc.r)) {
    if (!doc.d[k] || doc.d[k] < v) out[k] = v
  }
  return out
}

type Op =
  | { op: 'kill'; bossId: string; line: number }
  | { op: 'clear'; bossId: string; line: number }
  | { op: 'clearBoss'; bossId: string }
  | { op: 'clearAll' }

export interface SyncClient {
  getDoc: () => SyncDoc
  kill: (bossId: string, line: number) => void
  clear: (bossId: string, line: number) => void
  clearBoss: (bossId: string) => void
  clearAll: () => void
  onUpdate: (cb: (doc: SyncDoc) => void) => void
  onStatus: (cb: (s: SyncStatus) => void) => void
  close: () => void
}

const POLL_INTERVAL = 5000

export function createSyncClient(initialDoc: SyncDoc, serverId: string): SyncClient {
  let doc = initialDoc
  let updateCb: (doc: SyncDoc) => void = () => {}
  let statusCb: (s: SyncStatus) => void = () => {}
  let closed = false
  let timer: ReturnType<typeof setInterval> | null = null

  const emit = () => updateCb(doc)

  async function pull() {
    if (closed) return
    try {
      const data = await apiFetch<{ doc: SyncDoc; now: number }>(`/api/state/${serverId}`)
      if (closed) return
      // 服务端是唯一权威，直接采用（乐观更新的本地变更已被服务端吸收或拒绝，
      // 被拒绝的会在下一轮 pull 时被服务端数据纠正回来）
      doc = data.doc
      emit()
      statusCb('online')
    } catch {
      if (!closed) statusCb('offline')
    }
  }

  function applyLocal(o: Op) {
    const now = Date.now()
    if (o.op === 'kill') {
      const key = `${o.bossId}:${o.line}`
      doc.r[key] = now
      delete doc.d[key]
    } else if (o.op === 'clear') {
      const key = `${o.bossId}:${o.line}`
      delete doc.r[key]
      doc.d[key] = now
    } else if (o.op === 'clearBoss') {
      for (const key of Object.keys(doc.r)) {
        if (key.startsWith(`${o.bossId}:`)) {
          delete doc.r[key]
          doc.d[key] = now
        }
      }
    } else {
      for (const key of Object.keys(doc.r)) {
        delete doc.r[key]
        doc.d[key] = now
      }
    }
  }

  async function send(o: Op) {
    const identity = await getIdentity()
    if (!identity) {
      requestIdentity()
      toast.info('先设置一个昵称才能记录击杀')
      return
    }
    // 乐观更新：先让界面动起来
    applyLocal(o)
    emit()
    try {
      await apiFetch('/api/op', {
        method: 'POST',
        body: { server: serverId, ...o, user: identity },
        admin: !!getAdminKey(),
      })
      // 立刻拉一次，让本地时间戳收敛为服务端时间戳
      void pull()
    } catch (e) {
      toast.error(opErrorMessage(e))
      // 操作被拒绝：用服务端数据覆盖刚才的乐观更新
      void pull()
    }
  }

  statusCb('connecting')
  void pull()
  timer = setInterval(pull, POLL_INTERVAL)
  const onVisible = () => {
    if (document.visibilityState === 'visible') void pull()
  }
  document.addEventListener('visibilitychange', onVisible)

  return {
    getDoc: () => doc,
    kill: (bossId, line) => void send({ op: 'kill', bossId, line }),
    clear: (bossId, line) => void send({ op: 'clear', bossId, line }),
    clearBoss: (bossId) => void send({ op: 'clearBoss', bossId }),
    clearAll: () => void send({ op: 'clearAll' }),
    onUpdate: (cb) => {
      updateCb = cb
    },
    onStatus: (cb) => {
      statusCb = cb
    },
    close: () => {
      closed = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    },
  }
}
