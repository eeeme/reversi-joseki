// 棋譜の取り込み・書き出し：棋譜文字列／GGF／複数行（変化）／盤面図
import {
  type Cell, type Pos, PASS, START_POS, applyMove, countStones, isLegal, isOver, legalMoves, moveToStr, mustPass,
  parsePos, strToMove, toPosString,
} from './core'
import { colorMark, labelOf, normalizerFor, splitMoves, transformLine } from './notation'
import type { Book, GameMeta, ImportNode, ImportTree } from '../book/book'
import { movesTo, pathTo, positionAt } from '../book/book'

export type KifuFormat = '棋譜文字列' | 'GGF' | '複数行' | '盤面図'

export interface ParsedKifu extends ImportTree {
  format: KifuFormat
  /** 初手を f5 にそろえるために盤を回したか */
  normalized: boolean
}

// ---------- 手の列 → 木 ----------

/**
 * 局面 pos から手の列を打っていく。棋譜にパスが書かれていなくても、
 * 打てる場所がない側は自動でパスを挟む。打てない手があればエラー（何手目か付き）。
 */
export function playLine(rootPos: string, moves: string[], lineNo?: number): string[] {
  let pos = parsePos(rootPos)
  const out: string[] = []
  const where = lineNo ? `${lineNo}行目の` : ''
  moves.forEach((s, i) => {
    const m = strToMove(s)
    if (m !== PASS && mustPass(pos)) {
      out.push('pass')
      pos = applyMove(pos, PASS)
    }
    if (m === PASS && !mustPass(pos)) {
      // 不要なパス（打てる場所がある）は飛ばす
      return
    }
    if (!isLegal(pos, m)) {
      if (isOver(pos)) throw new Error(`${where}${i + 1}手目 ${labelOf(s)}：もう終局しています`)
      throw new Error(`${where}${i + 1}手目 ${labelOf(s)} は打てません`)
    }
    out.push(moveToStr(m))
    pos = applyMove(pos, m)
  })
  return out
}

function addLine(root: ImportNode, moves: string[]) {
  let cur = root
  for (const mv of moves) {
    let ch = cur.children.find((c) => c.move === mv)
    if (!ch) {
      ch = { move: mv, children: [] }
      cur.children.push(ch)
    }
    cur = ch
  }
}

/** 初期配置からの木：根の子ごとに初手が f5 になるよう回す（違う向きの同じ手順は1本にまとまる） */
function buildTree(rootPos: string, lines: string[][]): { root: ImportNode; normalized: boolean } {
  const root: ImportNode = { move: null, children: [] }
  let normalized = false
  for (const line of lines) {
    let l = line
    if (rootPos === START_POS) {
      const k = normalizerFor(line[0])
      if (k) normalized = true
      l = transformLine(line, k)
    }
    addLine(root, l)
  }
  return { root, normalized }
}

// ---------- 形式の判別 ----------

const BOARD_ROW = /^\s*[-XO*.●○xo]{8}\s*$/

