"use strict";

// ==================== Neural Network Background ====================
class NeuralNetworkBackground {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'particle-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.pointerEvents = 'none';

        const old = document.getElementById('particle-canvas');
        if (old) old.remove();
        document.body.prepend(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.dpr = Math.max(1, window.devicePixelRatio || 1);

        this.resize();

        this.nodes = [];
        this.connectRadius = 120;
        this.maxNodes = 210;
        this.strength = 0.004;
        this.damping = 0.965;

        this.time = 0;
        this.animationId = 0;

        this.init();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.canvas.width = Math.floor(this.width * this.dpr);
        this.canvas.height = Math.floor(this.height * this.dpr);

        if (this.ctx) {
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        }

        // Re-init when size changes enough
        // (Keep it simple: rebuild nodes for consistent density.)
        this.init();
    }

    init() {
        if (!this.ctx) return;

        const area = this.width * this.height;
        const target = Math.floor(area / 70000);
        const nodeCount = Math.max(90, Math.min(this.maxNodes, target));

        this.nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            this.nodes.push(new NNNode(this.width, this.height));
        }

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animate();
    }

    animate() {
        const ctx = this.ctx;
        if (!ctx) return;

        this.time += 0.016;

        ctx.clearRect(0, 0, this.width, this.height);

        // Draw connections first (so nodes appear on top)
        for (let i = 0; i < this.nodes.length; i++) {
            const a = this.nodes[i];

            for (let j = i + 1; j < this.nodes.length; j++) {
                const b = this.nodes[j];

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist2 = dx * dx + dy * dy;

                const r = this.connectRadius;
                const r2 = r * r;

                if (dist2 > r2) continue;

                const dist = Math.sqrt(dist2) || 0.0001;
                const w = 1 - dist / r;

                const pulse = 0.65 + 0.35 * Math.sin(this.time * 1.2 + a.phase + b.phase);
                const alpha = 0.02 + 0.18 * w * pulse;
                const lineWidth = 0.3 + 1.4 * w * pulse;

                // Neural-ish wiring color
                ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
                ctx.lineWidth = lineWidth;

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                // Spring-like forces (so it looks alive)
                const nx = dx / dist;
                const ny = dy / dist;
                const force = this.strength * w * (0.7 + 0.3 * pulse);

                a.vx += nx * force;
                a.vy += ny * force;
                b.vx -= nx * force;
                b.vy -= ny * force;
            }
        }

        for (const node of this.nodes) {
            node.vx *= this.damping;
            node.vy *= this.damping;

            node.x += node.vx;
            node.y += node.vy;

            if (node.x < 0) {
                node.x = 0;
                node.vx *= -0.8;
            }
            if (node.x > this.width) {
                node.x = this.width;
                node.vx *= -0.8;
            }
            if (node.y < 0) {
                node.y = 0;
                node.vy *= -0.8;
            }
            if (node.y > this.height) {
                node.y = this.height;
                node.vy *= -0.8;
            }
        }

        // Draw nodes
        for (const node of this.nodes) {
            const glow = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * 2 + node.phase));
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.55 * glow})`;
            ctx.fill();

            // Tiny core
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(0.6, node.size * 0.45), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(120, 220, 255, ${0.25 + 0.35 * glow})`;
            ctx.fill();
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

class NNNode {
    constructor(width, height) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        const speed = (Math.random() - 0.5) * 0.6;
        this.vx = speed;
        this.vy = (Math.random() - 0.5) * 0.6;
        this.size = Math.random() * 1.5 + 0.6;
        this.phase = Math.random() * Math.PI * 2;
    }
}

// ==================== 3D Card Effect ====================
class Card3DEffect {
    constructor(selector) {
        this.cards = document.querySelectorAll(selector);
        this.init();
    }

    init() {
        this.cards.forEach(card => {
            card.addEventListener('mousemove', (e) => this.handleMouseMove(e, card));
            card.addEventListener('mouseleave', () => this.handleMouseLeave(card));
        });
    }

    handleMouseMove(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    }

    handleMouseLeave(card) {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    }
}

// ==================== Achievements Filter ====================
class AchievementFilter {
    constructor() {
        const achievementsSection = document.querySelector('.achievements');
        if (!achievementsSection) return;

        this.currentFilter = 'all';
        this.createFilterUI();

        this.filterButtons = document.querySelector('.filter-buttons');
        this.items = document.querySelectorAll('.timeline-item');

        if (!this.filterButtons) return;
        this.init();
    }

