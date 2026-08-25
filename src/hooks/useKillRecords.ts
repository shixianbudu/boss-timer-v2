import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSyncClient,
  visibleRecords,
  type SyncClient,
  type SyncDoc,
  type SyncStatus,
} from '@/lib/sync'

const STORAGE_KEY = 'boss-timer-doc-v2'

/** key: `${bossId}:${line}` -> 击杀时间戳(ms) */
export type KillRecords = Record<string, number>

export const recordKey = (bossId: string, line: number) => `${bossId}:${line}`

function loadDoc(): SyncDoc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { r: {}, d: {} }
    const parsed = JSON.parse(raw) as SyncDoc
    if (parsed && typeof parsed.r === 'object' && typeof parsed.d === 'object') return parsed
    return { r: {}, d: {} }
  } catch {
    return { r: {}, d: {} }
  }
}

function saveDoc(doc: SyncDoc) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    // 存储失败时静默忽略
  }
}

/** 联机同步版记录 hook：本地即时响应 + MQTT 多人同步 */
export function useKillRecords() {
  const [records, setRecords] = useState<KillRecords>(() => visibleRecords(loadDoc()))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting')
  const clientRef = useRef<SyncClient | null>(null)

  useEffect(() => {
    const client = createSyncClient(loadDoc())
    clientRef.current = client
    client.onUpdate((doc) => {
      saveDoc(doc)
      setRecords(visibleRecords(doc))
    })
    client.onStatus(setSyncStatus)
    return () => client.close()
  }, [])

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
