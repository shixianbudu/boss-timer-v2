/** 管理员对话框：输入管理员密钥，解锁封禁 / 撤销 / 全部清空 / 解封管理 */
import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiFetch, getAdminKey, setAdminKey } from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

interface BanEntry {
  name?: string
  reason: string
  at: number
  until?: number
  auto?: boolean
}

interface BanList {
  fp: Record<string, BanEntry>
  uid: Record<string, BanEntry>
}

function formatUntil(e: BanEntry): string {
  if (!e.until) return '永久'
  if (e.until <= Date.now()) return '已过期'
  return `${new Date(e.until).toLocaleString()} 解除`
}

export default function AdminDialog({ open, onClose }: Props) {
  const [key, setKey] = useState(getAdminKey())
  const [bans, setBans] = useState<BanList | null>(null)
  const [loadingBans, setLoadingBans] = useState(false)
  const isAdmin = !!getAdminKey()

  const loadBans = useCallback(async () => {
    if (!getAdminKey()) return
    setLoadingBans(true)
    try {
      const data = await apiFetch<{ bans: BanList }>('/api/admin/bans', { admin: true })
      setBans(data.bans)
    } catch {
      setBans(null)
    } finally {
      setLoadingBans(false)
    }
  }, [])

  // 打开弹窗且已是管理员时加载封禁列表
  useEffect(() => {
    if (open && getAdminKey()) void loadBans()
  }, [open, loadBans])

  const save = () => {
    setAdminKey(key.trim())
    toast.success(key.trim() ? '管理员模式已开启' : '已退出管理员模式')
    if (!key.trim()) setBans(null)
    else void loadBans()
  }

  const unban = async (fp: string, name?: string) => {
    if (!window.confirm(`确定解封「${name || fp.slice(0, 8)}」吗？`)) return
    try {
      await apiFetch('/api/admin/unban', { method: 'POST', body: { fp }, admin: true })
      toast.success('已解封')
      void loadBans()
    } catch {
      toast.error('解封失败：密钥无效或网络异常')
    }
  }

  const fpEntries = Object.entries(bans?.fp ?? {}).filter(([, e]) => !e.until || e.until > Date.now())

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-neutral-700 bg-neutral-900 text-neutral-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理员模式</DialogTitle>
          <DialogDescription className="text-neutral-400">
            输入管理员密钥（清空输入框保存即退出）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="ADMIN_KEY"
            className="border-neutral-700 bg-neutral-800"
          />
          <Button onClick={save} className="bg-amber-600 hover:bg-amber-500">
            保存
          </Button>
        </div>

        {isAdmin && (
          <div className="mt-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-200">当前封禁（设备）</h3>
              <button
                type="button"
                onClick={() => void loadBans()}
                className="text-xs text-neutral-400 hover:text-white"
              >
                刷新
              </button>
            </div>
            {loadingBans ? (
              <p className="py-3 text-center text-xs text-neutral-500">加载中…</p>
            ) : fpEntries.length === 0 ? (
              <p className="py-3 text-center text-xs text-neutral-500">当前没有生效中的封禁</p>
            ) : (
              <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
                {fpEntries.map(([fp, e]) => (
                  <li key={fp} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-300">{e.name || '未知昵称'}</span>
                        {e.auto && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                            自动
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-neutral-500">
                        {e.reason} · {formatUntil(e)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void unban(fp, e.name)}
                      className="shrink-0 rounded border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-900/40"
                    >
                      解封
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
