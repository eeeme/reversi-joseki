import { Lbl } from './Lbl'
import { Feedback, useFeedback } from './Feedback'
import { useMemo, useState } from 'react'
import { Tour } from './Tour'
import { type Move, PASS, applyMove, canonicalKey, isOver, mustPass, strToMove, toPosString } from '../reversi/core'
import { moveLabelWithColor } from '../reversi/notation'
import {
  type Book, addChild, deleteSubtree, findChild, movesTo, pathTo, positionAt, promoteToMain, toBookMove, transpositionIndex,
} from '../book/book'
import { Board } from './Board'
import { TreeView } from './TreeView'
import { Sheets, type SheetOpen } from './Sheets'
import { type StatsIndex, nextMoveStats } from '../book/stats'
import { metaLine } from './Forms'
import { copyText } from '../copy'
import { exportAllLines, exportMainLine, positionText, scoreText } from '../reversi/kifu'
import { openingAt, openingOfLine } from '../reversi/openings'

interface Props {
  book: Book
  rev: number
  nodeId: string
  setNodeId: (id: string) => void
  onChange: () => void
  onBack: () => void
  onDrill: (fromNode: string) => void
  onImport: () => void
  onEditPosition: (pos: string) => void
  onSearch: (pos: string) => void
  /** 検索結果から開いた時：虫眼鏡を使えなくし、戻る先を検索元にする */
  fromSearch?: boolean
  /** 一致した局面から開いた時だけ：検索元とマージ */
  onMerge?: () => void
  stats: StatsIndex
  toast: (s: string) => void
}

