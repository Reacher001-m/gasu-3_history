# gasu-3_history

静的ポートフォリオサイト（HTML / CSS / JavaScript）+ バックエンドAPI（Cloudflare Worker）。仕様の詳細は [PROJECT_SPEC.md](PROJECT_SPEC.md)（フロント）と [BACKEND_PLAN.md](BACKEND_PLAN.md)（API開発計画）を参照。

## バックエンド API（Cloudflare Worker）

`backend/index.js` が `/api/*` を受け持ち、静的ファイルは今までどおり配信される。

| ルート | 役割 |
|---|---|
| `GET /api/health` | 動作確認 |
| `GET /api/count?key=view:<slug>` | 閲覧数の取得（増やさない） |
| `POST /api/count` | 閲覧数の +1（カードは「続きはこちら→」クリック時のみ） |
| `POST /api/contact` | 問い合わせ保存（KV）＋ Resendメール通知（ベストエフォート） |

```bash
npm run dev              # ローカル開発サーバ（http://127.0.0.1:8787、/api も動く）
npm run deploy:staging   # staging へデプロイ（gasu-3-history-staging）
npm run deploy           # 本番へデプロイ（完成後に実行する）
npm run tail:staging     # staging のリクエストログをリアルタイム表示
```

- 保存先は Cloudflare KV（binding 名 `APP_KV`、staging環境のみ）
- 送信履歴の閲覧: `npx wrangler kv key list --binding APP_KV --env staging --remote`
  （`--remote` を忘れない。付けないと空っぽのローカル状態を見る）
- シークレット（`RESEND_API_KEY` / `TO_EMAIL` / 任意 `FROM_EMAIL`）は
  `npx wrangler secret put <名前> --env staging` で登録。**コードやチャットに書かない**
- **プッシュではデプロイされない**（自動デプロイCIは無し）。必ず上記コマンドを実行する

## Works / Vlog の追加方法

`works.json` / `vlog.json` / `articles/*.html` は生成物です。直接編集せず、Markdown から生成します。

```bash
# 1. content/works/ または content/vlog/ に md を作る
#    001-タイトル.md のように先頭の数字が表示順（昇順）
```

```markdown
---
title: タイトル（必須）
date: 2026.01.15
image: images/works/xxx.png  ← works は記事詳細ページ右側に表示（一覧カードには出ない）
url: https://...        ← 任意（書くと「続きはこちら」が外部リンクになる）
summary: ホバーに出す短い説明（任意・省略時は本文が使われる）
---
## 見出し

本文をそのまま改行で書ける。

- 箇条書き / **太字** / `コード`
[リンク](https://example.com)
![画像](images/works/xxx.png)
```

```bash
npm run build   # content/*.md → works.json / vlog.json / articles/*.html を生成
npm run check   # md と生成物の整合を検査（不一致なら exit 1）
```

- 画像は `images/works/` または `images/vlog/` に配置（works は詳細ページのタイトル右側、vlog はカード左側に表示）
- 生成された `articles/*.html` が記事詳細ページ（サイトと同じ見た目）
- 一覧カードの「続きはこちら→」から遷移（`url` を書いた場合はそちらが優先）
- 対応記法：見出し / 太字 / コード / リスト / 引用 / リンク / 画像 / コードブロック / 水平線
- URLを画面に出したくないときは `[ファイルURL](https://...)` のように書く → 表示は「ファイルURL」だけ、クリックで飛びます
- `ファイルURL → https://...`、`サイト → https://...` のように **`語 + → + URL`** を書くと、その文字列全部が1つのリンクになる（コードブロック内では無効）

## ローカルで確認

`file://` では fetch が弾かれるうえ、API も動かない。必ずローカルサーバ経由で開く。

```bash
npm run dev        # 推奨: 静的ファイル + /api の両方に対応（http://127.0.0.1:8787）
npx serve .        # 静的表示のみ（APIは無い）
```

## Cloudflare へのデプロイ

設定ファイルはリポジトリにコミット済み。

- `wrangler.jsonc` … 本番 `gasu-3-history` / staging `gasu-3-history-staging`（`env.staging`）
  - `main: backend/index.js`（Worker）＋ `assets.run_worker_first: ["/api/*"]`（APIだけWorker優先）
- `.assetsignore` … アセットからの除外（`backend` / `node_modules` / `content` / `*.md` など）
- `.assetsignore` と gitignore の `node_modules` を外さない（25MiB制限）

```bash
npm run deploy:staging   # 開発中は常に staging で検証
npm run deploy           # 本番反映（完成後に実行する最終操作）
npx wrangler deploy --dry-run   # 任意: アップロードせず検査のみ
```

- ブランチのプッシュとデプロイは別物（自動デプロイは未設定）
- 学習の経緯・チェックリストは [BACKEND_PLAN.md](BACKEND_PLAN.md)