export function detectFormat(text: string): KifuFormat {
  if (/\(\s*;/.test(text) && /\b(B|W|BO)\[/.test(text)) return 'GGF'
  const lines = text.split(/\r?\n/)
  if (lines.filter((l) => BOARD_ROW.test(l)).length >= 8) return '盤面図'
  const moveLines = lines.filter((l) => splitMoves(l).length > 0)
  if (moveLines.length > 1) return '複数行'
  if (moveLines.length === 1) return '棋譜文字列'
  throw new Error('棋譜を読み取れません（f5d6c3… の棋譜文字列・GGF・盤面図に対応）')
}

export function parseKifu(text: string): ParsedKifu {
  const format = detectFormat(text)
  if (format === 'GGF') return parseGgf(text)
  if (format === '盤面図') return parseDiagram(text)
  const lines = text.split(/\r?\n/).map(splitMoves).filter((l) => l.length > 0)
  let played: string[][]
  let fmt = format
  try {
    played = lines.map((l, i) => playLine(START_POS, l, lines.length > 1 ? i + 1 : undefined))
  } catch (e) {
    // 1局が途中で改行されているだけなら、つなげて1本として読む
    if (lines.length < 2) throw e
    try {
      played = [playLine(START_POS, lines.flat())]
      fmt = '棋譜文字列'
    } catch {
      throw e
    }
  }
  const { root, normalized } = buildTree(START_POS, played)
  const meta = played.length === 1 ? resultMeta(START_POS, played[0]) : undefined
  return { format: fmt, rootPos: START_POS, root, normalized, meta }
}

/** 終局まで打ち切った棋譜なら石数を勝敗として入れる */
function resultMeta(rootPos: string, moves: string[]): GameMeta | undefined {
  let pos = parsePos(rootPos)
  for (const s of moves) pos = applyMove(pos, strToMove(s))
  if (!isOver(pos)) return undefined
  return { result: scoreText(pos) }
}

export function scoreText(pos: Pos): string {
  const { black, white } = countStones(pos)
  return `黒 ${black} - ${white}`
}

/** 本の勝敗 → 0 = 黒勝ち / 1 = 白勝ち / 'draw' / null（不明） */
export function winnerOf(result: string | undefined): 0 | 1 | 'draw' | null {
  if (!result) return null
  const sc = /黒\s*(\d+)\s*[-－ー対]\s*(\d+)/.exec(result)
  if (sc) {
    const b = Number(sc[1])
    const w = Number(sc[2])
    return b > w ? 0 : w > b ? 1 : 'draw'
  }
  if (result.startsWith('黒勝')) return 0
  if (result.startsWith('白勝')) return 1
  if (result.startsWith('引')) return 'draw'
  return null
}

// ---------- 盤面図 ----------

function parseDiagram(text: string): ParsedKifu {
  const lines = text.split(/\r?\n/)
  const rows = lines.filter((l) => BOARD_ROW.test(l)).slice(0, 8)
  const board: Cell[] = []
  for (const r of rows) {
    for (const ch of r.trim()) board.push(ch === 'X' || ch === 'x' || ch === '*' || ch === '●' ? 1 : ch === 'O' || ch === 'o' || ch === '○' ? 2 : 0)
  }
  const rest = lines.slice(lines.indexOf(rows[7]) + 1).join('\n')
  const white = /白番|白の番|○番|^\s*O\s*$|turn\s*[:：]?\s*(O|white)/im.test(rest)
  const rootPos = toPosString({ board, turn: white ? 1 : 0 })
  const moves = splitMoves(rest.replace(/白番|黒番/g, ''))
  const root: ImportNode = { move: null, children: [] }
  if (moves.length) addLine(root, playLine(rootPos, moves))
  return { format: '盤面図', rootPos, root, normalized: false }
}

// ---------- GGF ----------

function tag(body: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|[\\];\\s])${name}\\[([^\\]]*)\\]`).exec(body)
  return m ? m[1].trim() : undefined
}

function parseGgf(text: string): ParsedKifu {
  const games = [...text.matchAll(/\(\s*;([\s\S]*?);\s*\)/g)].map((g) => g[1])
  if (!games.length) throw new Error('GGF の対局が見つかりません')
  const lines: string[][] = []
  let rootPos = START_POS
  let meta: GameMeta | undefined
  games.forEach((body, gi) => {
    const bo = tag(body, 'BO')
    let start = START_POS
    if (bo) {
      const t = bo.replace(/\s+/g, '')
      // 先頭の 8 は盤の大きさ、最後の1文字が手番（* = 黒, O = 白）
      const cells = t.replace(/^8/, '')
      if (cells.length >= 65) {
        const board = [...cells.slice(0, 64)].map((ch) => (ch === '*' ? 1 : ch === 'O' ? 2 : 0)) as Cell[]
        start = toPosString({ board, turn: cells[64] === 'O' ? 1 : 0 })
      }
    }
    if (gi === 0) rootPos = start
    else if (start !== rootPos) throw new Error(`${gi + 1}局目の開始局面が1局目と違います`)
    const moves = [...body.matchAll(/(?:^|[\];\s])([BW])\[([^\]/]*)/g)].map((m) => m[2].trim().toLowerCase())
    lines.push(playLine(start, moves.map((s) => (s === 'pa' || s === 'pass' ? 'pass' : s)), games.length > 1 ? gi + 1 : undefined))
    if (gi === 0) {
      const re = tag(body, 'RE')
      let result: string | undefined
      if (re) {
        const v = Number(re.replace(/[^0-9.+-]/g, ''))
        if (!Number.isNaN(v)) result = v > 0 ? '黒勝ち' : v < 0 ? '白勝ち' : '引き分け'
      }
      const end = resultMeta(start, lines[0])
      meta = {
        black: tag(body, 'PB') || undefined,
        white: tag(body, 'PW') || undefined,
        date: tag(body, 'DT')?.split(/\s/)[0].replace(/\./g, '/') || undefined,
        event: tag(body, 'PC') || undefined,
        result: end?.result ?? result,
      }
      for (const k of Object.keys(meta) as (keyof GameMeta)[]) if (!meta[k]) delete meta[k]
      if (!Object.keys(meta).length) meta = undefined
    }
  })
  const { root, normalized } = buildTree(rootPos, lines)
  return { format: 'GGF', rootPos, root, normalized, meta: games.length === 1 ? meta : undefined }
}

/** 取り込み木の本線（先頭の子をたどる） */
export function mainLine(tree: ImportTree): string[] {
  const out: string[] = []
  let cur = tree.root
  while (cur.children[0]) {
    cur = cur.children[0]
    out.push(cur.move!)
  }
  return out
}

// ---------- 書き出し ----------

const lineText = (moves: string[]) => moves.filter((m) => m !== 'pass').join('')

/** 本線を棋譜文字列で（パスは書かない） */
export function exportMainLine(book: Book): string {
  let cur = book.nodes[book.rootId]
  const out: string[] = []
  while (cur.children[0]) {
    cur = book.nodes[cur.children[0]]
    out.push(cur.move!)
  }
  return lineText(out)
}

/** 全変化を1行ずつ（末端ごとに1行） */
export function exportAllLines(book: Book): string {
  const leaves = Object.values(book.nodes).filter((n) => n.children.length === 0 && n.parent)
  // 木の並び順（本線が先）にそろえる
  const order: string[] = []
  const walk = (id: string) => {
    const n = book.nodes[id]
    if (!n.children.length && n.parent) order.push(id)
    n.children.forEach(walk)
  }
  walk(book.rootId)
  const sorted = order.length ? order : leaves.map((l) => l.id)
  const head = book.rootPos === START_POS ? [] : [diagram(parsePos(book.rootPos)), '']
  return [...head, ...sorted.map((id) => lineText(movesTo(book, id)))].join('\n') + '\n'
}

/** 8行の盤面図（X 黒・O 白・- 空）と手番 */
export function diagram(pos: Pos): string {
  const rows: string[] = []
  for (let r = 0; r < 8; r++) {
    rows.push(pos.board.slice(r * 8, r * 8 + 8).map((c) => (c === 1 ? 'X' : c === 2 ? 'O' : '-')).join(''))
  }
  return [...rows, pos.turn === 0 ? '黒番' : '白番'].join('\n')
}

/** AI などに渡すための局面テキスト（盤面図＋局面文字列＋ここまでの手順＋メモ） */
export function positionText(book: Book, nodeId: string): string {
  const { pos } = positionAt(book, nodeId)
  const moves = movesTo(book, nodeId)
  const { black, white } = countStones(pos)
  const ply = pathTo(book, nodeId).length - 1
  const lines = [
    `局面：${book.name}　${ply}手目${moves.length ? `（${labelOf(moves.at(-1)!)}まで）` : '（開始局面）'}`,
    ...(book.meta?.black || book.meta?.white ? [`対局者：●${book.meta?.black ?? ''} ○${book.meta?.white ?? ''}`] : []),
    '',
    '  abcdefgh',
    ...diagram(pos).split('\n').slice(0, 8).map((r, i) => `${i + 1} ${r}`),
    `${pos.turn === 0 ? '黒' : '白'}番　石数 ${colorMark(0)}${black} ${colorMark(1)}${white}　打てる場所 ${legalMoves(pos).map((m) => moveToStr(m)).join(' ') || 'なし'}`,
    '',
    `局面文字列：${toPosString(pos)}`,
  ]
  if (moves.length) lines.push('', `手順：${lineText(moves)}`)
  const memo = book.nodes[nodeId].comment
  if (memo) lines.push('', `メモ：${memo}`)
  return lines.join('\n')
}
