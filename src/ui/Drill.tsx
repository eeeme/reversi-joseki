import { Lbl } from './Lbl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Tour } from './Tour'
import { type Move, strToMove } from '../reversi/core'
import { labelOf, moveLabel } from '../reversi/notation'
import { type Book, findChild, positionAt, toBookMove } from '../book/book'
import { grade, isQuiz, pickWeighted, quizNodes, turnAt, weights } from '../book/srs'
import { Board } from './Board'
import { Feedback, useFeedback } from './Feedback'

interface Props {
  book: Book
  startNode: string
  showLegal: boolean
  onChange: () => void
  onBack: () => void
}

type Phase = 'setup' | 'run' | 'done'

export function Drill({ book, startNode, showLegal, onChange, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [side, setSide] = useState<0 | 1>(0)
  const [fromHere, setFromHere] = useState(startNode !== book.rootId)
  const [blind, setBlind] = useState(false)

  const [nodeId, setNodeId] = useState(book.rootId)
  const [wrong, setWrong] = useState(0)
  const [hint, setHint] = useState<Move | null>(null)
  const [msg, setMsg] = useState('')
  const [tally, setTally] = useState({ ok: 0, ng: 0, lines: 0 })
  const [lineNo, setLineNo] = useState(0)

  const origin = fromHere ? startNode : book.rootId
  const w = useMemo(() => weights(book, side), [book, side, lineNo])
  const node = book.nodes[nodeId]
  const { pos, last } = useMemo(() => positionAt(book, nodeId), [book, nodeId])
  const lastLabel = node.move ? `${turnAt(book, nodeId) === 0 ? '○' : '●'} ${labelOf(node.move)}` : '開始局面'
  // パスしかない局面は出題せず自動で進める
  const autoPass = node.children.length > 0 && !isQuiz(book, nodeId)
  const myTurn = turnAt(book, nodeId) === side && !autoPass
  const timer = useRef<number | undefined>(undefined)
  const { fb, fire } = useFeedback()

  const quizCount = useMemo(() => quizNodes(book, side, origin).length, [book, side, origin])

  // 相手番なら自動で指す／末端なら終了
  useEffect(() => {
    if (phase !== 'run') return
    if (node.children.length === 0) {
      setPhase('done')
      setTally((t) => ({ ...t, lines: t.lines + 1 }))
      fire('done')
      return
    }
    if (!myTurn) {
      timer.current = window.setTimeout(() => {
        const next = pickWeighted(node.children, w)
        setMsg(autoPass ? `${turnAt(book, nodeId) === 0 ? '黒' : '白'}はパス` : '')
        setNodeId(next)
      }, blind ? 900 : 550)
      return () => window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, nodeId, myTurn, node.children, w, blind])

  const start = () => {
    setNodeId(origin)
    setWrong(0)
    setHint(null)
    setMsg(turnAt(book, origin) === side ? 'あなたの番です' : '相手が打ちます')
    setLineNo((n) => n + 1)
    setPhase('run')
  }

  const record = (ok: boolean) => {
    book.srs[nodeId] = grade(book.srs[nodeId], ok)
    onChange()
  }

  const onMove = (m: Move) => {
    if (phase !== 'run' || !myTurn) return
    const hit = findChild(book, nodeId, toBookMove(book, nodeId, m).move)
    if (hit) {
      if (wrong === 0 && !hint) {
        record(true)
        setTally((t) => ({ ...t, ok: t.ok + 1 }))
        fire('ok')
      }
      const others = node.children.length - 1
      setMsg(others > 0 ? `正解（他に${others}通りの定石手あり）` : '正解')
      setWrong(0)
      setHint(null)
      setNodeId(hit)
      return
    }
    if (wrong === 0 && !hint) {
      record(false)
      setTally((t) => ({ ...t, ng: t.ng + 1 }))
    }
    setWrong((n) => n + 1)
    fire('ng')
    setMsg(`違います：${moveLabel(m)}。もう一度`)
  }

  const showAnswer = () => {
    const ans = strToMove(book.nodes[node.children[0]].move!)
    if (wrong === 0 && !hint) {
      record(false)
      setTally((t) => ({ ...t, ng: t.ng + 1 }))
    }
    setHint(ans)
    setMsg(`正解は ${node.children.map((c) => labelOf(book.nodes[c].move!)).join(' / ')}`)
  }

  if (phase === 'setup') {
    return (
      <div className="screen">
        <header className="bar">
          <button className="btn ghost" onClick={onBack}>‹ 戻る</button>
          <h1 className="bar-title">練習</h1>
          <span />
        </header>
        <section className="panel setup">
          <label>自分の色</label>
          <div className="seg">
            <button className={side === 0 ? 'on' : ''} onClick={() => setSide(0)}>● 黒</button>
            <button className={side === 1 ? 'on' : ''} onClick={() => setSide(1)}>○ 白</button>
          </div>
          {startNode !== book.rootId && (
            <>
              <label>開始位置</label>
              <div className="seg">
                <button className={!fromHere ? 'on' : ''} onClick={() => setFromHere(false)}>初手から</button>
                <button className={fromHere ? 'on' : ''} onClick={() => setFromHere(true)}>選択中の局面から</button>
              </div>
            </>
          )}
          <label>オプション</label>
          <div className="row gap wrap">
            <button className={`chip ${blind ? 'on' : ''}`} onClick={() => setBlind(!blind)}>石を隠す（脳内盤）</button>
          </div>
          <button className="btn primary wide" onClick={start} disabled={quizCount === 0}>
            {quizCount === 0 ? '出題なし' : 'はじめる'}
          </button>
        </section>
        <Tour
          id="drill"
          steps={[
            { sel: '.setup .seg', title: '自分の色', text: 'あなたが黒と白のどちらを持つかを選びます。相手の手は自動で打たれます。' },
            { sel: '.setup .row.gap.wrap', title: 'オプション', text: '石を隠して、頭の中で盤を思い浮かべる練習もできます。' },
            { sel: '.setup .btn.primary.wide', title: 'はじめる', text: '自分の番で定石の手を盤に打ってください。分岐があればどれを打っても正解です。わからないときは「答えを見る」。' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={onBack}>‹ 終了</button>
        <h1 className="bar-title">練習 <small>{side === 0 ? '●黒' : '○白'}</small></h1>
        <span className="tally">○{tally.ok} ×{tally.ng}</span>
      </header>
      <div className="board-fb">
      <Board
        pos={pos}
        last={last}
        hint={hint}
        showLegal={showLegal}
        hideStones={blind && phase === 'run'}
        interactive={phase === 'run' && myTurn}
        onMove={onMove}
      />
        <Feedback kind={fb.kind} seq={fb.seq} />
      </div>
      <section className="panel drill-status">
        <p className="last-move">直前：<Lbl text={lastLabel} /></p>
        {phase === 'run' ? (
          <>
            <p className={`msg ${msg.startsWith('違') ? 'bad' : msg.startsWith('正解') ? 'good' : ''}`}>
              {myTurn ? msg || 'あなたの番です' : autoPass ? '打てる場所がないのでパスします' : msg || '相手が考えています…'}
            </p>
            {myTurn && <button className="btn" onClick={showAnswer}>答えを見る</button>}
          </>
        ) : (
          <>
            <p className="msg good">この変化の終わりまで来ました（{tally.lines}本目）</p>
            <div className="row gap">
              <button className="btn primary" onClick={start}>次の変化へ</button>
              <button className="btn" onClick={onBack}>終了</button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
