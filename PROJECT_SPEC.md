# gasu-3_history 技術仕様（新規エージェント向け）

このリポジトリは **静的ポートフォリオサイト**（HTML/CSS/JavaScript）です。ユーザー操作に応じた軽い動的描画（Achievements フィルタ、JSON駆動の Works/Vlog、背景アニメ、BGM制御）を `script.js` が担当します。

---

## 0. 全体像

- **ページ**：`index.html / works.html / vlog.html` の3ページ
- **共通**：
  - スタイル：`style.css`
  - 挙動：`script.js`（各HTMLで `defer` 読み込み）
- **データ駆動**：
  - Works：`content/works/*.md` →（`npm run build`）→ `works.json` + `articles/works-*.html`
  - Vlog：`content/vlog/*.md` →（`npm run build`）→ `vlog.json` + `articles/vlog-*.html`
- **TypeScriptソース**：`script.ts`（参考/ソース）
  - 実際にブラウザで動くのは `script.js`
  - 仕様変更は原則として **`script.ts` と `script.js` の両方**へ反映します（HTMLは `script.js` を参照）。

---

## 1. リポジトリ構成

- `index.html`
  - Profile
  - Achievements（Achievements のみフィルタUIあり）
  - GitHub Activity（contributionsカレンダー埋め込み）
- `works.html`
  - Works（JSON駆動）
  - GitHub Activity
- `vlog.html`
  - Vlog（JSON駆動）
  - GitHub Activity
- `style.css`
  - 画面全体のデザイン
  - timeline / filter / article card などの見た目
- `script.ts`
  - TypeScript 実装（ソース）
- `script.js`
  - ブラウザで実行される JavaScript（実運用）
- `content/`（**Works/Vlog の追加はここで行う**）
  - `content/works/*.md` / `content/vlog/*.md`
  - 1エントリ = 1ファイル（front matter + Markdown本文）
- `build-content.mjs`
  - `content/**/*.md` を読み、`works.json` / `vlog.json` と記事詳細ページ `articles/*.html` を生成
  - Markdownパーサーは自作（依存パッケージなし）
- `articles/`（**生成物**）
  - Markdownを整形した記事詳細ページ。一覧カードの「続きはこちら→」から遷移
- `package.json`
  - `npm run build`（生成） / `npm run check`（mdと生成物の整合検査）
- `works.json` / `vlog.json`
  - **生成物（手編集しない）**。`content/` のmdから `npm run build` で再生成する
- `opencode.json`
  - opencode.ai のローカルLLM設定（Ollama / baseURLなど）
- `images/`
- `bgm.mp3`

---

## 2. ページ共通仕様

### 2.1 ページ切替（タブ）

- `body` の `data-page` 属性：`index | works | vlog`
- `nav.top-tabs .tab` の `data-tab` が一致したものに `active` クラスが付与されます。
- ロジックは `script.js` 内の初期化部で実行されます。

---

## 3. 視覚/インタラクション

### 3.1 背景：NeuralNetworkBackground

- `script.js` の `new NeuralNetworkBackground()` が `DOMContentLoaded` で起動。
- 実装方針：
  - canvas を動的生成（`id='particle-canvas'`）して `document.body` の先頭へ挿入
  - `requestAnimationFrame` でネオン風の点と線を描画
  - リサイズ時にノード密度を調整するため `init()` を再実行

変更する場合の注意：
- 描画量（`maxNodes` / 半径 / 接続密度）を不用意に増やすと負荷が増えやすいです。

### 3.2 3Dホバー：Card3DEffect

- `Card3DEffect` が対象要素に `mousemove / mouseleave` を付与。
- 対象クラス（`script.js` で初期化）
  - `.timeline-item`
  - `.interest-item`
  - `.research-card`
  - `.article-card`

---

## 4. Achievements（index.html のみ）

### 4.1 AchievementFilter の役割

- `.achievements` が存在する場合のみ（＝indexページのみ）有効化されます。
- フィルタUIを DOM へ動的挿入：
  - `.achievements` の `.section-title` の直後に `filter-container` を追加
