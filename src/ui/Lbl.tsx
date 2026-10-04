/** 「● F5」「○ D6」の頭の記号を、盤の石と同じ見た目の小さな丸にして表示する（暗い背景で黒白が逆に見えないように） */
export function Lbl({ text }: { text: string }) {
  const m = /^([●○]) (.*)$/.exec(text)
  if (!m) return <>{text}</>
  return (
    <span className="lbl">
      <i className={`disc ${m[1] === '●' ? 'black' : 'white'}`} />
      {m[2]}
    </span>
  )
}

/** SVG の中で使う版 */
export function SvgLbl({ text }: { text: string }) {
  const m = /^([●○]) (.*)$/.exec(text)
  if (!m) return <>{text}</>
  return (
    <>
      <tspan className={`svg-disc ${m[1] === '●' ? 'black' : 'white'}`}>●</tspan>
      <tspan dx="3">{m[2]}</tspan>
    </>
  )
}
