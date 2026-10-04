import { describe, expect, it } from 'vitest'
import {
  PASS, START_POS, applyMove, canonicalKey, countStones, isOver, legalMoves, moveToStr, mustPass, parsePos,
  strToMove, toPosString, transformPos,
} from './core'
import { normalizeLine, splitMoves } from './notation'
import { diagram, exportAllLines, exportMainLine, mainLine, parseKifu, playLine, winnerOf } from './kifu'
import { openingAt, openingOfLine } from './openings'
import { mergeImport, newBook } from '../book/book'
import { similarity } from '../book/search'

const play = (moves: string) => {
  let pos = parsePos(START_POS)
  for (const s of splitMoves(moves)) pos = applyMove(pos, strToMove(s))
  return pos
}
const names = (ms: number[]) => ms.map(moveToStr).sort()

describe('ルール', () => {
  it('初期配置', () => {
    const p = parsePos(START_POS)
    expect(p.board[strToMove('d4')]).toBe(2)
    expect(p.board[strToMove('e5')]).toBe(2)
    expect(p.board[strToMove('d5')]).toBe(1)
    expect(p.board[strToMove('e4')]).toBe(1)
    expect(p.turn).toBe(0)
    expect(toPosString(p)).toBe(START_POS)
    expect(names(legalMoves(p))).toEqual(['c4', 'd3', 'e6', 'f5'])
  })

  it('f5 d6 c3 … の石数と合法手', () => {
    const p1 = play('f5')
    expect(countStones(p1)).toEqual({ black: 4, white: 1 })
    expect(names(legalMoves(p1))).toEqual(['d6', 'f4', 'f6'])
    const p2 = play('f5d6')
    expect(countStones(p2)).toEqual({ black: 3, white: 3 })
    const p3 = play('f5d6c3')
    expect(countStones(p3)).toEqual({ black: 5, white: 2 })
    expect(p3.board[strToMove('d4')]).toBe(1)
    expect(legalMoves(p3).map(moveToStr)).toContain('d3')
    const p5 = play('f5d6c3d3c4')
    const { black, white } = countStones(p5)
    expect(black + white).toBe(9)
    expect(p5.turn).toBe(1)
  })

  it('打てない手はエラー', () => {
    expect(() => applyMove(parsePos(START_POS), strToMove('a1'))).toThrow()
    expect(() => playLine(START_POS, ['f5', 'f5'])).toThrow(/2手目/)
  })

  it('パスと終局', () => {
    // 盤が全部黒：どちらも打てない → 終局
    expect(isOver(parsePos(toPosString({ board: Array(64).fill(1), turn: 0 })))).toBe(true)
    // a1 黒・b1 白、白番：白は打てない／黒は c1 に打てる → 白はパス
    const b = Array(64).fill(0)
    b[strToMove('a1')] = 1
    b[strToMove('b1')] = 2
    const p = { board: b, turn: 1 as const }
    expect(legalMoves(p)).toEqual([])
    expect(mustPass(p)).toBe(true)
    expect(isOver(p)).toBe(false)
    expect(applyMove(p, PASS).turn).toBe(0)
  })

  it('棋譜にパスが書かれていなくても自動で挟む', () => {
    const b = Array(64).fill(0)
    b[strToMove('a1')] = 1
    b[strToMove('b1')] = 2
    const root = toPosString({ board: b, turn: 1 })
    // 白番だが白は打てない → 自動パス → 黒 c1
    expect(playLine(root, ['c1'])).toEqual(['pass', 'c1'])
  })
})

describe('正規化（初手を f5 に）', () => {
  it('d3 始まりが f5 始まりに直る', () => {
    expect(normalizeLine(['d3', 'c3', 'c4'])).toEqual(['f5', 'f6', 'e6'])
  })
  it('4つの初手すべて f5 に', () => {
    for (const first of ['f5', 'd3', 'c4', 'e6']) expect(normalizeLine([first])[0]).toBe('f5')
  })
  it('正規化しても手順は合法で、局面は対称形', () => {
    const raw = ['c4', 'c3', 'd3', 'e3', 'f4']
    const norm = normalizeLine(raw)
    const a = play(raw.join(''))
    const b = play(norm.join(''))
    expect(canonicalKey(a)).toBe(canonicalKey(b))
  })
  it('8つの対称形は同じキー', () => {
    const p = play('f5d6c3d3c4f4')
    const key = canonicalKey(p)
    for (let k = 0; k < 8; k++) expect(canonicalKey(transformPos(p, k))).toBe(key)
  })
})