- ボタン群（data-filter）
  - `all`：すべて
  - `competition`：競技
  - `certification`：資格
  - `hackathon`：ハッカソン

### 4.2 カテゴリ割当ロジック（重要）

`assignCategories()` が各 `.timeline-item` の以下テキストを読み取ります。

- `title`：`.achievement-title` の text（小文字化）
- `award`：`.achievement-award` の text（小文字化）
- `text = `${title} ${award}` `` をキーワード検索

現在の分類条件（運用中）：
- `certification`：`試験` / `検定` / `修了` を含む
- `hackathon`：`camp` / `キャリア甲子園` / `サイバー` を含む（※主に title 判定）
- それ以外：`competition`

※「修了」を資格扱いにするため `text` に `修了` を含めています。

### 4.3 年グループの自動非表示

フィルタ実行後に、各 `.year-group` 内で表示されている `.timeline-item` が0件なら年グループごと `display:none` になります。

### 4.4 Achievements に新規項目を追加する手順

1. `index.html` の Achievements セクション内で、対象の `year-group`（例：2026）へ進む
2. `year-items` 内に次の構造の `div.timeline-item` を追加

必須要素：
- `.timeline-date`：例 `09.16`（表示用）
- `.achievement-header`
  - `.achievement-title`：例 `大規模言語モデル１`
  - `.achievement-award`：例 `修了`
- （任意）`.achievement-detail`
  - `<p>...</p>` や `.achievement-link` を配置

カテゴリを正しく出すための文言条件：
- 「資格」扱いにしたい → `.achievement-title` / `.achievement-award` に `試験` / `検定` / `修了` を含める

---

## 5. GitHub Activity（全ページ共通）

### 5.1 仕組み

- `div.github-activity` に対して、`ghchart.rshah.org/<username>` を SVG画像として埋め込みます。
- `body[data-github-user]` から username を取得し、未指定時は `Reacher001-m` がデフォルトです。

---

## 6. Works / Vlog（Markdown → JSON 生成）

`works.json` / `vlog.json` は **生成物** です。追加・編集は `content/` 配下の `.md` で行い、`npm run build` でJSONを再生成します（直接編集すると次のビルドで上書きされます）。

### 6.1 Works/Vlog への追加手順

1. 画像（任意）を `images/works/` または `images/vlog/` に置く
2. `content/works/` または `content/vlog/` に `.md` を新規作成
   - ファイル名：`001-任意の名前.md` のように **先頭の数字で表示順** を決める（昇順）
3. front matter（`---` で囲む `key: value`）と本文を書く

```markdown
---
title: 作品タイトル（必須）
date: 2026.01.15        ← 任意。カードに表示される日付
image: images/works/xxx.png  ← 任意
url: https://...        ← 任意。設定すると「続きはこちら→」が外部リンクになる
summary: ホバーに出す短い説明  ← 任意。省略時は本文がそのまま使われる
---
## 見出し

本文。改行はそのまま書ける（\n エスケープ不要）。

