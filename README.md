# 定石帳（reversi-joseki）

リバーシの定石を「分岐をたどって」覚えるための PWA。サーバー無し・端末内（IndexedDB）完結。
設計は [docs/design.md](docs/design.md)。将棋版「定跡帳」（[eeeme/shogi-zyoseki](https://github.com/eeeme/shogi-zyoseki)）と同じ考え方・見た目で作っています。

## 機能

- **定石ツリー**：手数は下へ、変化は右の列へ枝分かれ。定石名のある局面には ◆
- **閲覧・編集**：盤に打って手を追加（✏ オン時）、本線の入れ替え、部分木の削除、局面ごとのメモ。打てる場所がない手番は「パス」のエフェクトを出して自動で進む
- **初手を f5 にそろえる**：d3・c4・e6 で始まる棋譜や、盤で打った初手は盤ごと回して f5 始まりで記録（向き違いの同じ手順は1本にまとまる）
- **定石名**：虎・牛・兎・バッファローなど（`src/reversi/openings.ts` の表。向き・手順前後を問わず判定）
- **練習**：黒／白を選ぶと相手の手は自動、自分の番で定石の手を答える。間隔反復（SM-2簡易版）・石を隠す脳内盤モード
- **今日の復習**：「今日の復習に使う」フォルダの本だけが対象。復習日が来た局面から最後まで通して出題
- **棋譜取込**：棋譜文字列（`f5d6c3…`）、1行1手順の複数行（分岐付きの1冊に）、GGF、盤面図（`X`/`O`/`-` の8行＋手番）。パスは書かれていなくても自動で挟む
- **実戦照合**：自分の対局を貼ると、何手目で定石を外れたか・定石では何を打つかを表示
- **書き出し**：本線の棋譜文字列／全変化を1行ずつ、をコピー
- **合流（手順前後）・局面検索**：8つの対称形をまとめて比べるので、向き違いの同じ局面も一致になる
- **次の手の出現率・勝率**、フォルダ・タグ・しおり、盤面編集（タップで 黒→白→空）、応援、使い方の案内

## 開発

```bash
npm install
npm run dev     # 開発サーバー
npm test        # ルール・正規化・棋譜のテスト
npm run build   # dist/ に出力
```

main への push で GitHub Actions がテスト→ビルド→GitHub Pages（`/reversi-joseki/`）へデプロイします（リポジトリ設定 Pages の Source を「GitHub Actions」にしておく）。

## Android アプリ（Google Play）

Capacitor で包んでいます（パッケージ名 `com.meisme.reversijoseki`）。

- `npm run android` … アプリ用にビルドして `android/` へ反映（Android Studio で開ける）
- GitHub の Actions →「Android (AAB)」→ Run workflow … 署名済み `.aab` を作って Artifacts に置く
  - Secrets に `ANDROID_KEYSTORE_BASE64`（鍵ファイルを base64 にしたもの）と `ANDROID_KEYSTORE_PASSWORD` が必要。鍵の別名（alias）は `reversi-joseki`
  - 鍵が無いときは未署名でビルドだけ確かめる

## 名前の注意

「オセロ」は登録商標なので、アプリ名・ストア掲載文・画像には使わず「リバーシ」と書く。
