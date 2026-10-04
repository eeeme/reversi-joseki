// 次の手の出現率・勝率：全部の本から「同じ局面（盤・手番）」の次の手を集計する
// 初期配置からの本はすべて初手 f5 の向きにそろえてあるので、局面文字列そのままで比べる
import { applyMove, parsePos, strToMove, toPosString, type Pos } from '../reversi/core'
import { winnerOf } from '../reversi/kifu'
import type { Book } from './book'

interface MoveAgg {
  books: Set<string>
  decided: number // 勝敗のある本の数
  wins: number // そのうち、この手を指した側が勝った本の数
}
interface PosAgg {
  books: Set<string> // この局面から次の手がある本
  moves: Map<string, MoveAgg>
}
export type StatsIndex = Map<string, PosAgg>

export function buildStatsIndex(books: Book[]): StatsIndex {
  const idx: StatsIndex = new Map()
  for (const book of books) {
    const winner = winnerOf(book.meta?.result) // 引き分けは半勝として数える
    const walk = (id: string, pos: Pos) => {
      const n = book.nodes[id]
      if (n.children.length) {
        const key = toPosString(pos)
        let agg = idx.get(key)
        if (!agg) idx.set(key, (agg = { books: new Set(), moves: new Map() }))
        agg.books.add(book.id)
        for (const c of n.children) {
          const mv = book.nodes[c].move!
          let m = agg.moves.get(mv)
          if (!m) agg.moves.set(mv, (m = { books: new Set(), decided: 0, wins: 0 }))
          if (!m.books.has(book.id)) {
            m.books.add(book.id)
            if (winner !== null) {
              m.decided++
              if (winner === 'draw') m.wins += 0.5
              else if (winner === pos.turn) m.wins++
            }
          }
        }
      }
      for (const c of n.children) walk(c, applyMove(pos, strToMove(book.nodes[c].move!)))
    }
    walk(book.rootId, parsePos(book.rootPos))
  }
  return idx
}

export interface MoveStat {
  move: string
  count: number // この手が指された本の数
  rate: number // 出現率 0〜1
  winRate: number | null // 勝敗のある本が2局以上ある時だけ
}

/** 2局未満の局面は null（表示しない） */
export function nextMoveStats(idx: StatsIndex, pos: Pos): MoveStat[] | null {
  const agg = idx.get(toPosString(pos))
  if (!agg || agg.books.size < 2) return null
  const total = agg.books.size
  return [...agg.moves.entries()]
    .map(([move, m]) => ({
      move,
      count: m.books.size,
      rate: m.books.size / total,
      winRate: m.decided >= 2 ? m.wins / m.decided : null,
    }))
    .sort((a, b) => b.count - a.count)
}
