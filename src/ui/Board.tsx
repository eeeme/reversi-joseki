import { useMemo } from 'react'
import { type Move, type Pos, PASS, colOf, countStones, legalMoves, rowOf, sqAt } from '../reversi/core'

interface Props {
  pos: Pos
  /** 盤を180度回して見る */
  flipped?: boolean
  last?: Move | null
  hint?: Move | null
  /** 石を隠す（脳内盤）。直前の手のマスだけ光らせる */
  hideStones?: boolean
  interactive?: boolean
  onMove?: (m: Move) => void
  /** 参照用：指定すると盤のタップは手ではなく、盤の左右どちら側かを渡す */
  onTapSide?: (side: 'left' | 'right') => void
  /** 盤面編集用：ルールを使わず、タップしたマスをそのまま渡す */
  onEditSquare?: (sq: number) => void
}

const FILES = 'abcdefgh'

export function Board({ pos, flipped = false, last, hint, hideStones, interactive = true, onMove, onTapSide, onEditSquare }: Props) {
  const legal = useMemo(() => new Set(legalMoves(pos)), [pos])
  const { black, white } = countStones(pos)
  const order = useMemo(() => {
    const out: number[] = []
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) out.push(flipped ? sqAt(7 - c, 7 - r) : sqAt(c, r))
    return out
  }, [flipped])
  const cols = flipped ? [...FILES].reverse() : [...FILES]
  const rows = flipped ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  // 打てる場所は常に光らせる（石を隠す練習中と盤面編集だけは出さない）
  const dotsOn = !onEditSquare && !hideStones

  const tap = (sq: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (onEditSquare) return onEditSquare(sq)
    if (onTapSide) {
      const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
      return onTapSide(e.clientX < r.left + r.width / 2 ? 'left' : 'right')
    }
    if (!interactive || !legal.has(sq)) return
    onMove?.(sq)
  }

  return (
    <div className="board-wrap">
      <div className="score">
        <span className={`score-side ${pos.turn === 0 ? 'turn' : ''}`}><i className="disc black" />黒 <b>{hideStones ? '–' : black}</b></span>
        <span className={`score-side ${pos.turn === 1 ? 'turn' : ''}`}><i className="disc white" />白 <b>{hideStones ? '–' : white}</b></span>
      </div>
      <div className="board-frame">
        <div className="board-files">
          {cols.map((f) => <span key={f}>{f}</span>)}
        </div>
        <div className="board-row">
          <div className={`board ${hideStones ? 'blind' : ''}`}>
            {order.map((sq, k) => {
              const cell = pos.board[sq]
              const cls = [
                'sq',
                dotsOn && legal.has(sq) ? 'target' : '',
                last !== null && last !== undefined && last !== PASS && last === sq ? 'last' : '',
                hint !== null && hint !== undefined && hint === sq ? 'hint' : '',
                // 星は b2・f2・b6・f6 の右下の角（表示の位置で決まるので、回しても同じ）
                (k % 8 === 1 || k % 8 === 5) && (Math.floor(k / 8) === 1 || Math.floor(k / 8) === 5) ? 'star' : '',
              ].join(' ')
              return (
                <button
                  key={sq}
                  className={cls}
                  onClick={(e) => tap(sq, e)}
                  aria-label={`${FILES[colOf(sq)]}${rowOf(sq) + 1}`}
                >
                  {cell !== 0 && !hideStones && <span className={`stone ${cell === 1 ? 'black' : 'white'}`} />}
                </button>
              )
            })}
          </div>
          <div className="board-ranks">
            {rows.map((r) => <span key={r}>{r}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}
