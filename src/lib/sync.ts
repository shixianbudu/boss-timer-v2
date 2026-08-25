/** 多人联机同步层：基于公共 MQTT 服务器（broker.emqx.io）的保留消息
 *
 * 原理：把全部击杀记录作为一条 retained 消息发布到固定主题。
 * 任何人打开页面订阅该主题，都会立刻收到最新状态；
 * 每次记录/清除都会合并最新状态后重新发布（覆盖保留消息）。
 * 数据为"键值 + 时间戳"结构，合并规则：同一条线取时间戳较新的为准，删除用墓碑标记。
 */
import mqtt, { type MqttClient } from 'mqtt'

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt'
const TOPIC = 'bosstimer/sync-x7k2q9/state'

export interface SyncDoc {
  /** key -> 击杀时间戳 */
  r: Record<string, number>
  /** key -> 删除（墓碑）时间戳 */
  d: Record<string, number>
}

export type SyncStatus = 'connecting' | 'online' | 'offline'

const emptyDoc = (): SyncDoc => ({ r: {}, d: {} })

/** 合并两个文档：每个键取较新的时间戳 */
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const r: Record<string, number> = { ...a.r }
  const d: Record<string, number> = { ...a.d }
  for (const [k, v] of Object.entries(b.r)) {
    if (!r[k] || v > r[k]) r[k] = v
  }
  for (const [k, v] of Object.entries(b.d)) {
    if (!d[k] || v > d[k]) d[k] = v
  }
  // 清理：墓碑比记录新则丢掉记录
  for (const k of Object.keys(r)) {
    if (d[k] && d[k] >= r[k]) delete r[k]
  }
  return { r, d }
}

/** 文档 -> 界面可见的记录表 */
export function visibleRecords(doc: SyncDoc): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(doc.r)) {
    if (!doc.d[k] || doc.d[k] < v) out[k] = v
  }
  return out
}

export interface SyncClient {
  getDoc: () => SyncDoc
  /** 修改文档并发布（参数为变更函数，直接改传入的 doc） */
  change: (mutate: (doc: SyncDoc) => void) => void
  onUpdate: (cb: (doc: SyncDoc) => void) => void
  onStatus: (cb: (s: SyncStatus) => void) => void
  close: () => void
}

export function createSyncClient(initialDoc: SyncDoc): SyncClient {
  let doc = initialDoc
  let updateCb: (doc: SyncDoc) => void = () => {}
  let statusCb: (s: SyncStatus) => void = () => {}
  let closed = false

  let client: MqttClient | null = null
  try {
    client = mqtt.connect(BROKER_URL, {
      clientId: 'bosstimer-' + Math.random().toString(16).slice(2),
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      clean: true,
    })
  } catch {
    client = null
  }

  const setStatus = (s: SyncStatus) => statusCb(s)

  // 有未成功发布的本地变更时为 true，连接恢复后补发
  let dirty = false
  const publish = () => {
    if (!client || !client.connected) return
    client.publish(TOPIC, JSON.stringify(doc), { retain: true, qos: 1 }, (err) => {
      dirty = !!err
    })
  }

  if (client) {
    setStatus('connecting')
    client.on('connect', () => {
      setStatus('online')
      client!.subscribe(TOPIC, { qos: 1 }, () => {})
      // 等保留消息先合并进来（约 1.5s），再补发本地离线期间的变更，避免覆盖别人的新记录
      setTimeout(() => {
        if (!closed && dirty) {
          dirty = false
          publish()
        }
      }, 1500)
    })
    client.on('reconnect', () => setStatus('connecting'))
    client.on('offline', () => setStatus('offline'))
    client.on('error', () => setStatus('offline'))
    client.on('message', (_topic, payload) => {
      try {
        const incoming = JSON.parse(payload.toString()) as SyncDoc
        if (typeof incoming !== 'object' || !incoming || typeof incoming.r !== 'object') return
        doc = mergeDocs(doc, incoming)
        updateCb(doc)
        // 合入远端后若还有本地未发变更，立刻把合并结果发回去，促使两端收敛
        if (dirty) {
          dirty = false
          publish()
        }
      } catch {
        // 忽略坏消息
      }
    })
  } else {
    setStatus('offline')
  }

  return {
    getDoc: () => doc,
    change: (mutate) => {
      mutate(doc)
      // 变更后立即做一致性清理
      doc = mergeDocs(doc, emptyDoc())
      updateCb(doc)
      if (client && client.connected) {
        publish()
      } else {
        dirty = true
      }
    },
    onUpdate: (cb) => {
      updateCb = cb
    },
    onStatus: (cb) => {
      statusCb = cb
    },
    close: () => {
      if (!closed && client) {
        closed = true
        client.end(true)
      }
    },
  }
}
