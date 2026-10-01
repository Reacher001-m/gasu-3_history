#!/usr/bin/env node
/**
 * content/<works|vlog>/*.md
 *   ├→ works.json / vlog.json   （カード一覧用データ。手編集しない）
 *   └→ articles/*.html          （Markdownを整形した記事詳細ページ）
 *
 * 使い方:
 *   node build-content.mjs          … 生成（上書き）
 *   node build-content.mjs --check  … 生成結果と既存ファイルの差分検査（不一致なら exit 1）
 *
 * front matter は `key: value` 形式のみ対応（YAMLライブラリ不使用）。
 * ファイル名先頭の数字（001-, 002- …）が表示順。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHECK_MODE = process.argv.includes('--check');

const ARTICLES_DIR = 'articles';
const SOURCES = [
    { type: 'works', dir: path.join('content', 'works'), out: 'works.json', listPage: 'works.html', listLabel: 'Works' },
    { type: 'vlog', dir: path.join('content', 'vlog'), out: 'vlog.json', listPage: 'vlog.html', listLabel: 'Vlog' },
];
const ALLOWED_KEYS = ['title', 'date', 'image', 'url', 'summary'];

const errors = [];
const warnings = [];
const error = m => errors.push(m);
const warn = m => warnings.push(m);

// ==================== Markdown ====================

function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderInline(escaped) {
    let s = escaped;
    // 後続の変換（ラベルリンク・自動リンク・太字）の対象外にするHTMLを退避する
    const stash = [];
    const keep = html => `\u0001${stash.push(html) - 1}\u0001`;

    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => `<img src="${url}" alt="${alt}">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    // インラインコードは以降の変換から保護
    s = s.replace(/`([^`]+)`/g, (_m, code) => keep(`<code>${code}</code>`));
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 「ラベル → URL」（ファイルURL → / データダウンロード → / サイト → 等）を
    // ラベル文字にURLを埋め込んだ1つのリンクにする
    s = s.replace(/([^\s<>]{1,40}\s*→)\s*(https?:\/\/[^\s<]+)/g, (_m, label, url) => {
        const trimmed = url.replace(/[.,:;!?、。）)\]]+$/, '');
        const rest = url.slice(trimmed.length);
        return keep(
            `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${label} ${trimmed}</a>`
        ) + rest;
    });
    // 生URLの自動リンク
    s = s.replace(/(^|[\s（(])(https?:\/\/[^\s<]+)/g, (m, pre, url) => {
        const trimmed = url.replace(/[.,:;!?、。）)\]]+$/, '');
        const rest = url.slice(trimmed.length);
        if (trimmed.length < 11 || trimmed.includes('&lt;')) return m;
        return `${pre}<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${trimmed}</a>${rest}`;
    });
    // 退避したHTMLを戻す
    s = s.replace(/\u0001(\d+)\u0001/g, (_m, i) => stash[Number(i)]);
    return s;
}

function isBlockStart(line) {
    return /^(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s|```|(-{3,}|\*{3,}|_{3,})$)/.test(line);
}

function renderMarkdown(src) {
    const lines = src.split(/\r?\n/);
    const out = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) { i++; continue; }

        if (/^\s*```/.test(line)) {
            const lang = line.trim().replace(/^```/, '').trim();
            const buf = [];
            i++;
            while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
            i++;
            const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
            out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
            continue;
        }

        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            const lv = h[1].length;
            out.push(`<h${lv}>${renderInline(escapeHtml(h[2].trim()))}</h${lv}>`);
            i++;
            continue;
        }

        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

        if (/^\s*>\s?/.test(line)) {
            const buf = [];
            while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                buf.push(lines[i].replace(/^\s*>\s?/, ''));
                i++;
            }
            out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
            continue;
        }

        if (/^\s*[-*+]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                items.push(`<li>${renderInline(escapeHtml(lines[i].replace(/^\s*[-*+]\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ul>${items.join('')}</ul>`);
            continue;
        }

        if (/^\s*\d+[.)]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
                items.push(`<li>${renderInline(escapeHtml(lines[i].replace(/^\s*\d+[.)]\s+/, '')))}</li>`);
                i++;
            }
            out.push(`<ol>${items.join('')}</ol>`);
            continue;
        }

        const buf = [];
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
            buf.push(lines[i]);
            i++;
        }
        if (!buf.length) { buf.push(lines[i]); i++; }
        out.push(`<p>${buf.map(l => renderInline(escapeHtml(l))).join('<br>')}</p>`);
    }

    return out.join('\n');
}

function toPlainText(src) {
    return src
        .replace(/^\s*```[^\n]*$/gm, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '・')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ==================== Article page template ====================

function renderArticlePage({ page, title, date, bodyHtml, backHref, backLabel }) {
    const dateHtml = date ? `\n                <p class="article-date">${escapeHtml(date)}</p>` : '';
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(`ga-su3 - ${title}`)}</title>
    <link rel="stylesheet" href="../style.css">
    <script src="../script.js" defer></script>
</head>
<body data-page="${page}">
    <nav class="top-tabs" aria-label="ページナビゲーション">
        <a class="tab" href="../index.html" data-tab="index">Profile</a>
        <a class="tab" href="../works.html" data-tab="works">Works</a>
        <a class="tab" href="../vlog.html" data-tab="vlog">Vlog</a>
    </nav>

    <!-- BGM consent modal -->
    <div id="bgm-consent" class="bgm-consent" role="dialog" aria-modal="true" aria-label="BGM再生許可">
        <div class="bgm-consent-card">
            <h2 class="bgm-consent-title">音が鳴ります</h2>
            <p class="bgm-consent-text">このサイトではBGMが流れます。[OK][NO]で選んでください。</p>
            <div class="bgm-consent-actions">
                <button id="bgm-consent-ok" class="bgm-consent-ok" type="button">OK</button>
                <button id="bgm-consent-no" class="bgm-consent-no" type="button">NO</button>
            </div>
        </div>
    </div>

    <!-- BGM controls (volume + toggle) -->
    <div class="bgm-controls" aria-label="BGMコントロール">
        <div class="bgm-controls-row">
            <label class="bgm-volume-label" for="bgm-volume">音量</label>
            <input id="bgm-volume" class="bgm-volume" type="range" min="0" max="100" step="1" value="100" />
            <button id="bgm-toggle" class="bgm-toggle" type="button">再生</button>
        </div>
    </div>

    <div class="container" style="padding-bottom: 120px;">
        <header class="header">
            <div class="profile-header">
                <img src="../kopa.jpg" alt="ga-su3" class="profile-icon">
                <div class="profile-text">
                    <h1 class="name">ga-su3</h1>
                    <p class="tagline">がーすー３</p>
                </div>
            </div>
            <div class="social-links">
                <a href="https://x.com/GAsu3rd" target="_blank" rel="noopener noreferrer" class="social-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X (Twitter)
                </a>
                <a href="https://github.com/Reacher001-m" target="_blank" rel="noopener noreferrer" class="social-link">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.728 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.166-1.644-4.166-1.644-.556-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                </a>
            </div>
        </header>

        <main class="content">
            <section class="section article-detail">
                <a class="article-back" href="../${backHref}">← ${backLabel} 一覧へ戻る</a>
                <h2 class="section-title">${escapeHtml(title)}</h2>${dateHtml}
                <div class="article-body">
${bodyHtml}
                </div>
            </section>
        </main>

        <footer class="footer">
            <p>&copy; 2026 ga-su3. All rights reserved.</p>
        </footer>
    </div>

    <audio id="bgm" src="../bgm.mp3" loop preload="auto" playsinline></audio>
</body>
</html>
`;
}

// ==================== Build ====================

function orderNumber(filename) {
    const m = filename.match(/^(\d+)/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function parseFile(filePath) {
    const rel = path.relative(ROOT, filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    if (lines[0]?.trim() !== '---') {
        error(`${rel}: 1行目が --- で始まっていません（front matter が必要）`);
        return null;
    }
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end === -1) {
        error(`${rel}: front matter の閉じ --- が見つかりません`);
        return null;
    }

    const meta = {};
    for (let i = 1; i < end; i++) {
        const line = lines[i];
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (!m) {
            error(`${rel}:${i + 1} front matter の形式が不正です: ${line}`);
            continue;
        }
        const key = m[1];
        if (!ALLOWED_KEYS.includes(key)) warn(`${rel}: 未知のキー "${key}" は無視されます`);
        else meta[key] = m[2].trim();
    }

    if (!meta.title) error(`${rel}: title がありません`);

    let body = lines.slice(end + 1).join('\n');
    body = body.replace(/^\r?\n/, '').replace(/\s+$/, '');

    if (meta.image && !fs.existsSync(path.join(ROOT, meta.image))) {
        warn(`${rel}: 画像が見つかりません → ${meta.image}`);
    }
    if (!body && !meta.url) warn(`${rel}: 本文も url もありません`);

    return { meta, body };
}

function build() {
    /** @type {Record<string, string>} 相対パス → 生成内容 */
    const outputs = {};

    for (const src of SOURCES) {
        const absDir = path.join(ROOT, src.dir);
        if (!fs.existsSync(absDir)) {
            error(`${src.dir}/ が見つかりません`);
            continue;
        }

        const files = fs.readdirSync(absDir)
            .filter(f => f.toLowerCase().endsWith('.md'))
            .sort((a, b) => orderNumber(a) - orderNumber(b) || a.localeCompare(b));

        const entries = [];
        for (const f of files) {
            const parsed = parseFile(path.join(absDir, f));
            if (!parsed) continue;
            const { meta, body } = parsed;
            const base = path.basename(f, path.extname(f));
            const pageFile = `${src.type}-${base}.html`;
            entries.push({ meta, body, pageFile, order: orderNumber(f), name: f });
        }

        const items = [];
        for (const e of entries) {
            const item = {};
            if (e.meta.title) item.title = e.meta.title;
            if (e.meta.date) item.date = e.meta.date;
            if (e.meta.image) item.image = e.meta.image;
            // ホバー説明：summary があればそれを、なければ本文のプレーンテキスト
            const hoverText = e.meta.summary || (e.body ? toPlainText(e.body) : '');
            if (hoverText) item.content = hoverText;
            if (e.meta.url) item.url = e.meta.url;
            item.link = `${ARTICLES_DIR}/${e.pageFile}`;
            items.push(item);

            const bodyHtml = e.body
                ? renderMarkdown(e.body)
                    // 記事ページは articles/ 配下なのでルート相対の画像パスを補正
                    .replace(/src="images\//g, 'src="../images/')
                : '<p>この記事の本文はありません。</p>';

            outputs[path.join(ARTICLES_DIR, e.pageFile)] = renderArticlePage({
                page: src.type,
                title: e.meta.title || 'Untitled',
                date: e.meta.date || '',
                bodyHtml,
                backHref: src.listPage,
                backLabel: src.listLabel,
            });
        }

        outputs[src.out] = JSON.stringify(items, null, 2) + '\n';
    }

    return outputs;
}

