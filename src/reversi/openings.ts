// 定石の名前：手順（初手 f5 の向き）→ 名前。
// 一般に広く知られている名前と手順だけを手で入れる。足すときはこの表に1行足せばよい。
import { type Pos, START_POS, applyMove, canonicalKey, parsePos, strToMove } from './core'
import { splitMoves } from './notation'

export const OPENINGS: { name: string; moves: string }[] = [
  { name: '縦取り', moves: 'f5d6' },
  { name: '斜め取り', moves: 'f5f6' },
  { name: '並び取り', moves: 'f5f4' },
  { name: '虎', moves: 'f5d6c3d3c4' },
  { name: '牛', moves: 'f5d6c5f4e3' },
  { name: '兎', moves: 'f5f6e6f4e3' },
  { name: 'バッファロー', moves: 'f5f6e6f4c3' },
]

let index: Map<string, string> | null = null

/** 局面（対称形をまとめたキー）→ 名前 */
function openingIndex(): Map<string, string> {
  if (index) return index
  index = new Map()
  for (const o of OPENINGS) {
    let pos = parsePos(START_POS)
    for (const s of splitMoves(o.moves)) pos = applyMove(pos, strToMove(s))
    index.set(canonicalKey(pos), o.name)
  }
  return index
}

/** その局面がちょうど定石の形なら名前（向き・手順前後は問わない） */
export function openingAt(pos: Pos): string | null {
  return openingIndex().get(canonicalKey(pos)) ?? null
}

/** 手順をたどって、最後に成立した定石名（途中で外れていても、通った中で一番深いもの） */
export function openingOfLine(rootPos: string, moves: string[]): string | null {
  let pos = parsePos(rootPos)
  let name = openingAt(pos)
  for (const s of moves) {
    pos = applyMove(pos, strToMove(s))
    name = openingAt(pos) ?? name
  }
  return name
}
