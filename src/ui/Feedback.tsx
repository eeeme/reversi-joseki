import { useEffect, useState } from 'react'

export type FeedbackKind = 'ok' | 'ng' | 'done' | 'pass'

/** 正解・不正解・完走・パスを盤の上に大きく出す（約0.9秒で消える） */
export function Feedback({ kind, seq, label }: { kind: FeedbackKind | null; seq: number; label?: string }) {
  const [shown, setShown] = useState<{ kind: FeedbackKind; seq: number; label?: string } | null>(null)
  const [prevSeq, setPrevSeq] = useState(seq)
  if (seq !== prevSeq) {
    setPrevSeq(seq)
    if (kind) setShown({ kind, seq, label })
  }
  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setShown(null), shown.kind === 'done' ? 1400 : shown.kind === 'pass' ? 1100 : 900)
    return () => window.clearTimeout(t)
  }, [shown])
  if (!shown) return null
  return (
    <div className={`fb fb-${shown.kind}`} key={shown.seq} aria-live="polite">
      <div className="fb-ring" />
      <div className="fb-mark">{shown.kind === 'ok' ? '◯' : shown.kind === 'ng' ? '✕' : shown.kind === 'pass' ? 'パス' : '完'}</div>
      {shown.kind === 'pass' && shown.label && <div className="fb-sub">{shown.label}</div>}
      {shown.kind === 'ok' && Array.from({ length: 8 }, (_, i) => <i key={i} className="fb-spark" style={{ ['--a' as string]: `${i * 45}deg` }} />)}
    </div>
  )
}

/** 連続正解などで使う、seq を増やしながら種類を渡すための小さなフック */
export function useFeedback() {
  const [fb, setFb] = useState<{ kind: FeedbackKind | null; seq: number; label?: string }>({ kind: null, seq: 0 })
  const fire = (kind: FeedbackKind, label?: string) => setFb((f) => ({ kind, seq: f.seq + 1, label }))
  return { fb, fire }
}
