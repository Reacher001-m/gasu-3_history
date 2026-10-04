# バックエンド機能 開発計画（学習用）

> ブランチ: `backend` で実装する。
> 目的: 完全静的サイト（Cloudflare Workers Static Assets）にバックエンドを追加し、
> HTTP・永続ストレージ・バリデーション・エラーハンドリングを実践で学ぶ。
> 題材: **①ページビューカウンター** + **②問い合わせフォーム**（KV一本で完結させる）。

## 0. 決定事項（2026-10-04）

| 論点 | 決定 |
|---|---|
| デプロイ方針 | **`wrangler dev` + staging専用Workers**（本番は触らない。staging 用に別Workers名で検証し、完成後に本番へ） |
| 学習スタイル | **AI実装＋解説形式**（実装→コード内解説→チェックリストで概念確認） |
| カウント方式 | **カードは「続きはこちら→」クリック数**（GET表示のみ・POSTはクリック時のみ、`keepalive: true`）／**プロフィールのViewsはページ訪問数**（load時にPOST） |
| フォーム | **KV保存 + Resend（メール通知）**。保存を第一とし、メール送信はベストエフォート（失敗してもKV保存は残し `wrangler tail` にログ） |

### staging の作り方（wrangler.jsonc の env 分離）

```jsonc
{
  "name": "gasu-3-history",           // 本番（現状のまま）
  "main": "backend/index.js",
  "assets": { "directory": ".", "run_worker_first": ["/api/*"] },
  "env": {
    "staging": {
      "name": "gasu-3-history-staging", // 別Workers名
      "kv_namespaces": [ /* staging専用KV namespace */ ]
    }
  }
}
```

- 開発中の検証: `npx wrangler dev --env staging`（ローカル）
- staging公開: `npx wrangler deploy --env staging`
- 本番: `npx wrangler deploy`（段階3で、デプロイ前に `--dry-run` 確認）
- 本番に同じ `main`/ルーティングが入るので、**本番デプロイは常に最終段の最後**にする

### Resend の前提（段階2の着手前に準備）

- Resendアカウント登録（メール認証）+ サイドバーで verified sender（自分のメールアドレス）を1件登録
- APIキーは `npx wrangler secret put RESEND_API_KEY` で登録（**コミットしない**）
- 宛先は開発者自身のメール（`TO_EMAIL` もsecretで渡す）
- free tier: 100通/日 — 学習用途に十分

---

## 1. 構成変更の全体像

```
現在: wrangler.jsonc = アセット専用（Workerコードなし）
     ↓
今後: "main": "backend/index.js" を追加 → Worker + Static Assets の併用

  /api/*    → Worker（バックエンド）が処理
  それ以外 → 今まで通り静的配信（assets）
```

- 設定の肝: `assets.run_worker_first: ["/api/*"]` で「APIだけWorker優先」にし、静的サイトの挙動を変えない
- **このリポジトリ固有の注意**: `assets.directory: "."` のため `backend/` もアセット候補になってしまう
  → `.assetsignore` に `backend` を追記（Workerコードと静的配信ファイルは別物、という概念を学ぶ）

## 2. クラウド製品

| 用途 | 製品 |
|---|---|
| 計算（API実行） | Cloudflare Workers（V8 isolate、標準Web API: `Request` / `Response`） |
| 永続ストレージ | **Cloudflare KV**（カウンターの値・フォーム送信履歴、両方これで完結） |
| ローカル検証 | `wrangler dev`（localhost:8787、本番とほぼ同じ挙動） |
| ログ | `wrangler tail`（observabilityは wrangler.jsonc で既に有効化済み） |
| （任意）メール通知 | **Resend**（段階2で採用）。APIキーは `wrangler secret put` |

※最初は **KV一本** に絞る。D1・認証・コメントは次段階の題材と役割分担。

## 3. ルート設計（API仕様）

```
GET  /api/count?key=view:index        → 200 {"key":"view:index","count":42}
POST /api/count {"key":"view:index"}  → 201 カウント増やして返す
POST /api/contact {"name","email","message"}
                                       → 201 保存（+Resend通知ベストエフォート） / 400 / 429 / 405
GET  /api/health                      → 200 {"ok":true}（動作確認用）
```

規約:

- `Content-Type: application/json` を全館で統一。エラーも `{"error": "..."}` 形式
- ステータスコードの使い分け（200/201/400/405/429/500）自体が学習項目
- KVキー設計: `view:index` / `view:works-001` / `contact:<timestamp>` など接頭辞で名前空間分離
- CORSは**同一オリジンなので不要**。「なぜ不要か」を説明できるようにしておく
- フロント側の表示先:
  - index の `Views:` 行 → ページ訪問数（load時にPOSTで+1）
  - works/vlog カードの `閲覧 N` → **「続きはこちら→」のクリック数**（読み込みはGET表示のみ）

## 4. 想定ファイル構成

```
backend/
  index.js      … エントリ（/api/* のルーティングだけ最初は1ファイルでOK）
  http.js       … json() レスポンスヘルパー（共通）
  counter.js    … 段階1（カウンター）
  contact.js    … 段階2（フォーム）で分離
  validate.js   … バリデーション（フォーム時に追加）
wrangler.jsonc  … main + run_worker_first + env.staging(KV binding)
.assetsignore   … backend を追加
```

