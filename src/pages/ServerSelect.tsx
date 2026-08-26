import { useState } from 'react'
import { Link } from 'react-router'
import { SERVERS } from '@/lib/servers'
import '../App.css'

const DOUYIN_ID = 'yuan1003883861'

/** 区服选择首页：先选区服，再进入对应的 Boss 计时页面 */
export default function ServerSelect() {
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(DOUYIN_ID)
    } catch {
      // 剪贴板不可用时用传统方式
      const ta = document.createElement('textarea')
      ta.value = DOUYIN_ID
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* 醒目抖音关注区 */}
      <div className="flex flex-col items-center gap-3 px-4 pb-2 pt-10">
        <div className="douyin-watermark inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-8 py-3 text-2xl font-bold tracking-[0.2em] text-white sm:text-3xl">
          <span className="douyin-note text-3xl leading-none sm:text-4xl">🎵</span>
          关注抖音：芬达
        </div>
        <button
          type="button"
          onClick={copyId}
          className="group inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-5 py-2 text-lg font-bold text-fuchsia-200 transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-500/20"
          title="点击复制抖音号"
        >
          <span className="text-sm font-medium text-fuchsia-300/80">抖音号</span>
          <span className="font-mono tracking-wider">{DOUYIN_ID}</span>
          <span className="text-xs text-fuchsia-300/70 group-hover:text-fuchsia-200">
            {copied ? '✓ 已复制' : '📋 复制'}
          </span>
        </button>
      </div>

      {/* 标题与区服选择 */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-8">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-wide sm:text-4xl">
          <span className="mr-2">⚔️</span>Boss 刷新倒计时
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
          选择你的区服，同一区服的玩家实时共享击杀记录
        </p>

        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {SERVERS.map((s) => (
            <Link
              key={s.id}
              to={`/s/${s.id}`}
              className={`group flex flex-col items-center gap-3 rounded-2xl border border-neutral-700/80 bg-gradient-to-b px-4 py-8 transition-all duration-150 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40 ${s.cardClass}`}
            >
              <span className="text-5xl transition-transform duration-150 group-hover:scale-110">{s.icon}</span>
              <span className="text-xl font-bold tracking-wide">{s.name}</span>
              <span className="text-xs text-neutral-400 group-hover:text-neutral-200">进入 →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