- 箇条書き
- **太字** / `コード`
[リンク](https://example.com)
```

4. `npm run build` を実行
   - `works.json` / `vlog.json` を再生成
   - Markdown本文を整形した記事詳細ページ `articles/<type>-<filename>.html` を生成（不要な古いページは自動削除）
5. （CI/コミット前）`npm run check` で md と生成物の整合を検査

front matter の注意：
- 対応キーは `title` / `date` / `image` / `url` / `summary` のみ（それ以外は警告して無視）
- `title` が無いとエラーになり、生成物は更新されない
- `image` のパスが実在しない場合は警告
- 本文が空でも `url` があれば可
- 1行1キーの単純形式のみ対応（YAMLライブラリ不使用・ネスト不可）

対応するMarkdown記法（`build-content.mjs` の自作パーサー）：
- 見出し（`#`〜`######`）、段落（改行は `<br>`）、水平線（`---`）
- **太字**、`インラインコード`、リスト（`-` / `1.`）、引用（`>`）
- `[テキスト](url)`、`![代替](path)`、フェンスコードブロック（ ``` ）
- 生URLの自動リンク化
- **`ラベル → URL` 形式は「ラベル文字にURLを埋め込んだ1つのリンク」になる**
  - 例：`ファイルURL → https://...` / `データダウンロード → https://...` / `サイト → https://...`
  - 任意の語（40文字まで・`→` はスペースなしでも可）+ `→` + URL にマッチ
  - リンク文字列は `ラベル → https://...` 全体、`href` はURL
  - コードブロック・インラインコードの中では発動しない（`renderInline()` の stash で保護）
- HTMLタグはエスケープされXSS対応済み
- 本文中の `images/...` パスは詳細ページ用に `../images/...` へ自動書き換え

### 6.1.1 記事詳細ページ（`articles/*.html`）

- 1エントリ = 1ページ。テンプレートは `build-content.mjs` 内の `renderArticlePage()` が生成
- ヘッダー / タブ / BGMコントロール / フッターは `works.html` と同じ流用（`../` 相対パス）
- 本文は `.article-body`（`style.css` 末尾）で既存配色（背景 `#1a1a1a` 系・文字 `#e0e0e0`、リンクは Profile準拠の `#888888` → ホバーで `#ffffff`）を踏襲
- 「← Works/Vlog 一覧へ戻る」リンク（`.article-back`）付き
- `body[data-page]` は一覧側と同じ値にするため、タブの active 表示が一覧と連動する

### 6.2 ArticlesPage の役割

- `body[data-page='works'|'vlog']` に応じて `ArticlesPage` を起動します。
- 共通ローダーが以下を実施：
  1. `fetch(works.json / vlog.json)` して配列を取得
  2. 各要素から記事カード（`article`）を生成
  3. root へ append

### 6.3 fetch の前提

- 実装は `fetch(this.jsonPath, { cache: 'no-store' })`。
- ブラウザの制約により `file://` 起動だと JSON取得が失敗し得ます。
- まずはローカルサーバ（Live Server 等）で起動してください。

### 6.4 JSONスキーマ（生成結果の想定）

`works.json` / `vlog.json` は配列で、各要素は以下フィールド。

- `title`（必須）
- `date`（任意、ある場合にだけ表示）
- `content`（任意。**カードのホバー説明**。front matter の `summary` があればそれ、なければmd本文のプレーンテキスト版）
- `url`（任意、ある場合にだけ外部リンクを表示）
- `image`（任意、ある場合にだけ画像を表示）
- `link`（**常に付与**。生成済み記事詳細ページ `articles/...html` のパス）

例（works.json の1要素）:

```json
{
  "title": "git/githubを手で動かしながら学ぼう",
  "content": "gitコマンドを自由に打ったり…\n\nサイト → https://git-test.yuusi.workers.dev/",
  "image": "images/works/git-Icon.png",
  "link": "articles/works-003-git-site.html"
}
```

### 6.5 Works/Vlogカードの見え方（現状）

- `works.json` / `vlog.json` の各要素は `title`（必須）に加え、次の要素が任意です。
  - `date`：存在する場合だけタイトルの下に表示
  - `content`：存在する場合だけホバー時に「記事本文」枠として表示
  - `url` / `link`：`content` の直後に `続きはこちら→` リンクを追加（`works`/`vlog` 共通）
    - **優先順位は `url`（外部） > `link`（記事詳細ページ）**
    - 外部URLは新規タブ、記事ページは同一タブで開く
    - 一覧から記事ページへ遷移させたい場合は `url` を書かない（自動付与される `link` が使われる）
  - `image`：存在する場合だけ左側に画像（アイコン）を表示
- カード内のリンクは **「続きはこちら→」のみに統一**（本文中のURLはテキスト表示・リンク化しない）
  - データ配布URL / サイトURLは **遷移先の記事詳細ページ側** に埋め込む
  - 記事ページでは `ファイルURL → https://...` のように **ラベル文字にURLを埋め込んだリンク** になる
  - `content` は `textContent` で挿入（エスケープ済み・`innerHTML` 不使用）

- UIのレイアウトは `works` と `vlog` で同じカードフォーマット（画像左 + 1カラム縦積み）になっています。
- 作品カードの背景/縁（ベース配色）も `vlog` と同じ配色になっています。

### 6.6 ホバー挙動・配色は Profile（index.html）準拠

works / vlog / 記事ページのカード・リンクは Profile の `timeline-item` / `achievement-link` に合わせて統一している（変更時はここを基準に戻す）。

- カード：`transition: all 0.3s ease`、ホバーで `transform: translateX(4px)` + `border-left-color: #ffffff`（影・青グローなし）＝ `.timeline-item:hover` と同じ
- 説明文の開閉（`.article-hover-content`）：`transition: all 0.3s ease`（opacity + max-height + margin）＝ `.achievement-detail` と同じ。上方向へのスライドや cubic-bezier は使わない
- リンク色：`#888888` → ホバーで `#ffffff`、下線なし、`transition: color 0.3s ease`（`inline-link` / `article-link` / `article-back` / `.article-body a` すべて共通）
- 青 `#78dcff` は**リンクには使わない**（残っているのは BGM コントロールのアクセントのみ、全ページ共通）
- 画像のズーム（`scale(1.05)`）は Profile に存在しないため廃止


---

## 7. BGM（音声再生）仕様

### 7.1 DOM要素（全ページ共通）

- 同意モーダル
  - `#bgm-consent`
  - `#bgm-consent-ok`
  - `#bgm-consent-no`
- コントロール
  - `#bgm-volume`（range: 0〜100）
  - `#bgm-toggle`（再生/一時停止）
- 音声
  - `#bgm`（`bgm.mp3` を読み込み）

### 7.2 挙動（要点）

- ブラウザの自動再生制限対策のため、ユーザー操作（ボタン押下）後に `bgm.play()` を行います。
- 位置（currentTime）をページ遷移でも復元するため、以下を保存します。

保存キー：
- `localStorage`
  - `bgm-volume`（0〜1）
- `sessionStorage`
  - `bgm-playing`（このセッションで再生操作があったか）
  - `bgm-last-time`（currentTime）

---

## 8. 変更時の開発ガイド（重要）

### 8.1 Works/Vlog の追加・編集時

1. `content/works/` `content/vlog/` の `.md` を編集（JSON / HTML は直接触らない）
2. `npm run build` で `works.json` / `vlog.json` / `articles/*.html` を再生成
3. `npm run check` で整合確認（差分があれば exit 1）
4. **生成物（`works.json` / `vlog.json` / `articles/`）もコミット対象**（静的配信のためビルドが使われない）

### 8.2 それ以外の変更時

- 描画や挙動を変える場合は `script.ts` と `script.js` の両方に反映する（HTMLは `script.js` を参照）
- カードの見た目を変える場合は `style.css` の `.article-card.*` を参照（`content/` は無関係）

### 8.3 デプロイ（Cloudflare Workers Static Assets）

- `wrangler.jsonc`（コミット済み）で静的サイトとしてデプロイする
  - `assets.directory: "."`（リポジトリルートがそのままアセット）
  - Worker名 `gasu-3-history`、`compatibility_date` はデプロイ時に更新してよい
- デプロイコマンド：`npx wrangler deploy`（設定ファイルがあるためセットアップ質問は出ない）
- `.assetsignore` がアップロード除外を制御（gitignore記法）
  - 除外：`node_modules` / `content` / `*.md` / `wrangler.jsonc` / `package.json` / `script.ts` 等
  - **必要ファイル（`*.html` / `style.css` / `script.js` / `*.json` / `articles/` / `images/` / `bgm.mp3` / `kopa.jpg`）は絶対に除外しない**
- 動作確認はローカルで可能：`npx wrangler deploy --dry-run`（アップロードせずアセット検査のみ。25MiB超のファイルがあるとエラーになる）
