import { useMemo } from 'react'
import { BOSSES, nextSpawnIn, respawnMs, type BossConfig } from '@/lib/bosses'
import type { KillRecords } from '@/hooks/useKillRecords'
import LineCard from './LineCard'

interface OverviewPanelProps {
  records: KillRecords
  now: number
  onKill: (bossId: string, line: number) => void
  onClear: (bossId: string, line: number) => void
}

interface Entry {
  boss: BossConfig
  line: number
  killAt: number
  remaining: number
}

/** 全部 Boss 总览：所有已记录的线按剩余刷新时间排序（已刷新的排最前） */
export default function OverviewPanel({ records, now, onKill, onClear }: OverviewPanelProps) {
  const bossMap = useMemo(() => new Map(BOSSES.map((b) => [b.id, b])), [])

  const items = useMemo(() => {
    const arr: Entry[] = []
    for (const [key, killAt] of Object.entries(records)) {
      const sep = key.indexOf(':')
      const boss = bossMap.get(key.slice(0, sep))
      if (!boss) continue
      const line = Number(key.slice(sep + 1))
      arr.push({ boss, line, killAt, remaining: nextSpawnIn(respawnMs(boss), boss.autoLoopExtraMs, killAt, now) })
    }
    arr.sort((a, b) => a.remaining - b.remaining)
    return arr
  }, [records, now, bossMap])

  const spawnedCount = items.filter((i) => i.remaining <= 0).length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-400">
        <span>
          已记录 <span className="font-semibold text-emerald-400">{items.length}</span> 条线
        </span>
        {spawnedCount > 0 && (
          <span className="font-semibold text-red-400">{spawnedCount} 条线已刷新，快去蹲！</span>
        )}
        <span className="text-neutral-600">按剩余刷新时间排序，最前面的最先刷新</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-700 py-10 text-center text-sm text-neutral-500">
          还没有任何记录，去各个 Boss 页面点击线号记录击杀时间吧
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {items.map(({ boss, line, killAt }) => (
            <LineCard
              key={`${boss.id}:${line}`}
              line={line}
              title={`${boss.icon}${boss.name}·${line}线`}
              killAt={killAt}
              respawnMs={respawnMs(boss)}
              cycleExtraMs={boss.autoLoopExtraMs}
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