describe('棋譜の読み書き', () => {
  it('棋譜文字列（大文字・空白まじり）', () => {
    // 途中で改行されただけの1局は1本として読む
    const t = parseKifu('F5 D6\nC3d3  C4')
    expect(t.format).toBe('棋譜文字列')
    expect(mainLine(t)).toEqual(['f5', 'd6', 'c3', 'd3', 'c4'])
  })
  it('1行の棋譜文字列', () => {
    const t = parseKifu('F5D6C3D3C4')
    expect(t.format).toBe('棋譜文字列')
    expect(mainLine(t)).toEqual(['f5', 'd6', 'c3', 'd3', 'c4'])
    expect(t.normalized).toBe(false)
  })
  it('d3 始まりの棋譜を取り込むと f5 始まりになる', () => {
    const t = parseKifu('d3c3c4')
    expect(mainLine(t)).toEqual(['f5', 'f6', 'e6'])
    expect(t.normalized).toBe(true)
  })
  it('複数行は分岐付きの1冊に。向き違いの同じ手順は1本にまとまる', () => {
    const t = parseKifu('f5d6c3d3c4\nf5d6c5\nd3c5f6\n')
    expect(t.root.children.length).toBe(1)
    const f5 = t.root.children[0]
    expect(f5.move).toBe('f5')
    expect(f5.children.map((c) => c.move)).toEqual(['d6'])
    expect(f5.children[0].children.map((c) => c.move)).toEqual(['c3', 'c5'])
  })
  it('GGF', () => {
    const ggf = '(;GM[Othello]PC[NIOC]DT[2020.01.01]PB[黒さん]PW[白さん]RE[+12.000]TI[5:00]TY[8]BO[8 ---------------------------O*------*O--------------------------- *]B[F5//1.0]W[D6]B[C3]W[D3]B[C4];)'
    const t = parseKifu(ggf)
    expect(t.format).toBe('GGF')
    expect(mainLine(t)).toEqual(['f5', 'd6', 'c3', 'd3', 'c4'])
    expect(t.meta).toEqual({ black: '黒さん', white: '白さん', result: '黒勝ち', date: '2020/01/01', event: 'NIOC' })
  })
  it('盤面図から', () => {
    const t = parseKifu(diagram(play('f5d6')))
    expect(t.format).toBe('盤面図')
    expect(t.rootPos).toBe(toPosString(play('f5d6')))
  })
  it('書き出し：本線と全変化', () => {
    const b = newBook('test')
    mergeImport(b, parseKifu('f5d6c3d3c4\nf5d6c5f4e3\nf5f6'))
    expect(exportMainLine(b)).toBe('f5d6c3d3c4')
    expect(exportAllLines(b).trim().split('\n')).toEqual(['f5d6c3d3c4', 'f5d6c5f4e3', 'f5f6'])
    // 書き出したものを取り込み直すと同じ木
    const b2 = newBook('re')
    expect(mergeImport(b2, parseKifu(exportAllLines(b))).added).toBe(Object.keys(b.nodes).length - 1)
  })
  it('終局まで打った棋譜は石数を勝敗に入れる', () => {
    expect(winnerOf('黒 36 - 28')).toBe(0)
    expect(winnerOf('黒 20 - 44')).toBe(1)
    expect(winnerOf('黒 32 - 32')).toBe('draw')
    expect(winnerOf('白勝ち')).toBe(1)
  })
})

describe('定石名', () => {
  it('虎は向き・手順違いでも分かる', () => {
    expect(openingAt(play('f5d6c3d3c4'))).toBe('虎')
    // d3 始まりの虎（反転）
    const raw = ['d3', 'c5', 'f6', 'f5', 'e6']
    expect(normalizeLine(raw)).toEqual(['f5', 'd6', 'c3', 'd3', 'c4'])
    expect(openingAt(play(raw.join('')))).toBe('虎')
    expect(openingOfLine(START_POS, ['f5', 'd6', 'c3', 'd3', 'c4', 'f4'])).toBe('虎')
    expect(openingOfLine(START_POS, ['f5', 'd6'])).toBe('縦取り')
  })
})

describe('局面検索の似ている度合い', () => {
  it('同じ局面は1、対称形も1', () => {
    const p = play('f5d6c3')
    expect(similarity(p, p)).toBe(1)
    expect(similarity(p, transformPos(p, 3))).toBe(1)
    expect(similarity(p, play('f5d6c5'))).toBeLessThan(1)
  })
})

describe('最後まで打った棋譜', () => {
  it('パスを含むランダムな対局を、パス抜きの文字列から復元できる', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    for (let g = 0; g < 30; g++) {
      let pos = parsePos(START_POS)
      const moves: string[] = []
      while (!isOver(pos)) {
        const ms = legalMoves(pos)
        const m = ms.length ? ms[Math.floor(rnd() * ms.length)] : PASS
        moves.push(moveToStr(m))
        pos = applyMove(pos, m)
      }
      const text = moves.filter((m) => m !== 'pass').join('')
      const t = parseKifu(text)
      const line = mainLine(t)
      expect(line.filter((m) => m !== 'pass').length).toBe(text.length / 2)
      expect(t.meta?.result).toMatch(/^黒 \d+ - \d+$/)
      expect(line.includes('pass')).toBe(moves.includes('pass'))
    }
  })
})
