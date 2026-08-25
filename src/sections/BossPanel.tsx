import { useMemo, useState } from 'react'
import { respawnMs, type BossConfig } from '@/lib/bosses'
import { recordKey, type KillRecords } from '@/hooks/useKillRecords'
import LineCard from './LineCard'

interface BossPanelProps {
  boss: BossConfig
  records: KillRecords
  now: number
  onKill: (bossId: string, line: number) => void
  onClear: (bossId: string, line: number) => void
  onClearBoss: (bossId: string) => void
}

type SortMode = 'line' | 'time'

export default function BossPanel({ boss, records, now, onKill, onClear, onClearBoss }: BossPanelProps) {
  const [sortMode, setSortMode] = useState<SortMode>('line')
  const [onlyRecorded, setOnlyRecorded] = useState(false)
  const respawn = respawnMs(boss)

  const lines = useMemo(() => {
    const arr = Array.from({ length: boss.lines }, (_, i) => {
      const line = i + 1
      const killAt = records[recordKey(boss.id, line)]
      const remaining = killAt !== undefined ? killAt + respawn - now : Number.POSITIVE_INFINITY
      return { line, killAt, remaining }
    })
    const filtered = onlyRecorded ? arr.filter((x) => x.killAt !== undefined) : arr
    if (sortMode === 'time') {
      // 剩余时间短的在前；已刷新(负数)最前；未记录排最后
      return [...filtered].sort((a, b) => a.remaining - b.remaining)
    }
    return filtered
  }, [boss.id, boss.lines, records, now, respawn, sortMode, onlyRecorded])

  const activeCount = useMemo(
    () => Object.keys(records).filter((k) => k.startsWith(`${boss.id}:`)).length,
    [records, boss.id],
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-sm text-neutral-400">
          刷新周期 <span className="font-semibold text-neutral-200">{boss.respawnMinutes} 分钟</span>
          <span className="mx-2 text-neutral-600">|</span>
          已记录 <span className="font-semibold text-emerald-400">{activeCount}</span> / {boss.lines} 线
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyRecorded((v) => !v)}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              onlyRecorded
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            只看已记录
          </button>
          <button
            type="button"
            onClick={() => setSortMode((m) => (m === 'line' ? 'time' : 'line'))}
            className="rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:text-white"
          >
            {sortMode === 'line' ? '按线号排序' : '按剩余时间排序'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`确定清除「${boss.name}」全部 ${boss.lines} 条线的记录吗？`)) {
                onClearBoss(boss.id)
              }
            }}
            className="rounded-md border border-red-900 bg-red-950/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/50"
          >
            清空本 Boss
          </button>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-700 py-10 text-center text-sm text-neutral-500">
          暂无已记录的线，点击下方任意一条线即可记录击杀时间
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {lines.map(({ line, killAt }) => (
            <LineCard
              key={line}
              line={line}
              killAt={killAt}
              respawnMs={respawn}
              now={now}
              onKill={() => onKill(boss.id, line)}
              onClear={() => onClear(boss.id, line)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
