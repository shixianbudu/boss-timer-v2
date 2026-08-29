import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSyncClient,
  visibleRecords,
  type SyncClient,
  type SyncDoc,
  type SyncStatus,
} from '@/lib/sync'
import { BOSSES, formatCountdown, nextSpawnIn, respawnMs } from '@/lib/bosses'

const storageKey = (serverId: string) => `boss-timer-doc-v2:${serverId}`

/** key: `${bossId}:${line}` -> 击杀时间戳(ms) */
export type KillRecords = Record<string, number>

export const recordKey = (bossId: string, line: number) => `${bossId}:${line}`

/** 与后端一致：刷新周期 - 3 分钟内再次记录视为"提前" */
const EARLY_TOLERANCE_MS = 3 * 60 * 1000

const BOSS_MAP = new Map(BOSSES.map((b) => [b.id, b]))

function loadDoc(serverId: string): SyncDoc {
  try {
    const raw = localStorage.getItem(storageKey(serverId))
    if (!raw) return { r: {}, d: {} }
    const parsed = JSON.parse(raw) as SyncDoc
    if (parsed && typeof parsed.r === 'object' && typeof parsed.d === 'object') return parsed
    return { r: {}, d: {} }
  } catch {
    return { r: {}, d: {} }
  }
}

function saveDoc(serverId: string, doc: SyncDoc) {
  try {
    localStorage.setItem(storageKey(serverId), JSON.stringify(doc))
  } catch {
    // 存储失败时静默忽略
  }
}

/** 联机同步版记录 hook：本地即时响应 + Worker 后端校验同步（按区服隔离） */
export function useKillRecords(serverId: string) {
  const [records, setRecords] = useState<KillRecords>(() => visibleRecords(loadDoc(serverId)))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting')
  const clientRef = useRef<SyncClient | null>(null)

  useEffect(() => {
    const client = createSyncClient(loadDoc(serverId), serverId)
    clientRef.current = client
    client.onUpdate((doc) => {
      saveDoc(serverId, doc)
      setRecords(visibleRecords(doc))
    })
    client.onStatus(setSyncStatus)
    return () => client.close()
  }, [serverId])

  const recordKill = useCallback(
    (bossId: string, line: number) => {
      const boss = BOSS_MAP.get(bossId)
      const killAt = records[recordKey(bossId, line)]
      // 计时尚未结束（距离刷新超过容忍值）时，先弹确认框
      if (boss && killAt) {
        const remaining = nextSpawnIn(respawnMs(boss), boss.autoLoopExtraMs, killAt, Date.now())
        if (remaining > EARLY_TOLERANCE_MS) {
          const ok = window.confirm(
            `⚠️ ${boss.name} · ${line}线 的计时还未结束\n` +
              `预计 ${formatCountdown(remaining)} 后才会刷新。\n\n` +
              `如果确实提前击杀了 / 需要更正误点记录，点「确定」强制重置；\n` +
              `不确定请点「取消」。\n\n` +
              `注意：未到刷新时间的重置会被系统记录，频繁异常操作将自动封禁设备。`,
          )
          if (!ok) return
          clientRef.current?.kill(bossId, line, true)
          return
        }
      }
      clientRef.current?.kill(bossId, line, false)
    },
    [records],
  )

  const clearRecord = useCallback((bossId: string, line: number) => {
    clientRef.current?.clear(bossId, line)
  }, [])

  const clearBoss = useCallback((bossId: string) => {
    clientRef.current?.clearBoss(bossId)
  }, [])

  const clearAll = useCallback(() => {
    clientRef.current?.clearAll()
  }, [])

  return { records, recordKill, clearRecord, clearBoss, clearAll, syncStatus }
}