export function Explore({ book, rev, nodeId, setNodeId, onChange, onBack, onDrill, onImport, onEditPosition, onSearch, fromSearch, onMerge, stats, toast }: Props) {
  // 空の本は最初から編集モード
  const [edit, setEdit] = useState(() => book.nodes[book.rootId].children.length === 0)
  const [flipped, setFlipped] = useState(false)
  const [sheet, setSheet] = useState<SheetOpen>('none')

  const node = book.nodes[nodeId] ?? book.nodes[book.rootId]
  const { pos, last } = useMemo(() => positionAt(book, node.id), [book, node.id, rev])

  const path = useMemo(() => pathTo(book, node.id), [book, node.id, rev])
  const nowLabel = useMemo(() => {
    if (!node.move || !node.parent) return '開始局面'
    return moveLabelWithColor(positionAt(book, node.parent).pos, strToMove(node.move))
  }, [book, node])
  // その局面で成立している定石名（通ってきた中で一番深いもの）
  const opening = useMemo(() => openingOfLine(book.rootPos, movesTo(book, node.id)), [book, node.id, rev])
  const exactOpening = useMemo(() => openingAt(pos), [pos])

  const children = node.children.map((c) => {
    const mv = book.nodes[c].move!
    const after = applyMove(pos, strToMove(mv))
    return { id: c, move: mv, label: moveLabelWithColor(pos, strToMove(mv)), name: openingAt(after) }
  })
  const over = isOver(pos)
  const { fb, fire } = useFeedback()

  /**
   * その局面へ進む。打てる場所がない手番なら、パスを自動で挟んで次の手番まで進め、エフェクトを出す。
   * 編集中で本にまだパスが無ければ、パスを追加する。
   */
  const go = (id: string) => {
    const p = positionAt(book, id).pos
    if (mustPass(p)) {
      let passId = findChild(book, id, 'pass')
      if (!passId && edit) {
        passId = addChild(book, id, PASS).id
        onChange()
      }
      if (passId) {
        fire('pass', `${p.turn === 0 ? '黒' : '白'}は打てる場所がありません`)
        return setNodeId(passId)
      }
    }
    setNodeId(id)
  }
  /** 1手戻る。パスの直後なら、パスも一緒に戻す */
  const back = () => {
    if (!node.parent) return
    const p = book.nodes[node.parent]
    setNodeId(p.move === 'pass' && p.parent ? p.parent : p.id)
  }
  // 全部の本の集計（2局未満の局面は null）
  const moveStats = useMemo(() => nextMoveStats(stats, pos), [stats, pos])
  const statOf = (mv: string) => moveStats?.find((s) => s.move === mv)
  const statText = (mv: string) => {
    const s = statOf(mv)
    if (!s) return ''
    return `${Math.round(s.rate * 100)}%・${s.count}局${s.winRate !== null ? `・勝率${Math.round(s.winRate * 100)}%` : ''}`
  }
  // この本には無いが、他の本で指されている手
  const others = (moveStats ?? []).filter((s) => !node.children.some((c) => book.nodes[c].move === s.move))
  const marked = book.bookmarks?.includes(node.id) ?? false
  const toggleMark = () => {
    const set = new Set(book.bookmarks ?? [])
    if (set.has(node.id)) set.delete(node.id)
    else set.add(node.id)
    book.bookmarks = set.size ? [...set] : undefined
    onChange()
  }

  const transposed = useMemo(() => {
    const idx = transpositionIndex(book)
    return (idx.get(canonicalKey(pos)) ?? []).filter((id) => id !== node.id)
  }, [book, pos, node.id, rev])

  const onMove = (m: Move) => {
    const { move, rotated } = toBookMove(book, node.id, m)
    const exist = findChild(book, node.id, move)
    if (exist) {
      if (rotated) toast('初手は f5 にそろえて表示します')
      return go(exist)
    }
    if (!edit) {
      toast('定石にない手')
      return
    }
    const r = addChild(book, node.id, strToMove(move))
    if (rotated) toast('初手は f5 にそろえて記録します')
    onChange()
    go(r.id)
  }

  const goFirstChild = () => node.children[0] && go(node.children[0])
  const goLeaf = () => {
    let cur = node
    while (cur.children[0]) cur = book.nodes[cur.children[0]]
    setNodeId(cur.id)
  }


  const screen = (
    <div className="screen fit">
      <header className="bar">
        <button className="btn ghost" onClick={onBack}>{fromSearch ? '‹ 戻る' : '‹ 一覧'}</button>
        <h1
          className="bar-title"
          onClick={() => {
            const name = prompt('本の名前', book.name)
            if (name?.trim()) { book.name = name.trim(); onChange() }
          }}
        >{book.name}</h1>
        {onMerge
          ? <button className="btn primary" onClick={onMerge}>マージ</button>
          : <button className="btn primary" onClick={() => onDrill(node.id)}>練習</button>}
      </header>
      {metaLine(book.meta) && <p className="meta-line">{metaLine(book.meta)}</p>}

      <div className="stage">
      <div className="board-fb">
        <Board
          pos={pos}
          flipped={flipped}
          last={last}
          onMove={onMove}
          onTapSide={edit ? undefined : (side) => (side === 'right' ? goFirstChild() : back())}
        />
        <Feedback kind={fb.kind} seq={fb.seq} label={fb.label} />
      </div>

      <div className="nav">
        <button className="btn" onClick={() => setNodeId(book.rootId)} aria-label="最初へ">⏮</button>
        <button className="btn" onClick={back} aria-label="1手戻る">◀</button>
        <span className="nav-now"><Lbl text={nowLabel} /><small>{path.length - 1}手目</small></span>
        <button className="btn" onClick={goFirstChild} aria-label="本線で1手進む">▶</button>
        <button className="btn" onClick={goLeaf} aria-label="本線の最後へ">⏭</button>
        <button className="icon-btn" onClick={() => onSearch(toPosString(pos))} aria-label="この局面を検索" disabled={fromSearch}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M15 15l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <button className={`icon-btn ${marked ? 'on' : ''}`} onClick={toggleMark} aria-label="しおり" aria-pressed={marked}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4h10v16l-5-4-5 4z" fill={marked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
        </button>
        <button
          className="icon-btn"
          onClick={async () => toast((await copyText(positionText(book, node.id))) ? '局面をコピーしました' : 'コピーできませんでした')}
          aria-label="局面をテキストでコピー"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M5 15V6a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <button className={`icon-btn ${edit ? 'on' : ''}`} onClick={() => setEdit(!edit)} aria-label="編集" aria-pressed={edit}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z M14 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </button>
        <button className={`icon-btn ${flipped ? 'on' : ''}`} onClick={() => setFlipped(!flipped)} aria-label="盤を回す" aria-pressed={flipped}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 20V5M4 9l4-4 4 4M16 4v15M12 15l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </button>
      </div>
      </div>

      <section className="panel next-panel">
          <p className="panel-label">
            次の手
            {opening && <span className={`opening-name ${exactOpening ? 'exact' : ''}`}>{exactOpening ? '' : '〜 '}{opening}</span>}
            {over && <span className="over-tag">終局　{scoreText(pos)}</span>}
          </p>
          <div className="choices hscroll">
            {children.map((c, i) => (
              <button key={c.id} className={`choice ${i === 0 ? 'main' : ''}`} onClick={() => go(c.id)}>
                <span className="choice-move">
                  <Lbl text={c.label} />
                  {i === 0 && children.length > 1 && <small>本線</small>}
                  {c.name && <small className="choice-name">{c.name}</small>}
                </span>
                <span className="choice-stat">{statText(c.move) || '\u00a0'}</span>
              </button>
            ))}
            {others.map((s) => (
              <button
                key={s.move}
                className="choice other"
                onClick={() => {
                  if (!edit) return toast('✏で追加')
                  const r = addChild(book, node.id, strToMove(s.move))
                  onChange()
                  go(r.id)
                }}
              >
                <span className="choice-move"><Lbl text={moveLabelWithColor(pos, strToMove(s.move))} /></span>
                <span className="choice-stat">{statText(s.move)}</span>
              </button>
            ))}
          </div>
          {transposed.length > 0 && (
            <button className="chip" onClick={() => setNodeId(transposed[0])}>⇄ 合流 {transposed.length}</button>
          )}
          {edit && (
            <div className="edit-actions hscroll">
              <button className="chip" onClick={() => onEditPosition(toPosString(pos))}>この局面から新規作成</button>
              {node.move && book.nodes[node.parent!].children[0] !== node.id && (
                <button className="chip" onClick={() => { promoteToMain(book, node.id); onChange() }}>本線にする</button>
              )}
              {node.move && (
                <button
                  className="chip danger"
                  onClick={() => {
                    if (!confirm('この手以降をすべて削除しますか？')) return
                    const p = node.parent!
                    deleteSubtree(book, node.id)
                    onChange()
                    setNodeId(p)
                  }}
                >この手以降を削除</button>
              )}
            </div>
          )}
      </section>
    </div>
  )

  const panel = (
    <div className="drawer-body">
      <div className="drawer-head">
        <span>定石ツリー</span>
      </div>
      <TreeView book={book} rev={rev} currentId={node.id} onSelect={setNodeId} />
      <div className="row gap">
        <button className="chip" onClick={onImport}>棋譜を取込</button>
        <button
          className="chip"
          onClick={async () => toast((await copyText(exportMainLine(book))) ? '本線をコピーしました' : 'コピーできませんでした')}
        >本線をコピー</button>
        <button
          className="chip"
          onClick={async () => toast((await copyText(exportAllLines(book))) ? '全変化をコピーしました' : 'コピーできませんでした')}
        >全変化をコピー</button>
      </div>
    </div>
  )

  const memo = (
    <div className="memo-body">
      <div className="memo-grab" />
      <div className="memo-head">
        <span>メモ</span>
        <small><Lbl text={nowLabel} />　{path.length - 1}手目</small>
      </div>
      <textarea
        key={node.id}
        className="memo-text"
        placeholder="メモ"
        defaultValue={node.comment ?? ''}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if ((node.comment ?? '') !== v) {
            node.comment = v || undefined
            onChange()
          }
        }}
      />
    </div>
  )

  return (
    <>
      <Sheets open={sheet} onOpenChange={setSheet} area={screen} tree={panel} memo={memo} memoFilled={!!node.comment} />
      <Tour
        id="explore"
        when={sheet === 'none' && !fromSearch}
        steps={[
          { sel: '.board', title: '盤をタップして進む・戻る', text: '盤の右半分をタップすると1手進み、左半分をタップすると1手戻ります。' },
          { sel: '.nav', title: '手順の移動', text: '最初へ・1手戻る・1手進む・最後へ。今の手と手数が真ん中に出ます。' },
          { sel: '.next-panel', title: '次の手', text: '分岐があれば並びます。タップでその手に進みます。数字は、全部の本でその手が打たれた割合と局数です。定石の名前があれば一緒に出ます。' },
          { sel: '[aria-label="編集"]', title: '編集', text: 'オンにすると、盤に石を打って手を追加できます。本線の入れ替えや削除もここから。' },
          { sel: '[aria-label="盤を回す"]', title: '盤を回す', text: '盤を180度回して、白の側から見た向きにします。' },
          { sel: '[aria-label="この局面を検索"]', title: 'この局面を検索', text: '同じ局面が他の本に出てくるかを探します。一致した本からは手順をマージできます。' },
          { sel: '[aria-label="しおり"]', title: 'しおり', text: 'あとで見返したい局面に印を付けると、一覧の上に並びます。' },
          { sel: '[aria-label="局面をテキストでコピー"]', title: '局面をコピー', text: '今の局面をテキストでコピーします。AIに貼り付けて分析してもらうときに使えます。' },
          { sel: '.drawer-handle', title: 'ツリー', text: '画面を左へスワイプすると、右から定石ツリーが出てきます。分岐の全体を見渡せます。' },
          { sel: '.memo-handle', title: 'メモ', text: '画面を上へスワイプすると、下からこの局面のメモが出てきます。' },
          { sel: '.bar .btn.primary', title: '練習', text: 'この本で練習を始めます。今の局面から始めることもできます。' },
        ]}
      />
      <Tour
        id="tree"
        when={sheet === 'tree'}
        steps={[
          { sel: '.drawer .tree-box', title: '定石ツリー', text: '下へ行くほど手が進み、右の列が変化です。指で上下左右に動かせます。手をタップするとその局面に移動します。' },
          { sel: '.drawer .row', title: '棋譜の取り込み・コピー', text: 'この本に棋譜を足したり、本線や全部の変化を棋譜文字列でコピーしたりできます。右へスワイプで閉じます。' },
        ]}
      />
      <Tour
        id="memo"
        when={sheet === 'memo'}
        steps={[{ sel: '.memo-text', title: 'メモ', text: 'この局面の狙いや注意点を書いておけます。閉じると自動で保存されます。下へスワイプで閉じます。' }]}
      />
    </>
  )
}
