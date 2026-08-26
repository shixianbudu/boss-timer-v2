/** 封禁规则弹窗
 *
 * - 首次打开网页时强制弹出，点「我已阅读并同意」后不再弹
 * - 规则内容更新时改 RULES_VERSION，所有人会重新看到
 * - 页面上的「📜 规则」按钮通过 requestRules() 随时唤起
 */
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** 规则版本号：改文案时 +1（v2 -> v3），用户需重新确认 */
const RULES_VERSION = 'v3'
const STORAGE_KEY = 'bt-rules-agreed'

const listeners = new Set<() => void>()
/** 页面任意处调用可重新打开规则弹窗 */
export function requestRules() {
  listeners.forEach((f) => f())
}

export default function RulesDialog() {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== RULES_VERSION)
  const agreed = localStorage.getItem(STORAGE_KEY) === RULES_VERSION

  useEffect(() => {
    const cb = () => setOpen(true)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, [])

  const agree = () => {
    localStorage.setItem(STORAGE_KEY, RULES_VERSION)
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // 未同意前不允许关闭；已同意的（通过按钮重新打开）可以关
        if (!v && localStorage.getItem(STORAGE_KEY) === RULES_VERSION) setOpen(false)
      }}
    >
      <DialogContent
        className="max-h-[85vh] overflow-y-auto border-neutral-700 bg-neutral-900 text-neutral-100 sm:max-w-lg"
        onPointerDownOutside={(e) => {
          if (localStorage.getItem(STORAGE_KEY) !== RULES_VERSION) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (localStorage.getItem(STORAGE_KEY) !== RULES_VERSION) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>🛡️ Boss 计时器使用规则</DialogTitle>
          <DialogDescription className="text-neutral-400">
            本工具为多人共享计时，数据真实可靠靠大家自觉维护。请遵守以下规则：
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed text-neutral-300">
          <section>
            <h3 className="mb-1 font-bold text-emerald-300">一、正常使用</h3>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>击杀 Boss 后请点击对应线路记录时间，清除误点请及时更正。</li>
              <li>所有操作都会署名并公开显示在「操作动态」中，请勿填写冒犯性昵称。</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-amber-300">二、以下行为属于违规</h3>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>恶意乱点：在 Boss 未刷新时反复记录虚假击杀时间。</li>
              <li>恶意清除：无故清除他人记录、批量清除计时数据。</li>
              <li>使用脚本、连点器等工具高频刷接口。</li>
              <li>其他故意破坏计时数据的行为。</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-red-300">三、处罚机制（机器自动执行）</h3>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>
                系统会自动检测异常操作：<strong>未到刷新时间的击杀上报会被拒绝并记录；同一设备 1 分钟内操作超过 3 次视为操作频率过高，同样被拒绝并记录</strong>。
              </li>
              <li>
                <strong className="text-red-400">1 小时内异常操作累计 10 次，系统将自动封禁该设备 24 小时</strong>，封禁期间无法提交任何操作。
              </li>
              <li>
                封禁（含管理员手动封禁）的同时，<strong className="text-red-400">系统会自动还原该设备在本区服的全部操作记录</strong>，被破坏的计时会自动恢复，其他玩家的正常记录不受影响。
              </li>
              <li>
                情节严重或多次自动封禁的，管理员将<strong className="text-red-400">永久封禁该设备</strong>，不予解除。
              </li>
              <li>被判定违规的操作会被撤销，并在操作动态中公开标红。</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-1 font-bold text-sky-300">四、误封申诉</h3>
            <p className="pl-1">如认为被误封，请联系管理员（抖音：芬达）核实处理。</p>
          </section>
        </div>

        <DialogFooter>
          {agreed ? (
            <Button onClick={() => setOpen(false)} className="bg-neutral-700 hover:bg-neutral-600">
              关闭
            </Button>
          ) : (
            <Button onClick={agree} className="bg-amber-600 hover:bg-amber-500">
              我已阅读并同意
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
