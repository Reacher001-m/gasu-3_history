# gasu-3_history

静的ポートフォリオサイト（HTML / CSS / JavaScript）。仕様の詳細は [PROJECT_SPEC.md](PROJECT_SPEC.md) を参照。

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
image: images/works/xxx.png
url: https://...        ← 任意（書くと「続きはこちら」が外部リンクになる）
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

- 画像は `images/works/` または `images/vlog/` に配置
- 生成された `articles/*.html` が記事詳細ページ（サイトと同じ見た目）
- 一覧カードの「続きはこちら→」から遷移（`url` を書いた場合はそちらが優先）
- 対応記法：見出し / 太字 / コード / リスト / 引用 / リンク / 画像 / コードブロック / 水平線

## ローカルで確認

`file://` では fetch が弾かれるため、ローカルサーバで開くこと。

```bash
npx serve .
# または Live Server 等
```