    createFilterUI() {
        const achievementsSection = document.querySelector('.achievements');
        if (!achievementsSection) return;

        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-container';
        filterContainer.innerHTML = `
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all">すべて</button>
                <button class="filter-btn" data-filter="competition">競技</button>
                <button class="filter-btn" data-filter="certification">資格</button>
                <button class="filter-btn" data-filter="hackathon">ハッカソン</button>
            </div>
        `;

        const title = achievementsSection.querySelector('.section-title');
        if (title) title.after(filterContainer);
    }

    init() {
        this.assignCategories();
        const buttons = this.filterButtons.querySelectorAll('.filter-btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target;
                const filter = target.dataset.filter;
                this.filter(filter);
                buttons.forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
            });
        });
    }

    assignCategories() {
        this.items.forEach(item => {
            const title = item.querySelector('.achievement-title')?.textContent?.toLowerCase() || '';
            if (title.includes('試験') || title.includes('検定')) {
                item.dataset.category = 'certification';
            } else if (title.includes('camp') || title.includes('キャリア甲子園') || title.includes('サイバー')) {
                item.dataset.category = 'hackathon';
            } else {
                item.dataset.category = 'competition';
            }
        });
    }

    filter(category) {
        this.currentFilter = category;

        this.items.forEach(item => {
            if (category === 'all' || item.dataset.category === category) {
                item.style.display = '';
                item.style.animation = 'fadeInUp 0.4s ease-out';
            } else {
                item.style.display = 'none';
            }
        });

        // Hide empty year groups
        document.querySelectorAll('.year-group').forEach(group => {
            const visibleItems = group.querySelectorAll('.timeline-item:not([style*="display: none"])');
            group.style.display = visibleItems.length > 0 ? '' : 'none';
        });
    }
}

// ==================== GitHub Contributions Calendar ====================
class GitHubContributionsCalendar {
    constructor() {
        this.container = document.querySelector('.github-activity');
        this.username = document.body.dataset.githubUser || 'Reacher001-m';

        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.innerHTML = '<div class="loading">読み込み中...</div>';

        const img = document.createElement('img');
        img.alt = 'GitHub contributions calendar';
        // ghchart.rshah.org の SVG（rolling year / last year 相当）を埋め込み
        img.src = `https://ghchart.rshah.org/${this.username}`;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';

        img.onerror = () => {
            this.container.innerHTML = '<p class="error">GitHub contributions を取得できませんでした。</p>';
        };

        this.container.innerHTML = '';
        this.container.appendChild(img);
    }
}

// ==================== JSON-driven Articles (Works / Vlog) ====================
class ArticlesPage {
    constructor({ rootId, emptyId, jsonPath, cardClassName }) {
        this.root = document.getElementById(rootId);
        this.empty = document.getElementById(emptyId);
        this.jsonPath = jsonPath;
        this.cardClassName = cardClassName;
    }

