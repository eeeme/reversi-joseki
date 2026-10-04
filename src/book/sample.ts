// 初回起動時に入れるサンプル（1行1手順の棋譜文字列）。取り込み機能の動作見本も兼ねる
export const SAMPLE_NAME = '主要定石（兎・虎・牛の基本形）'

export const SAMPLE_LINES = `f5d6c3d3c4
f5d6c5f4e3
f5f6e6f4e3
f5f6e6f4c3
f5f4
`

/** サンプルの手順に付けておくメモ（手順 → メモ） */
export const SAMPLE_NOTES: Record<string, string> = {
  f5: '黒の初手は f5 にそろえて記録します（d3・c4・e6 で打っても同じ形に直します）。',
  f5d6: '白の2手目は縦取り（d6）・斜め取り（f6）・並び取り（f4）の3通り。',
}
