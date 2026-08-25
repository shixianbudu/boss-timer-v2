/** 管理员对话框：输入管理员密钥，解锁封禁 / 撤销 / 全部清空 */
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getAdminKey, setAdminKey } from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AdminDialog({ open, onClose }: Props) {
  const [key, setKey] = useState(getAdminKey())

  const save = () => {
    setAdminKey(key.trim())
    toast.success(key.trim() ? '管理员模式已开启' : '已退出管理员模式')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-neutral-700 bg-neutral-900 text-neutral-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>管理员模式</DialogTitle>
          <DialogDescription className="text-neutral-400">
            输入部署 Worker 时设置的 ADMIN_KEY。开启后可在「操作动态」里封禁捣乱者、撤销错误操作，并解锁「全部清空」。密钥只保存在你自己的浏览器里。清空输入框保存即退出管理员模式。
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="ADMIN_KEY"
          className="border-neutral-700 bg-neutral-800"
        />
        <DialogFooter>
          <Button onClick={save} className="bg-amber-600 hover:bg-amber-500">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