    async init() {
        if (!this.root) return;

        try {
            const res = await fetch(this.jsonPath, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json();

            if (!Array.isArray(list) || list.length === 0) {
                this.showEmpty();
                return;
            }

            this.render(list);
            this.hideEmpty();
        } catch (e) {
            // file:// の場合など fetch が弾かれることがある
            this.showEmpty();
            this.empty.innerHTML = `読み込みに失敗しました。ローカル開発では <code>fetch</code> の制限（file://）に注意してください。`;
            console.error(e);
        }
    }

    render(list) {
        this.root.innerHTML = '';

        for (const item of list) {
            const card = document.createElement('article');
            card.className = `article-card ${this.cardClassName}`.trim();

            const titleEl = document.createElement('h3');
            titleEl.className = 'article-title';
            titleEl.textContent = item.title || 'Untitled';

            const dateEl = document.createElement('div');
            dateEl.className = 'article-date';
            dateEl.textContent = item.date || '';

            const contentEl = document.createElement('p');
            contentEl.className = 'article-content';
            contentEl.textContent = item.content || '';

            card.appendChild(titleEl);
            if (item.date) card.appendChild(dateEl);
            if (item.content) card.appendChild(contentEl);

            if (item.url) {
                const linkWrap = document.createElement('div');
                linkWrap.className = 'article-link-wrap';

                const a = document.createElement('a');
                a.className = 'article-link';
                a.href = item.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = '詳細 →';

                linkWrap.appendChild(a);
                card.appendChild(linkWrap);
            }

            this.root.appendChild(card);
        }
    }

    showEmpty() {
        if (!this.empty) return;
        this.empty.style.display = '';
    }

    hideEmpty() {
        if (!this.empty) return;
        this.empty.style.display = 'none';
    }
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', () => {
    // 1) Neural background
    new NeuralNetworkBackground();

    // 2) Nav active state
    const page = document.body.dataset.page || 'index';
    document.querySelectorAll('.top-tabs .tab').forEach(tab => {
        if (tab.dataset.tab === page) {
            tab.classList.add('active');
            tab.setAttribute('aria-current', 'page');
        }
    });

    // 3) 3D card effects
    new Card3DEffect('.timeline-item');
    new Card3DEffect('.interest-item');
    new Card3DEffect('.research-card');
    new Card3DEffect('.article-card');

    // 4) Achievements filter (only on index page)
    if (document.querySelector('.achievements')) {
        new AchievementFilter();
    }

    // 5) GitHub contributions calendar
    new GitHubContributionsCalendar();

    // 6) Works / Vlog pages
    const bodyPage = document.body.dataset.page;
    if (bodyPage === 'works') {
        const works = new ArticlesPage({
            rootId: 'works-root',
            emptyId: 'works-empty',
            jsonPath: 'works.json',
            cardClassName: 'works-card'
        });
        works.init();
    }

    if (bodyPage === 'vlog') {
        const vlog = new ArticlesPage({
            rootId: 'vlog-root',
            emptyId: 'vlog-empty',
            jsonPath: 'vlog.json',
            cardClassName: 'vlog-card'
        });
        vlog.init();
    }

    // 7) BGM consent + play (user gesture)
    const consentEl = document.getElementById('bgm-consent');
    const okBtn = document.getElementById('bgm-consent-ok');
    const noBtn = document.getElementById('bgm-consent-no');
    const bgm = document.getElementById('bgm');

    const consentKey = 'bgm-consent'; // "yes" / "no"
    const volumeKey = 'bgm-volume';

    const hideConsent = () => {
        if (consentEl) consentEl.style.display = 'none';
    };

    const applyVolume = () => {
        if (!bgm) return;
        const v = Number(localStorage.getItem(volumeKey) ?? '1');
        const volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
        try {
            bgm.volume = volume;
        } catch (_) { /* ignore */ }
        return volume;
    };

    const startBgm = () => {
        if (!bgm) return;
        applyVolume();

        const p = bgm.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Some browsers may still block; user can retry with the control.
            });
        }
    };

    const pauseBgm = () => {
        if (!bgm) return;
        try {
            bgm.pause();
        } catch (_) { /* ignore */ }
    };

    // Controls (added in each HTML page)
    const volRange = document.getElementById('bgm-volume');
    const toggleBtn = document.getElementById('bgm-toggle');

    const syncToggleText = () => {
        if (!toggleBtn || !bgm) return;
        toggleBtn.textContent = bgm.paused ? '再生' : '一時停止';
    };

    if (volRange) {
        const v = Number(localStorage.getItem(volumeKey) ?? '1');
        const volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
        volRange.value = String(Math.round(volume * 100));

        volRange.addEventListener('input', () => {
            const next = Number(volRange.value) / 100;
            try {
                localStorage.setItem(volumeKey, String(next));
            } catch (_) { /* ignore */ }
            if (bgm) bgm.volume = next;
            syncToggleText();
        });
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (!bgm) return;
            applyVolume();

            if (bgm.paused) {
                // If user explicitly clicks play, treat it as renewed consent.
                const consent = localStorage.getItem(consentKey);
                if (consent !== 'yes') {
                    try {
                        localStorage.setItem(consentKey, 'yes');
                    } catch (_) { /* ignore */ }
                    hideConsent();
                }

                startBgm();
            } else {
                pauseBgm();
            }

            syncToggleText();
        });
    }

    const consent = localStorage.getItem(consentKey);
    if (consent === 'yes') {
        hideConsent();
        startBgm();
        syncToggleText();
    } else if (consent === 'no') {
        hideConsent();
        pauseBgm();
        syncToggleText();
    } else {
        // No stored preference yet -> wait for [OK]/[NO].
        syncToggleText();

        if (okBtn) {
            okBtn.addEventListener('click', () => {
                try {
                    localStorage.setItem(consentKey, 'yes');
                } catch (_) { /* ignore */ }
                hideConsent();
                startBgm();
                syncToggleText();
            }, { once: true });
        }

        if (noBtn) {
            noBtn.addEventListener('click', () => {
                try {
                    localStorage.setItem(consentKey, 'no');
                } catch (_) { /* ignore */ }
                hideConsent();
                pauseBgm();
                syncToggleText();
            }, { once: true });
        }
    }
});
