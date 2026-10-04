import { useState } from 'react'
import { Tour } from './Tour'
import { type Book, followLine, mergeImport, newBook } from '../book/book'
import { mainLine, parseKifu } from '../reversi/kifu'
import { labelOf } from '../reversi/notation'

interface Props {
  books: Book[]
  initialTarget?: string
  onCreate: (b: Book) => void
  onChange: (b: Book) => void
  onOpen: (bookId: string, nodeId: string) => void
  onBack: () => void
}

type Mode = 'import' | 'check'

export function Import({ books, initialTarget, onCreate, onChange, onOpen, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('import')
  const [text, setText] = useState('')
  const [target, setTarget] = useState<string>(initialTarget ?? (books[0]?.id ?? 'new'))
  const [name, setName] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string; open?: { book: string; node: string } } | null>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const s = await f.text()
    setText(s)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  const run = () => {
    try {
      const tree = parseKifu(text)
      if (mode === 'import') {
        if (target === 'new') {
          const players = tree.meta?.black || tree.meta?.white ? `${tree.meta?.black ?? '？'} 対 ${tree.meta?.white ?? '？'}` : ''
          const b = newBook(name.trim() || players || tree.title || '新しい定石', tree.rootPos)
          b.meta = tree.meta
          const r = mergeImport(b, tree)
          onCreate(b)
          setResult({ ok: true, text: `${tree.format}を読み込み、新しい本に${r.added}手を追加しました。${rotNote(tree.normalized)}`, open: { book: b.id, node: b.rootId } })
        } else {
          const b = books.find((x) => x.id === target)!
          const r = mergeImport(b, tree)
          onChange(b)
          setResult({ ok: true, text: (r.added ? `${tree.format}を読み込み、「${b.name}」に${r.added}手を追加しました（既にある手は統合）。` : 'すべて既に登録済みの手でした。') + rotNote(tree.normalized), open: { book: b.id, node: b.rootId } })
        }
      } else {
        const b = books.find((x) => x.id === target)
        if (!b) throw new Error('照合する本を選んでください')
        if (tree.rootPos !== b.rootPos) throw new Error('開始局面がこの本と違うため照合できません')
        // 初期配置からの棋譜は、読み込んだ時点で初手が f5 にそろっている
        const line = mainLine(tree)
        const r = followLine(b, line)
        if (r.matched === line.length) {
          setResult({ ok: true, text: `最後の${line.length}手目まで、すべて定石どおりでした。`, open: { book: b.id, node: r.nodeId } })
        } else {
          const played = labelOf(line[r.matched])
          const book = b.nodes[r.nodeId].children.map((c) => labelOf(b.nodes[c].move!))
          const txt = r.matched === 0 && !book.length
            ? 'この本には手が登録されていません。'
            : `${r.matched + 1}手目 ${played} で定石を外れました。` +
              (book.length ? `定石は ${book.join(' / ')}。` : `（定石はここで終わり）`)
          setResult({ ok: false, text: txt, open: { book: b.id, node: r.nodeId } })
        }
      }
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message })
    }
  }

  const rotNote = (rot: boolean) => (rot ? '初手が f5 になるように盤の向きをそろえました。' : '')

  const bookPreview = (id: string) => {
    const b = books.find((x) => x.id === id)
    if (!b) return ''
    return `${Object.keys(b.nodes).length - 1}手`
  }

  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={onBack}>‹ 戻る</button>
        <h1 className="bar-title">棋譜</h1>
        <span />
      </header>
      <section className="panel setup">
        <div className="seg">
          <button className={mode === 'import' ? 'on' : ''} onClick={() => { setMode('import'); setResult(null) }}>取り込む</button>
          <button className={mode === 'check' ? 'on' : ''} onClick={() => { setMode('check'); setResult(null) }}>照合</button>
        </div>

        <label>{mode === 'import' ? '取り込み先' : '照合する本'}</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {mode === 'import' && <option value="new">＋ 新しい本を作る</option>}
          {books.map((b) => <option key={b.id} value={b.id}>{b.name}（{bookPreview(b.id)}）</option>)}
        </select>
        {mode === 'import' && target === 'new' && (
          <input placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} />
        )}

        <label>棋譜</label>
        <textarea
          className="kifu-input"
          rows={8}
          placeholder={'棋譜を貼り付け（例：f5d6c3d3c4）\n1行に1手順ずつ書くと、分岐付きで取り込みます'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="btn file">
          ファイルを選ぶ
          <input type="file" accept=".ggf,.txt" onChange={(e) => onFile(e.target.files?.[0])} hidden />
        </label>
        <button className="btn primary wide" disabled={!text.trim()} onClick={run}>
          {mode === 'import' ? '取り込む' : '照合する'}
        </button>
        {result && (
          <div className={`result ${result.ok ? 'good' : 'bad'}`}>
            <p>{result.text}</p>
            {result.open && (
              <button className="btn" onClick={() => onOpen(result.open!.book, result.open!.node)}>
                {mode === 'check' ? 'その局面を開く' : '本を開く'}
              </button>
            )}
          </div>
        )}
      </section>
      <Tour
        id="import"
        steps={[
          { sel: '.setup .seg', title: '取り込む・照合', text: '「取り込む」は棋譜を本にします。「照合」は自分の対局が何手目で定石を外れたかを調べます。' },
          { sel: '.kifu-input', title: '棋譜を貼り付け', text: 'f5d6c3… の棋譜文字列をそのまま貼り付けます。1行に1手順ずつ書くと分岐付きの本に、GGF や盤面図（X・O・- の8行）も読めます。' },
          { sel: '.btn.file', title: 'ファイルから', text: '.ggf や .txt の棋譜ファイルを選んで読み込むこともできます。' },
        ]}
      />
    </div>
  )
}

