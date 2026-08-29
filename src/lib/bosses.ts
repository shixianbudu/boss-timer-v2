export interface BossConfig {
  id: string
  name: string
  /** 刷新周期（分钟） */
  respawnMinutes: number
  lines: number
  icon: string
  /** 自动循环缓冲毫秒数（仅多尔）：倒计时到点后按「刷新周期+缓冲」自动开始下一轮倒数 */
  autoLoopExtraMs?: number
}

export const LINE_COUNT = 60

export const BOSSES: BossConfig[] = [
  { id: 'snail-king', name: '蜗牛王', respawnMinutes: 45, lines: LINE_COUNT, icon: '🐌' },
  { id: 'tree-spirit-king', name: '树妖王', respawnMinutes: 45, lines: LINE_COUNT, icon: '🌳' },
  { id: 'giant-crab', name: '巨居蟹', respawnMinutes: 20, lines: LINE_COUNT, icon: '🦀' },
  { id: 'mushroom-king', name: '蘑菇王', respawnMinutes: 30, lines: LINE_COUNT, icon: '🍄' },
  { id: 'zombie-mushroom-king', name: '僵尸蘑菇王', respawnMinutes: 30, lines: LINE_COUNT, icon: '🧟' },
  { id: 'faust', name: '浮士德', respawnMinutes: 30, lines: LINE_COUNT, icon: '👹' },
  { id: 'doll', name: '多尔', respawnMinutes: 45, lines: LINE_COUNT, icon: '🎭', autoLoopExtraMs: 30_000 },
  { id: 'balrog', name: '蝙蝠怪', respawnMinutes: 180, lines: LINE_COUNT, icon: '🦇' },
]

export const respawnMs = (boss: BossConfig) => boss.respawnMinutes * 60 * 1000

/**
 * 距下次刷新的毫秒数（<=0 表示已刷新 / 正处于刷新窗口）
 * cycleExtraMs（仅多尔）：45 分钟倒数到点后不停止，进入 30 秒刷新窗口，
 * 随后以「45min+30s」为周期自动开始下一轮倒数，锚点仍是最后一次击杀时间
 */
export function nextSpawnIn(
  respawn: number,
  cycleExtraMs: number | undefined,
  killAt: number,
  now: number,
): number {
  if (!cycleExtraMs) return killAt + respawn - now
  const cycle = respawn + cycleExtraMs
  const elapsed = now - killAt
  if (elapsed < respawn) return respawn - elapsed
  const pos = elapsed % cycle
  return pos < respawn ? respawn - pos : -(pos - respawn)
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatClock(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
