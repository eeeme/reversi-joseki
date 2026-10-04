// 表記：画面に出す手の書き方と、初手を f5 にそろえる正規化
import {
  type Color, type Move, type Pos, PASS, START_POS, moveToStr, parsePos, strToMove, toPosString,
  transformMove, transformPos,
} from './core'

export const colorMark = (c: Color) => (c === 0 ? '●' : '○')
export const colorName = (c: Color) => (c === 0 ? '黒' : '白')

/** 「F5」「パス」 */
export function moveLabel(m: Move): string {
  return m === PASS ? 'パス' : moveToStr(m).toUpperCase()
}

/** 「● F5」「○ パス」 */
export function moveLabelWithColor(pos: Pos, m: Move): string {
  return `${colorMark(pos.turn)} ${moveLabel(m)}`
}

/** 手を表す文字列（保存形式 'f5' / 'pass'）から表示用ラベル */
export const labelOf = (s: string) => moveLabel(strToMove(s))

/** 棋譜文字列（f5d6c3… 大文字・空白・改行・区切り記号まじりでもよい）を手の列に分ける */
export function splitMoves(text: string): string[] {
  const t = text.toLowerCase().replace(/pass|pa|ps/g, ' pass ')
  const out: string[] = []
  const re = /pass|[a-h][1-8]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) out.push(m[0])
  return out
}

/** 初期配置を変えない対称変換（恒等・180度回転・2本の対角線での反転） */
const START_SYMS = [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => toPosString(transformPos(parsePos(START_POS), k)) === START_POS)

const F5 = strToMove('f5')

/** 初手を f5 にする変換番号。初手がパスや f5 以外に移せない手なら 0（変換しない） */
export function normalizerFor(first: string | null | undefined): number {
  if (!first || first === 'pass') return 0
  const m = strToMove(first)
  return START_SYMS.find((k) => transformMove(m, k) === F5) ?? 0
}

/** 手の列に変換をかける */
export function transformLine(moves: string[], k: number): string[] {
  if (!k) return moves
  return moves.map((s) => moveToStr(transformMove(strToMove(s), k)))
}

/** 初期配置からの手順を、初手が f5 になるように盤ごと回す */
export function normalizeLine(moves: string[]): string[] {
  return transformLine(moves, normalizerFor(moves[0]))
}
