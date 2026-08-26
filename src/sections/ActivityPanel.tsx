/** 操作动态面板：公开的操作日志，谁在乱来一目了然
 * 管理员模式下可对每条日志执行「撤销」「封禁」。
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch, getAdminKey } from '@/lib/api'
import { getIdentity } from '@/lib/identity'
import { formatClock } from '@/lib/bosses'

interface LogEntry {
  id: string
  at: number
  user: { id: string; name: string; fp: string }
  op: string
  target?: string
  detail?: string
  ok: boolean
  reason?: string
}

const OP_LABEL: Record<string, string> = {
  kill: '记录击杀',
  clear: '清除记录',
  clearBoss: '清除整只 Boss',
  clearAll: '全部清空',
  undo: '撤销操作',
  auto_restore: '系统自动还原',
}

export default function ActivityPanel({ serverId, active }: { serverId: string; active: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const isAdmin = !!getAdminKey()

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ logs: LogEntry[] }>(`/api/logs/${serverId}`)
      setLogs(data.logs)
    } catch {
      // 静默失败，下轮再试
    } finally {
      setLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    if (!active) return
    void load()
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [active, load])

  const undo = async (logId: string) => {
    try {
      const user = await getIdentity()
      await apiFetch('/api/admin/undo', {
        method: 'POST',
        body: { server: serverId, logId, user },
        admin: true,
      })
      toast.success('已撤销该操作')
      void load()
    } catch {
      toast.error('撤销失败：密钥无效或网络异常')
    }
  }

  const ban = async (entry: LogEntry) => {
    const reason = window.prompt(`封禁「${entry.user.name}」的原因：`, '恶意乱点') ?? ''
    if (!window.confirm(`确定封禁「${entry.user.name}」吗？\n封禁后该设备将无法再提交任何操作。`)) return
    try {
      await apiFetch('/api/admin/ban', {
        method: 'POST',
        body: { fp: entry.user.fp, uid: entry.user.id, name: entry.user.name, reason },
        admin: true,
      })
      toast.success(`已封禁 ${entry.user.name}`)
    } catch {
      toast.error('封禁失败：密钥无效或网络异常')
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-neutral-500">加载中…</div>

  if (logs.length === 0)
    return <div className="py-10 text-center text-sm text-neutral-500">暂无操作记录</div>

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <div className="border-b border-neutral-800 bg-neutral-900/70 px-3 py-2 text-xs text-neutral-400">
        所有操作公开可见 · 被拒绝的异常操作以红色标出 · 数据保留最近 100 条
      </div>
      <ul className="divide-y divide-neutral-800/70">
        {logs.map((l) => (
          <li
            key={l.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm ${
              l.ok ? '' : 'bg-red-950/20'
            }`}
          >
            <span className="font-mono text-xs text-neutral-500">{formatClock(l.at)}</span>
            <span className={`font-semibold ${l.ok ? 'text-sky-300' : 'text-red-300'}`}>
              {l.user.name}
            </span>
            <span className="text-neutral-300">
              {OP_LABEL[l.op] ?? l.op}
              {l.target ? ` · ${l.target}` : ''}
            </span>
            {l.detail && <span className="text-xs text-neutral-500">{l.detail}</span>}
            {!l.ok && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs text-red-300">
                已被拒绝{l.reason ? `：${l.reason}` : ''}
              </span>
            )}
            {isAdmin && l.user.id !== 'admin' && l.user.id !== 'system' && (
              <span className="ml-auto flex gap-1.5">
                {l.ok && l.op !== 'undo' && l.op !== 'auto_restore' && (
                  <button
                    type="button"
                    onClick={() => void undo(l.id)}
                    className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:border-neutral-500"
                  >
                    撤销
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void ban(l)}
                  className="rounded border border-red-900 bg-red-950/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900/40"
                >
                  封禁
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
