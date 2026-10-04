import { parsePos } from '../reversi/core'

/** 一覧用の小さな盤面（SVG・操作なし） */
export function MiniBoard({ pos: posStr, size = 112 }: { pos: string; size?: number }) {
  const pos = parsePos(posStr)
  const cell = size / 8
  const H = size + 14
  return (
    <svg className="mini-board" width={size} height={H} viewBox={`0 0 ${size} ${H}`} role="img" aria-label="局面">
      <rect x={0} y={0} width={size} height={size} className="mini-bg" />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i}>
          <line x1={(i + 1) * cell} y1={0} x2={(i + 1) * cell} y2={size} className="mini-line" />
          <line x1={0} y1={(i + 1) * cell} x2={size} y2={(i + 1) * cell} className="mini-line" />
        </g>
      ))}
      {pos.board.map((c, i) => {
        if (!c) return null
        return (
          <circle
            key={i}
            cx={(i % 8) * cell + cell / 2}
            cy={Math.floor(i / 8) * cell + cell / 2}
            r={cell * 0.38}
            className={c === 1 ? 'mini-black' : 'mini-white'}
          />
        )
      })}
      <text x={size - 2} y={H - 2} textAnchor="end" className="mini-hand">{pos.turn === 0 ? '黒番' : '白番'}</text>
    </svg>
  )
}
