// 局面検索：完全一致（対称形も含む）と、石の置き方の重なり具合で似た局面を探す
import { type Pos, applyMove, canonicalKey, parsePos, strToMove, toPosString, transformPos } from '../reversi/core'
import type { Book } from './book'

export interface Hit {
  bookId: string
  nodeId: string
  pos: string // 局面文字列（本の向きのまま）
  score: number // 1 = 完全一致
  ply: number
}

/** 両方で石があるマスのうち、同じ色のマスの割合（1つの向きだけで比べる） */
function overlap(a: Pos, b: Pos): number {
  let inter = 0
  let union = 0
  for (let i = 0; i < 64; i++) {
    const x = a.board[i]
    const y = b.board[i]
    if (!x && !y) continue
    union++
    if (x === y) inter++
  }
  const s = union ? inter / union : 1
  return a.turn === b.turn ? s : s * 0.95
}

/** 8つの対称形すべてで比べて、一番高い値 */
export function similarity(a: Pos, b: Pos): number {
  let best = 0
  for (let k = 0; k < 8; k++) best = Math.max(best, overlap(a, transformPos(b, k)))
  return best
}

export function searchPositions(books: Book[], query: Pos, opts: { limit?: number; min?: number } = {}) {
  const limit = opts.limit ?? 30
  const min = opts.min ?? 0.6
  const qKey = canonicalKey(query)
  const exact: Hit[] = []
  const similar: Hit[] = []
  for (const book of books) {
    const seen = new Set<string>() // 同じ本の中の合流は1件にまとめる
    const walk = (id: string, pos: Pos, ply: number) => {
      const key = canonicalKey(pos)
      if (!seen.has(key)) {
        seen.add(key)
        if (key === qKey) exact.push({ bookId: book.id, nodeId: id, pos: toPosString(pos), score: 1, ply })
        else {
          const s = similarity(query, pos)
          if (s >= min) similar.push({ bookId: book.id, nodeId: id, pos: toPosString(pos), score: s, ply })
        }
      }
      for (const c of book.nodes[id].children) walk(c, applyMove(pos, strToMove(book.nodes[c].move!)), ply + 1)
    }
    walk(book.rootId, parsePos(book.rootPos), 0)
  }
  similar.sort((a, b) => b.score - a.score || a.ply - b.ply)
  return { exact, similar: similar.slice(0, limit) }
}
