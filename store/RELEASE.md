# 定石帳 リリース手順（Google Play）

この順に進めれば公開申請まで終わります。貼り付ける文章はすべて `store/listing.md` に、画像は `store/` にあります。

| 項目 | 値 |
|---|---|
| パッケージ名 | `com.meisme.reversijoseki` |
| アプリ名 | 定石帳 ― リバーシの定石を分岐で覚える |
| 署名鍵（アップロード鍵） | `reversi-joseki-release.jks`／別名 `reversi-joseki`（チャットで渡したファイル） |
| プライバシーポリシー | https://eeeme.github.io/reversi-joseki/privacy.html |
| アイコン 512×512 | `store/play-icon-512.png` |
| フィーチャー グラフィック 1024×500 | `store/play-feature-1024x500.png` |
| スクリーンショット（1080×1920・5枚） | `store/screenshots/1_home.png` 〜 `5_drill.png` |

---

## 1. 署名鍵を GitHub に登録する（スマホで可・5分）

https://github.com/eeeme/reversi-joseki/settings/secrets/actions →「New repository secret」を2回。

| Name | Secret（値） |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `ANDROID_KEYSTORE_BASE64.txt` の中身をそのまま全部 |
| `ANDROID_KEYSTORE_PASSWORD` | `ANDROID_KEYSTORE_PASSWORD.txt` の中身 |

`.jks` とパスワードは、パスワードマネージャーなどリポジトリの外にも必ず保管する（なくすと Google に鍵の再設定を頼むことになる）。

## 2. 署名済み AAB を作る

1. https://github.com/eeeme/reversi-joseki/actions/workflows/android.yml →「Run workflow」→ main のまま実行
2. 数分で緑になったら、実行結果の下の Artifacts「reversi-joseki-<番号>」をダウンロード（zip の中に `app-release.aab`）
3. ログに「未署名でビルドします」の警告が出ていたら、1 の Secrets の名前を見直す

## 3. Play Console でアプリを作る

https://play.google.com/console →「アプリを作成」

- アプリ名：`定石帳 ― リバーシの定石を分岐で覚える`
- デフォルトの言語：日本語
- アプリまたはゲーム：**アプリ**
- 無料または有料：**無料**
- 宣言 2つにチェック →「アプリを作成」

## 4. 最初の AAB をアップロードする

「テストとリリース」→「製品版」→「新しいリリースを作成」

- Play アプリ署名：「続行」（Google に任せる。上の鍵はアップロード鍵になる）
- App Bundle：2 の `app-release.aab`
- リリース名：自動のまま（1.0.0）
- リリースノート（日本語）：

```
<ja-JP>
はじめてのリリースです。リバーシの定石を分岐のツリーで記録して、練習と復習で覚えられます。
</ja-JP>
```

ここでは「保存」まで。審査への送信は 7 で行う。

## 5. 応援のアイテムを作る（AAB を上げた後で作れるようになる）

「収益化」→「商品」

- **アプリ内アイテム**（3つ）：ID `support_small` / `support_medium` / `support_large`。名前「ちょっと応援」「応援」「たくさん応援」、説明「開発を応援します（機能は変わりません）」。価格は将棋版と同じでよい。`support_large` は「複数購入」をオン。すべて「有効」に
- **定期購入**：ID `support_monthly`、名前「毎月応援」、基本プラン ID `monthly`（毎月自動更新）。価格を決めて「有効」に

アプリは消費型として扱うので、ほかの設定は不要。

## 6. ストアの設定（「アプリの設定」の各項目）

| 項目 | 回答 |
|---|---|
| プライバシー ポリシー | https://eeeme.github.io/reversi-joseki/privacy.html |
| アプリのアクセス権 | 制限なし（ログイン不要） |
| 広告 | 広告なし |
| コンテンツのレーティング | カテゴリ「その他」。暴力・性的表現・薬物・ギャンブル・ユーザー間のやり取り・位置情報の共有はすべて「いいえ」、デジタル商品の購入は「はい」 |
| ターゲット ユーザー | 18歳以上 |
| ニュースアプリ | いいえ |
| データ セーフティ | データを収集・共有しない（「いいえ」）。暗号化・削除の質問は「収集しない」に沿って回答 |
| 政府アプリ／金融機能／健康 | いずれも該当しない |
| カテゴリ | アプリ／ボードゲーム（無い場合は「教育」） |
| 連絡先 | デベロッパーのメール（将棋版と同じ） |

**メインのストアの掲載情報**：`store/listing.md` の「簡単な説明」「詳しい説明」を貼り、アイコン・フィーチャー グラフィック・スクリーンショット5枚をアップロード。

## 7. 審査に送る

「公開の概要」→ 未完了の項目がないことを確認 →「変更を審査に送信」。審査は数日〜1週間ほど。

（組織アカウントなので、個人アカウントのような「12人×14日のクローズドテスト」は不要。）

## 公開後

- 次のバージョンは main に入れて 2 をもう一度実行（versionCode は Actions の実行番号で自動的に増える）。package.json の `version` を上げるとバージョン名が変わる
- 公開されたら、アプリ内の「Google Play で評価する」「友だちに紹介する」が実際のストアページを開くか確認する
