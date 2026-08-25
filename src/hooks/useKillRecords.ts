import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSyncClient,
  visibleRecords,
  type SyncClient,
  type SyncDoc,
  type SyncStatus,
} from '@/lib/sync'

const storageKey = (serverId: string) => `boss-timer-doc-v2:${serverId}`

/** key: `${bossId}:${line}` -> 击杀时间戳(ms) */
export type KillRecords = Record<string, number>

export const recordKey = (bossId: string, line: number) => `${bossId}:${line}`

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

/** 联机同步版记录 hook：本地即时响应 + MQTT 多人同步（按区服隔离） */
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

  const recordKill = useCallback((bossId: string, line: number) => {
    clientRef.current?.change((doc) => {
      doc.r[recordKey(bossId, line)] = Date.now()
      delete doc.d[recordKey(bossId, line)]
    })
  }, [])

  const clearRecord = useCallback((bossId: string, line: number) => {
    clientRef.current?.change((doc) => {
      const key = recordKey(bossId, line)
      delete doc.r[key]
      doc.d[key] = Date.now()
    })
  }, [])

  const clearBoss = useCallback((bossId: string) => {
    clientRef.current?.change((doc) => {
      const now = Date.now()
      for (const key of Object.keys(doc.r)) {
        if (key.startsWith(`${bossId}:`)) {
          delete doc.r[key]
          doc.d[key] = now
        }
      }
    })
  }, [])

  const clearAll = useCallback(() => {
    clientRef.current?.change((doc) => {
      const now = Date.now()
      for (const key of Object.keys(doc.r)) {
        delete doc.r[key]
        doc.d[key] = now
      }
    })
  }, [])

  return { records, recordKill, clearRecord, clearBoss, clearAll, syncStatus }
}
