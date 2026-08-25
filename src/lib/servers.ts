export interface ServerConfig {
  id: string
  name: string
  icon: string
  /** 卡片主题色（Tailwind 类） */
  cardClass: string
}

/** 区服列表：服务器下面才是频道（线） */
export const SERVERS: ServerConfig[] = [
  { id: 'lanwoniu', name: '蓝蜗牛', icon: '🐌', cardClass: 'from-blue-500/25 to-blue-900/20 hover:border-blue-400/70' },
  { id: 'lvshuiling', name: '绿水灵', icon: '💧', cardClass: 'from-emerald-500/25 to-emerald-900/20 hover:border-emerald-400/70' },
  { id: 'moguzai', name: '蘑菇仔', icon: '🍄', cardClass: 'from-orange-500/25 to-orange-900/20 hover:border-orange-400/70' },
  { id: 'piaopiaozhu', name: '漂漂猪', icon: '🐷', cardClass: 'from-pink-500/25 to-pink-900/20 hover:border-pink-400/70' },
  { id: 'xiaobaitu', name: '小白兔', icon: '🐰', cardClass: 'from-slate-300/20 to-slate-700/20 hover:border-slate-300/70' },
]

export const getServer = (id: string | undefined) => SERVERS.find((s) => s.id === id)