## 5. 学習チェックリスト

### 段階0: Worker化の布石

- [x] `main` 追加 → `wrangler dev` で「静的サイト + /api/health」が両方動くことを確認
- [x] `/api` 以外にWorkerが食い込むと静的サイトが壊れることを確認（`run_worker_first` の意味を体感）
      → `/` と `/works.html` は静的200、`/api/nope` は404、`POST /api/health` は405
- [x] `.assetsignore` に `backend` 追記
- [ ] Cloudflareで staging用 KV namespace を作成し、`env.staging` に binding 追加
- [x] `npm run dev`（= `wrangler dev --env staging`）で起動確認

#### 段階0で判明した落とし穴（対処済み・再発時にここを読む）

1. **無限リロードループ**
   - 症状: サーバーはListenするがHTTP応答が返らず、`wrangler dev` のログが「Reloading local server...」で止まらない
   - 原因: `assets.directory: "."` でプロジェクト全体を監視 → **`.wrangler/state` 内のSQLite(`.sqlite-shm`)書き込みが変更検知 → リロード → さらに書き込み**、が無限ループ
   - 対処: `--persist-to "%TEMP%\gasu3-state"` でlocal state をプロジェクト外に置く（`npm run dev` に組み込み済み）
2. **wranglerのバージョンずれ**
   - 症状: `This Worker requires compatibility date "2026-10-01", but the newest date supported...` エラー
   - 原因: `npx wrangler` が古いローカルキャッシュ（4.90）を実行
   - 対処: `devDependencies` に `wrangler@^4.147.0` を固定し、必ず `npm run dev` から起動
3. **npm scripts**（すべて `--env staging` 前提）
   - `npm run dev` / `deploy:staging` / `deploy` / `tail:staging`

### 段階1: カウンター（KV入門）

- [x] GET/POST /api/count を実装（405・400・500 のエラーハンドリング込み）
      → ローカルで9項目テスト済み（201増加 / GET / 400×3 / 405 / 静的200）
- [x] index に閲覧数を表示（`Views:` 行）＋ works/vlog カードに `閲覧 N` 表示
      → `id` を build-content.mjs の出力に追加（`works-001-git-anki` 等）
      → `script.js` / `script.ts` に `fetchCount` / `incrementCount` / `trackView` を追加
      → **カードはGET表示のみ・クリック時POST**、プロフィールは訪問時POST（file:// では黙って失敗）
- [x] ブラウザで確認: `npm run dev` → http://127.0.0.1:8787 で閲覧数が増えること
- [ ] 別タブで2つ開いて**書き込み競合を観察**（KVは非同時整合 → 「最終一致」を体感）← 学習用・任意
- [x] staging へデプロイ + `npm run tail:staging` でログ確認
      → https://gasu-3-history-staging.yuusi.workers.dev （8項目のリモート検証済み、tailで201観察済み）
- [x] KV namespace のプレースホルダIDを実IDへ差し替え（`5044ad2c6d1141cf99f3b9cfc1255f1c`）
- [ ] クリック数方式の最終ブラウザ確認（stagingで「続きはこちら→」→ リロードして `閲覧 +1`）

### 段階2: 問い合わせフォーム（HTTP入力の本丸）

- [ ] フロントにフォーム追加（送信中は disabled、結果は `textContent` で表示）
- [ ] バリデーション: 必須・文字数・メール形式・不正JSON（400）
- [ ] ハニーポット（bot対策）と簡易レート制限（IP単位 → 429）
- KVへの保存 + 送信履歴の閲覧（まずは `wrangler kv` コマンドで十分。管理画面は次段階）
- [ ] Resend通知（best effort）: 非同期で失敗しても201は返す、エラーは `wrangler tail` にログ
- [ ] `npx wrangler secret put RESEND_API_KEY` / `TO_EMAIL` でシークレット登録（コミットしない）
- [ ] 入力を再掲する場合のXSS対策（HTMLエスケープ / `textContent`）

### 段階3: 運用

- [ ] README / PROJECT_SPEC にAPI仕様を追記
- [ ] デプロイ手順の整備（git push → `npx wrangler deploy`）
- [ ] （次段階の伏線）管理画面認証・D1移行・コメント機能・Cron Triggers

## 6. セキュリティ原則（実装時に必ず確認）

- 入力検証・認可・レート制限の3点セット
- 秘密情報（APIキー等）は絶対にコミットしない（`wrangler secret` / `.gitignore`）
- ユーザー入力の表示は必ずエスケープ（HTML文字列で組み立てない）

## 7. 決定済み・残課題

- [x] 本番の汚染回避 → `wrangler dev` + staging専用Workers（`env.staging`）
- [x] カウント表示: 訪問毎に+1（表示位置は index と各カード）
- [x] フォーム: KV保存 + Resend通知
- [ ] **Resendアカウント登録・verified sender設定・APIキー取得**（段階2着手前の準備）
- [ ] Cloudflareダッシュボードで **staging用KV namespace作成**（段階0の準備）
- [ ] `BACKEND_PLAN.md` のコミット可否
