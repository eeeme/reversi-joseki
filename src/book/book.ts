// 定石ツリー（本）のデータモデルと操作
import { normalizeLine } from '../reversi/notation'
import { type Move, type Pos, START_POS, applyMove, canonicalKey, moveToStr, parsePos, strToMove, toPosString } from '../reversi/core'

export interface Srs {
  reps: number
  interval: number // 日
  ease: number
  due: number // epoch ms
  lapses: number
  last: number
}

export interface BookNode {
  id: string
  parent: string | null
  move: string | null // 'f5' / 'pass'。root は null
  children: string[] // 先頭が本線
  comment?: string
  label?: string
}

export interface Folder {
  id: string
  name: string
  review?: boolean // 今日の復習の対象にするフォルダ
  createdAt: number
}

/** 対局情報（棋譜のヘッダーから取り込む／手で編集） */
export interface GameMeta {
  black?: string
  white?: string
  date?: string
  event?: string
  result?: string // 黒勝ち / 白勝ち / 引き分け、または「黒 36 - 28」
}

export interface Book {
  id: string
  name: string
  folderId?: string // 未指定 = フォルダに入れない（一覧の直下）
  tags?: string[]
  bookmarks?: string[] // しおりを付けた局面のノードID
  meta?: GameMeta
  rootPos: string // 65文字の局面
  rootId: string
  nodes: Record<string, BookNode>
  srs: Record<string, Srs> // key = 自分が指す局面のノードID
  createdAt: number
  updatedAt: number
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function newBook(name: string, rootPos = START_POS, folderId?: string): Book {
  const rootId = uid()
  const now = Date.now()
  return {
    id: uid(), name, rootPos, rootId, folderId,
    nodes: { [rootId]: { id: rootId, parent: null, move: null, children: [] } },
    srs: {}, createdAt: now, updatedAt: now,
  }
}

export function pathTo(book: Book, id: string): string[] {
  const out: string[] = []
  let cur: string | null = id
  while (cur) {
    out.push(cur)
    cur = book.nodes[cur]?.parent ?? null
  }
  return out.reverse()
}

export const depthOf = (book: Book, id: string) => pathTo(book, id).length - 1

export interface NodeState {
  pos: Pos
  last: Move | null // 直前の手（パスを含む）
}

/** ノードの局面を再生して求める */
export function positionAt(book: Book, id: string): NodeState {
  let pos = parsePos(book.rootPos)
  let last: Move | null = null
  for (const nid of pathTo(book, id).slice(1)) {
    const m = strToMove(book.nodes[nid].move!)
    pos = applyMove(pos, m)
    last = m
  }
  return { pos, last }
}

/** ノードまでの手（'f5' の列。パスを含む） */
export function movesTo(book: Book, id: string): string[] {
  return pathTo(book, id).slice(1).map((n) => book.nodes[n].move!)
}

export function findChild(book: Book, id: string, move: string): string | null {
  return book.nodes[id].children.find((c) => book.nodes[c].move === move) ?? null
}

/** 子を追加（既にあればそのID）。本は破壊的に更新する */
export function addChild(book: Book, id: string, move: Move): { id: string; created: boolean } {
  const str = moveToStr(move)
  const exist = findChild(book, id, str)
  if (exist) return { id: exist, created: false }
  const nid = uid()
  book.nodes[nid] = { id: nid, parent: id, move: str, children: [] }
  book.nodes[id].children.push(nid)
  return { id: nid, created: true }
}

export function deleteSubtree(book: Book, id: string) {
  const node = book.nodes[id]
  if (!node.parent) return
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    stack.push(...book.nodes[cur].children)
    delete book.nodes[cur]
    delete book.srs[cur]
  }
  const p = book.nodes[node.parent]
  p.children = p.children.filter((c) => c !== id)
}

/** この手を親の本線（先頭）にする */
export function promoteToMain(book: Book, id: string) {
  const p = book.nodes[id].parent
  if (!p) return
  const ch = book.nodes[p].children
  book.nodes[p].children = [id, ...ch.filter((c) => c !== id)]
}

// ---------- 取り込み用の中間ツリー ----------
export interface ImportNode {
  move: string | null
  comment?: string
  children: ImportNode[]
}
export interface ImportTree {
  rootPos: string
  root: ImportNode
  title?: string
  meta?: GameMeta
}

export function mergeImport(book: Book, tree: ImportTree, atNode?: string): { added: number } {
  if (!atNode && tree.rootPos !== book.rootPos) {
    throw new Error('開始局面が本と異なるため統合できません')
  }
  let added = 0
  const walk = (src: ImportNode, dst: string) => {
    if (src.comment) {
      const n = book.nodes[dst]
      if (!n.comment) n.comment = src.comment
      else if (!n.comment.includes(src.comment)) n.comment += '\n' + src.comment
    }
    for (const ch of src.children) {
      const r = addChild(book, dst, strToMove(ch.move!))
      if (r.created) added++
      walk(ch, r.id)
    }
  }
  walk(tree.root, atNode ?? book.rootId)
  book.updatedAt = Date.now()
  return { added }
}

/** 本の手順を一本の手順列で辿り、外れた地点を返す */
export function followLine(book: Book, moves: string[]): { matched: number; nodeId: string } {
  let cur = book.rootId
  let matched = 0
  for (const u of moves) {
    const next = findChild(book, cur, u)
    if (!next) break
    cur = next
    matched++
  }
  return { matched, nodeId: cur }
}

/** 局面キー（対称形をまとめたもの）→ ノードID一覧（合流＝手順前後の検出） */
export function transpositionIndex(book: Book): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const walk = (id: string, pos: Pos) => {
    const key = canonicalKey(pos)
    const arr = map.get(key)
    if (arr) arr.push(id)
    else map.set(key, [id])
    for (const c of book.nodes[id].children) {
      walk(c, applyMove(pos, strToMove(book.nodes[c].move!)))
    }
  }
  walk(book.rootId, parsePos(book.rootPos))
  return map
}

export function countNodes(book: Book) {
  return Object.keys(book.nodes).length - 1
}

/** ノード以降（その局面から先）を取り込み用ツリーとして切り出す。メモも含む */
export function extractSubtree(book: Book, nodeId: string): ImportTree {
  const conv = (id: string): ImportNode => {
    const n = book.nodes[id]
    return { move: n.move, comment: n.comment, children: n.children.map(conv) }
  }
  const root = conv(nodeId)
  root.move = null
  return { rootPos: toPosString(positionAt(book, nodeId).pos), root }
}

/** 本の複製（別の本として保存する用）。練習の記録も引き継ぐ */
export function cloneBook(book: Book, name: string): Book {
  const c: Book = structuredClone(book)
  c.id = uid()
  c.name = name
  c.createdAt = c.updatedAt = Date.now()
  return c
}

/**
 * 盤で打った手を本に入れる形にする。
 * 初期配置の本の初手だけは、d3・c4・e6 も f5 にそろえる（盤ごと回した形で記録する）。
 */
export function toBookMove(book: Book, nodeId: string, m: Move): { move: string; rotated: boolean } {
  const s = moveToStr(m)
  if (nodeId !== book.rootId || book.rootPos !== START_POS) return { move: s, rotated: false }
  const n = normalizeLine([s])[0]
  return { move: n, rotated: n !== s }
}
