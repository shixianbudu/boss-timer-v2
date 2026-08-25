/** 用户身份：昵称 + 持久 ID + 浏览器指纹
 *
 * - id：首次访问生成的随机 ID，存 localStorage（换设备/清缓存会变）
 * - name：用户自填昵称，随操作一起上报，公开可见
 * - fp：由浏览器特征计算的指纹哈希，清缓存也难以改变，是封禁的主要依据
 */

export interface Identity {
  id: string
  name: string
  fp: string
}

const UID_KEY = 'bt-uid'
const NAME_KEY = 'bt-name'

export function getUid(): string {
  let id = localStorage.getItem(UID_KEY)
  if (!id) {
    id = 'u-' + crypto.randomUUID().replaceAll('-', '').slice(0, 16)
    localStorage.setItem(UID_KEY, id)
  }
  return id
}

export function getNickname(): string | null {
  const n = localStorage.getItem(NAME_KEY)
  return n && n.trim() ? n.trim() : null
}

export function setNickname(name: string) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 24))
}

/** 计算浏览器指纹（SHA-256），结果会话级缓存 */
let fpPromise: Promise<string> | null = null

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function canvasSig(): string {
  try {
    const c = document.createElement('canvas')
    c.width = 200
    c.height = 40
    const ctx = c.getContext('2d')
    if (!ctx) return 'noctx'
    ctx.textBaseline = 'top'
    ctx.font = "14px 'Arial'"
    ctx.fillStyle = '#f60'
    ctx.fillRect(10, 10, 80, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('boss-timer⚔️fp', 12, 14)
    return c.toDataURL().slice(-128)
  } catch {
    return 'err'
  }
}

export function getFingerprint(): Promise<string> {
  if (!fpPromise) {
    const parts = [
      navigator.userAgent,
      navigator.language,
      navigator.platform ?? '',
      String(navigator.hardwareConcurrency ?? ''),
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
      String(new Date().getTimezoneOffset()),
      canvasSig(),
    ]
    fpPromise = sha256Hex(parts.join('|')).catch(() => 'fp-unavailable')
  }
  return fpPromise
}

/** 昵称未设置时返回 null（调用方应弹出设置昵称对话框） */
export async function getIdentity(): Promise<Identity | null> {
  const name = getNickname()
  if (!name) return null
  return { id: getUid(), name, fp: await getFingerprint() }
}
