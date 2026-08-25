/** 昵称设置对话框：首次使用或点击"改名"时弹出 */
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
import { getNickname, setNickname } from '@/lib/identity'

interface Props {
  open: boolean
  onClose: () => void
}

export default function IdentityDialog({ open, onClose }: Props) {
  const [name, setName] = useState(getNickname() ?? '')
  const valid = name.trim().length >= 1 && name.trim().length <= 12

  const save = () => {
    if (!valid) return
    setNickname(name)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && getNickname() && onClose()}>
      <DialogContent className="border-neutral-700 bg-neutral-900 text-neutral-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>设置你的昵称</DialogTitle>
          <DialogDescription className="text-neutral-400">
            击杀记录会署名并公开显示在「操作动态」里，谁乱来大家都能看到。
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="1-12 个字符，例如：芬达的小号"
          maxLength={12}
          className="border-neutral-700 bg-neutral-800"
          autoFocus
        />
        <DialogFooter>
          <Button onClick={save} disabled={!valid} className="bg-amber-600 hover:bg-amber-500">
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
