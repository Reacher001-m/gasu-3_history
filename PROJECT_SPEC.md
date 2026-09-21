# gasu-3_history 技術仕様（新規エージェント向け）

このリポジトリは **静的ポートフォリオサイト**（HTML/CSS/JavaScript）です。ユーザー操作に応じた軽い動的描画（Achievements フィルタ、JSON駆動の Works/Vlog、背景アニメ、BGM制御）を `script.js` が担当します。

---

## 0. 全体像

- **ページ**：`index.html / works.html / vlog.html` の3ページ
- **共通**：
  - スタイル：`style.css`
  - 挙動：`script.js`（各HTMLで `defer` 読み込み）
- **データ駆動**：
  - Works：`works.json`
  - Vlog：`vlog.json`
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
- `works.json`
- `vlog.json`
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

## 6. Works / Vlog（JSON駆動）

### 6.1 ArticlesPage の役割

- `body[data-page='works'|'vlog']` に応じて `ArticlesPage` を起動します。
- 共通ローダーが以下を実施：
  1. `fetch(works.json / vlog.json)` して配列を取得
  2. 各要素から記事カード（`article`）を生成
  3. root へ append

### 6.2 fetch の前提

- 実装は `fetch(this.jsonPath, { cache: 'no-store' })`。
- ブラウザの制約により `file://` 起動だと JSON取得が失敗し得ます。
- まずはローカルサーバ（Live Server 等）で起動してください。

### 6.3 JSONスキーマ（想定）

`works.json` / `vlog.json` は配列で、各要素は以下フィールド。

- `title`（必須）
- `date`（任意、ある場合にだけ表示）
- `content`（任意、ある場合にだけ表示）
- `url`（任意、ある場合にだけリンクを表示）
- `image`（任意、ある場合にだけ画像を表示）

例（vlog.json の1要素）:

```json
{
  "title": "題名",
  "image": "images/vlog/note_icon.jpg",
  "content": "記事本文（\n を含めてもOK）",
  "url": "https://..."
}
```

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
