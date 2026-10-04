import { useState } from 'react'
import { Tour } from './Tour'
import { type Cell, type Pos, START_POS, isOver, legalMoves, parsePos, toPosString } from '../reversi/core'
import { Board } from './Board'

interface Props {
  initialPos?: string
  onCreate: (name: string, pos: string) => void
  onBack: () => void
  toast: (s: string) => void
  /** 検索用：名前欄を出さず、ボタンを「検索」にする */
  forSearch?: boolean
}

type Paint = 'cycle' | 1 | 2 | 0

const emptyPos = (): Pos => ({ board: Array<Cell>(64).fill(0), turn: 0 })

/** 盤面編集：マスをタップするたびに 黒 → 白 → 空 と切り替え、その局面から新しい本を作る */
export function BoardEditor({ initialPos, onCreate, onBack, toast, forSearch }: Props) {
  const [pos, setPos] = useState<Pos>(() => parsePos(initialPos ?? START_POS))
  const [paint, setPaint] = useState<Paint>('cycle')
  const [flipped, setFlipped] = useState(false)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState(false)

  const onSquare = (sq: number) => {
    const board = pos.board.slice()
    const cur = board[sq]
    board[sq] = paint === 'cycle' ? (((cur + 1) % 3) as Cell) : cur === paint ? 0 : paint
    setPos({ ...pos, board })
  }

  const create = () => {
    if (!pos.board.some(Boolean)) return toast('盤に石がありません')
    setConfirming(true)
  }
  const finish = () => {
    if (!forSearch && isOver(pos)) toast('この局面はどちらも打てません（終局）')
    else if (!forSearch && !legalMoves(pos).length) toast('この手番は打てる場所がないので、最初の手はパスになります')
    setConfirming(false)
    onCreate(name.trim() || '自由配置の局面', toPosString(pos))
  }

  return (
    <div className="screen fit">
      <header className="bar">
        <button className="btn ghost" onClick={onBack}>‹ 戻る</button>
        <h1 className="bar-title">{forSearch ? '局面検索' : '盤面編集'}</h1>
        <button className="btn primary" onClick={create}>{forSearch ? '検索' : '作成'}</button>
      </header>

      <div className="stage">
        <Board pos={pos} flipped={flipped} onEditSquare={onSquare} />
      </div>

      <section className="panel editor">
        <div className="palette-head">
          <span className="muted">タップで置く石</span>
          <div className="seg small">
            <button className={paint === 'cycle' ? 'on' : ''} onClick={() => setPaint('cycle')}>黒→白→空</button>
            <button className={paint === 1 ? 'on' : ''} onClick={() => setPaint(1)}>●</button>
            <button className={paint === 2 ? 'on' : ''} onClick={() => setPaint(2)}>○</button>
          </div>
        </div>
        <div className="edit-actions">
          <button className={`chip ${flipped ? 'on' : ''}`} onClick={() => setFlipped(!flipped)}>盤を回す</button>
          <button className="chip" onClick={() => setPos(parsePos(START_POS))}>初期配置に戻す</button>
          <button className="chip" onClick={() => setPos(emptyPos())}>全部消す</button>
          <button
            className="chip"
            onClick={() => setPos({ ...pos, board: pos.board.map((c) => (c === 1 ? 2 : c === 2 ? 1 : 0) as Cell) })}
          >白黒を入れ替える</button>
        </div>
      </section>

      <Tour
        id={forSearch ? 'search-editor' : 'editor'}
        steps={[
          { sel: '.board', title: '石を置く', text: 'マスをタップするたびに、黒 → 白 → 空 と切り替わります。' },
          { sel: '.palette-head', title: '置く石を決める', text: '黒だけ・白だけを続けて置きたいときは ● か ○ を選びます。同じ色のマスをもう一度タップすると消えます。' },
          { sel: '.bar .btn.primary', title: forSearch ? '検索' : '作成', text: forSearch ? '並べ終わったら押して、手番を選んで検索します。' : '並べ終わったら押して、手番と名前を決めて本を作ります。' },
        ]}
      />
      {confirming && (
        <div className="sheet-backdrop" onClick={() => setConfirming(false)}>
          <div className="sheet form" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">{forSearch ? '検索' : '作成'}</p>
            <div className="seg">
              <button className={pos.turn === 0 ? 'on' : ''} onClick={() => setPos({ ...pos, turn: 0 })}>● 黒番</button>
              <button className={pos.turn === 1 ? 'on' : ''} onClick={() => setPos({ ...pos, turn: 1 })}>○ 白番</button>
            </div>
            {!forSearch && <input placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
            <div className="row gap">
              <button className="btn grow" onClick={() => setConfirming(false)}>キャンセル</button>
              <button className="btn primary grow" onClick={finish}>{forSearch ? '検索' : '作成'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