function readIfExist(p) {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const outputs = build();

for (const msg of warnings) console.warn(`WARN: ${msg}`);
if (errors.length) {
    for (const msg of errors) console.error(`ERROR: ${msg}`);
    process.exit(1);
}

const articlesAbs = path.join(ROOT, ARTICLES_DIR);
const keep = new Set(
    Object.keys(outputs)
        .filter(p => p.startsWith(ARTICLES_DIR + path.sep))
        .map(p => path.join(ROOT, p))
);

if (!CHECK_MODE && fs.existsSync(articlesAbs)) {
    for (const f of fs.readdirSync(articlesAbs)) {
        const full = path.join(articlesAbs, f);
        if (f.toLowerCase().endsWith('.html') && !keep.has(full)) {
            fs.unlinkSync(full);
            console.log(`削除しました: ${path.relative(ROOT, full)}`);
        }
    }
}

let failed = false;
for (const [rel, next] of Object.entries(outputs)) {
    const abs = path.join(ROOT, rel);
    const current = readIfExist(abs);

    if (CHECK_MODE) {
        if (current !== next) {
            console.error(`差分あり: ${rel}（npm run build で再生成してください）`);
            failed = true;
        } else {
            console.log(`OK: ${rel}`);
        }
        continue;
    }

    if (current === next) {
        console.log(`変更なし: ${rel}`);
    } else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, next, 'utf8');
        console.log(`生成しました: ${rel}`);
    }
}
process.exit(failed ? 1 : 0);
