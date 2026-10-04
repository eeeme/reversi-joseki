// リバーシの最小コア：局面・合法手・着手・パス・終局・局面文字列
export type Color = 0 | 1 // 0 = 黒（先手）, 1 = 白
export type Cell = 0 | 1 | 2 // 0 = 空, 1 = 黒, 2 = 白

export interface Pos {
  board: Cell[] // 64マス。a1=0, b1=1 … h1=7, a2=8 … h8=63
  turn: Color
}

/** 1手：0〜63 のマス、または PASS */
export type Move = number
export const PASS = -1

export const SIZE = 8
export const colOf = (sq: number) => sq % 8 // 0 = a
export const rowOf = (sq: number) => Math.floor(sq / 8) // 0 = 1行目
export const sqAt = (col: number, row: number) => row * 8 + col

export const stoneOf = (c: Color): Cell => (c === 0 ? 1 : 2)
export const other = (c: Color): Color => (c === 0 ? 1 : 0)

const DIRS: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

/** 局面文字列の64文字＋手番1文字。'-' 空・'X' 黒・'O' 白 */
export const START_POS = '---------------------------OX------XO---------------------------X'

export function parsePos(s: string): Pos {
  const t = s.trim()
  if (t.length !== 65 || !/^[-XO]{64}[XO]$/.test(t)) throw new Error('局面の文字列が正しくありません')
  const board = [...t.slice(0, 64)].map((ch) => (ch === 'X' ? 1 : ch === 'O' ? 2 : 0)) as Cell[]
  return { board, turn: t[64] === 'X' ? 0 : 1 }
}

export function toPosString(pos: Pos): string {
  return pos.board.map((c) => (c === 1 ? 'X' : c === 2 ? 'O' : '-')).join('') + (pos.turn === 0 ? 'X' : 'O')
}

export const startPos = () => parsePos(START_POS)
export const clonePos = (p: Pos): Pos => ({ board: p.board.slice(), turn: p.turn })

/** その色が sq に打ったときに返る石 */
export function flipsFor(pos: Pos, sq: number, c: Color = pos.turn): number[] {
  if (sq < 0 || sq > 63 || pos.board[sq] !== 0) return []
  const me = stoneOf(c)
  const op = stoneOf(other(c))
  const out: number[] = []
  const x0 = colOf(sq)
  const y0 = rowOf(sq)
  for (const [dx, dy] of DIRS) {
    const line: number[] = []
    let x = x0 + dx
    let y = y0 + dy
    while (x >= 0 && x < 8 && y >= 0 && y < 8 && pos.board[sqAt(x, y)] === op) {
      line.push(sqAt(x, y))
      x += dx
      y += dy
    }
    if (line.length && x >= 0 && x < 8 && y >= 0 && y < 8 && pos.board[sqAt(x, y)] === me) out.push(...line)
  }
  return out
}

/** 手番側の合法手（マスの一覧）。打てる場所がなければ空 */
export function legalMoves(pos: Pos, c: Color = pos.turn): number[] {
  const out: number[] = []
  for (let i = 0; i < 64; i++) if (pos.board[i] === 0 && flipsFor(pos, i, c).length) out.push(i)
  return out
}

/** パスしかできない（打てる場所がない）が、相手は打てる */
export const mustPass = (pos: Pos) => legalMoves(pos).length === 0 && legalMoves(pos, other(pos.turn)).length > 0
/** 両者とも打てない */
export const isOver = (pos: Pos) => legalMoves(pos).length === 0 && legalMoves(pos, other(pos.turn)).length === 0

/** 合法手かどうか（パスはパスしかできない時だけ合法） */
export function isLegal(pos: Pos, m: Move): boolean {
  if (m === PASS) return mustPass(pos)
  return flipsFor(pos, m).length > 0
}

export function applyMove(pos: Pos, m: Move): Pos {
  const n = clonePos(pos)
  if (m !== PASS) {
    const flips = flipsFor(pos, m)
    if (!flips.length) throw new Error('そこには打てません')
    const me = stoneOf(pos.turn)
    n.board[m] = me
    for (const f of flips) n.board[f] = me
  }
  n.turn = other(pos.turn)
  return n
}

export function countStones(pos: Pos): { black: number; white: number } {
  let black = 0
  let white = 0
  for (const c of pos.board) {
    if (c === 1) black++
    else if (c === 2) white++
  }
  return { black, white }
}

// ---------- 座標表記 ----------
export function moveToStr(m: Move): string {
  if (m === PASS) return 'pass'
  return 'abcdefgh'[colOf(m)] + (rowOf(m) + 1)
}

export function strToMove(s: string): Move {
  const t = s.trim().toLowerCase()
  if (t === 'pass' || t === 'pa' || t === 'ps' || t === '--') return PASS
  const m = /^([a-h])([1-8])$/.exec(t)
  if (!m) throw new Error(`手の表記が正しくありません: ${s}`)
  return sqAt(m[1].charCodeAt(0) - 97, Number(m[2]) - 1)
}

// ---------- 対称変換（8通り） ----------
/** k = 0〜7。マス → 変換後のマス */
export function transformSq(sq: number, k: number): number {
  let x = colOf(sq)
  let y = rowOf(sq)
  if (k & 4) [x, y] = [y, x] // 主対角線（a1-h8）で反転
  if (k & 1) x = 7 - x // 左右反転
  if (k & 2) y = 7 - y // 上下反転
  return sqAt(x, y)
}

export function transformMove(m: Move, k: number): Move {
  return m === PASS ? PASS : transformSq(m, k)
}

export function transformPos(pos: Pos, k: number): Pos {
  const board = new Array<Cell>(64)
  for (let i = 0; i < 64; i++) board[transformSq(i, k)] = pos.board[i]
  return { board, turn: pos.turn }
}

/** 8つの対称形のうち文字列が一番小さいもの（向きの違う同じ局面を同一視するキー） */
export function canonicalKey(pos: Pos): string {
  let best = ''
  for (let k = 0; k < 8; k++) {
    const s = toPosString(transformPos(pos, k))
    if (!best || s < best) best = s
  }
  return best
}

export const isStartPos = (s: string) => s === START_POS
