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
  /** 该设备 1 小时内已累计的异常操作次数 */
  violations?: number
  /** 触发自动封禁所需次数 */
  limit?: number
  /** 是否刚触发自动封禁 */
  autoBanned?: boolean
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

/** 误封申诉渠道提示 */
const APPEAL_HINT = '如认为误封，请联系管理员（抖音：芬达）核实处理'

/** 违规次数预警（有计数时才附加） */
function violationHint(d: ApiError): string {
  if (typeof d.violations !== 'number') return ''
  const limit = d.limit ?? 10
  if (d.autoBanned) return `\n已触发自动封禁：1 小时内异常操作满 ${limit} 次，设备被封禁 24 小时，异常数据已被系统自动还原`
  return `\n注意：你 1 小时内已有 ${d.violations} 次异常操作，累计 ${limit} 次将自动封禁 24 小时并还原异常数据`
}

/** 把后端错误码翻译成给人看的提示 */
export function opErrorMessage(e: unknown): string {
  const d = (e as { detail?: ApiError })?.detail
  switch (d?.error) {
    case 'banned':
      return `你已被限制操作${d.reason ? `：${d.reason}` : ''}${
        d.until ? `（至 ${new Date(d.until).toLocaleString()}）` : ''
      }\n${APPEAL_HINT}`
    case 'rate_limited':
      return `操作太频繁了，请稍等一分钟再试${violationHint(d)}`
    case 'too_early':
      return `该 Boss 距离上次击杀不足刷新周期，约还需 ${d.waitMin ?? '?'} 分钟${violationHint(d)}`
    case 'admin_only':
      return '此操作仅限管理员'
    default:
      return '同步失败，请检查网络后重试'
  }
}
