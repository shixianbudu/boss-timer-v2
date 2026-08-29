import { memo } from 'react'
import { formatClock, formatCountdown, nextSpawnIn } from '@/lib/bosses'

interface LineCardProps {
  line: number
  killAt?: number
  respawnMs: number
  /** 自动循环缓冲（仅多尔）：到点后按「刷新周期+缓冲」循环重新倒数 */
  cycleExtraMs?: number
  now: number
  onKill: () => void
  onClear: () => void
  /** 自定义标题（总览页用），默认显示 `${line} 线` */
  title?: string
}

function LineCardInner({ line, killAt, respawnMs, cycleExtraMs, now, onKill, onClear, title }: LineCardProps) {
  const label = title ?? `${line} 线`
  const recorded = killAt !== undefined
  const remaining = recorded ? nextSpawnIn(respawnMs, cycleExtraMs, killAt, now) : 0
  const spawned = recorded && remaining <= 0
  // 已过去至少一个完整周期：当前倒数为自动循环（期间没人点过击杀）
  const looped = recorded && cycleExtraMs != null && now - killAt >= respawnMs + cycleExtraMs
  // 剩余比例 1(刚击杀) -> 0(即将刷新)，色相 120(绿) -> 0(红)
  const fraction = recorded ? Math.min(1, Math.max(0, remaining / respawnMs)) : 1
  const hue = Math.round(120 * fraction)

  const base =
    'relative select-none overflow-hidden rounded-lg border text-left transition-transform duration-100 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60'

  if (!recorded) {
    return (
      <button
        type="button"
        onClick={onKill}
        className={`${base} border-neutral-700 bg-neutral-800/60 p-2 hover:border-neutral-500 hover:bg-neutral-700/60`}
        title="点击记录击杀时间"
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-neutral-300">{label}</span>
        </div>
        <div className="mt-1 text-lg font-mono font-semibold text-neutral-500">--:--</div>
        <div className="mt-0.5 text-[10px] text-neutral-500">点击记录击杀</div>
      </button>
    )
  }

  const dynamicStyle: React.CSSProperties = spawned
    ? {}
    : {
        borderColor: `hsl(${hue} 70% 40%)`,
        background: `linear-gradient(180deg, hsl(${hue} 65% 42% / 0.35), hsl(${hue} 65% 32% / 0.22))`,
      }

  return (
    <button
      type="button"
      onClick={onKill}
      className={`${base} p-2 ${spawned ? 'animate-pulse border-red-500 bg-red-600/40' : ''}`}
      style={dynamicStyle}
      title="再次点击重新记录击杀时间"
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-sm font-bold text-white/90">{label}</span>
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          className="rounded px-1 text-xs leading-4 text-white/40 hover:bg-black/30 hover:text-white"
          title="清除该线记录"
        >
          ×
        </span>
      </div>
      <div className={`mt-1 font-mono text-lg font-bold ${spawned ? 'text-red-100' : 'text-white'}`}>
        {spawned ? `+${formatCountdown(-remaining)}` : formatCountdown(remaining)}
      </div>
      <div className="mt-0.5 space-y-px text-[10px] leading-tight text-white/60">
        {spawned ? (
          <div className="font-semibold text-red-200">已刷新！</div>
        ) : (
          <div>刷新 {formatClock(now + remaining)}</div>
        )}
        <div>
          击杀 {formatClock(killAt)}
          {looped && <span className="ml-1 text-amber-300/80">·自动循环</span>}
        </div>
      </div>
      {/* 底部进度条：随剩余时间缩短 */}
      {!spawned && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${fraction * 100}%`, backgroundColor: `hsl(${hue} 80% 55%)` }}
          />
        </div>
      )}
    </button>
  )
}

const LineCard = memo(LineCardInner)
export default LineCard
