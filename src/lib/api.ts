/** 后端 API 访问层
 *
 * API 地址优先级：
 *  1. localStorage `bt-api-base`（调试/临时切换用，在控制台设置即可）
 *  2. 构建期环境变量 VITE_API_BASE
 *  3. 下方 DEFAULT_API_BASE —— 部署 Worker 后把它改成你的 Worker 地址
 */

// 自定义域名（workers.dev 在国内被 DNS 污染，改走自有域名）
const DEFAULT_API_BASE = 'https://douyinfenda.top'

export const API_BASE: string =
  (typeof localStorage !== 'undefined' && localStorage.getItem('bt-api-base')) ||
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  DEFAULT_API_BASE

export const ADMIN_KEY_STORAGE = 'bt-admin-key'

export const getAdminKey = () => localStorage.getItem(ADMIN_KEY_STORAGE) ?? ''
export const setAdminKey = (k: string) =>
  k ? localStorage.setItem(ADMIN_KEY_STORAGE, k) : localStorage.removeItem(ADMIN_KEY_STORAGE)

export interface ApiError {
  error: string
  reason?: string
  waitMin?: number
  until?: number | null
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; admin?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.admin) headers['x-admin-key'] = getAdminKey()

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as T & ApiError
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `http_${res.status}`), { detail: data })
  }
  return data
}

/** 把后端错误码翻译成给人看的提示 */
export function opErrorMessage(e: unknown): string {
  const d = (e as { detail?: ApiError })?.detail
  switch (d?.error) {
    case 'banned':
      return `你已被限制操作${d.reason ? `：${d.reason}` : ''}${
        d.until ? `（至 ${new Date(d.until).toLocaleString()}）` : ''
      }`
    case 'rate_limited':
      return '操作太频繁了，请稍等一分钟再试'
    case 'too_early':
      return `该 Boss 距离上次击杀不足刷新周期，约还需 ${d.waitMin ?? '?'} 分钟`
    case 'admin_only':
      return '此操作仅限管理员'
    default:
      return '同步失败，请检查网络后重试'
  }
}
