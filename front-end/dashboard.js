// ── Dashboard ──────────────────────────────────────────
async function loadDashboard() {
    const container = document.getElementById('dashboard-page');
    container.innerHTML = `
        <h2>Your Insights</h2>
        <div class="card" id="timeline-card">
            <h3>Emotion Timeline</h3>
            <p style="font-size:13px;color:var(--muted);margin-bottom:1.25rem;">
                Your sentiment trends across recent journal entries.
            </p>
            <canvas id="timelineCanvas" height="180"></canvas>
        </div>
        <div class="card">
            <h3>Recent Entries</h3>
            <div id="entries-list"></div>
        </div>
    `;

    try {
        const data = await apiRequest('/feed');
        const videos = (data.videos || [])
            .filter(v => v.status === 'done')
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (videos.length === 0) {
            document.getElementById('timeline-card').innerHTML += `
                <p style="color:var(--muted);font-size:13px;text-align:center;padding:1rem 0;">
                    No processed entries yet.
                </p>`;
            return;
        }

        drawTimeline(videos);
        renderEntries(videos);
    } catch (e) {
        console.error('Dashboard error:', e);
    }
}

// ── Draw sentiment timeline graph ──
function drawTimeline(videos) {
    const canvas = document.getElementById('timelineCanvas');
    if (!canvas) return;

    // Make canvas fill its container
    canvas.width  = canvas.parentElement.clientWidth - 48;
    canvas.height = 180;

    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const H      = canvas.height;
    const padL   = 40;
    const padR   = 20;
    const padT   = 20;
    const padB   = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    // Sentiment → numeric score (positive score from sentimentScore)
    const points = videos.map((v, i) => {
        const score = v.sentimentScore
            ? parseFloat(v.sentimentScore.Positive || 0)
            : (v.sentiment === 'POSITIVE' ? 0.8 : v.sentiment === 'NEUTRAL' ? 0.5 : 0.2);
        return {
            x: padL + (videos.length === 1 ? chartW / 2 : (i / (videos.length - 1)) * chartW),
            y: padT + chartH - score * chartH,
            score,
            video: v
        };
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    [0, 0.5, 1].forEach(val => {
        const y = padT + chartH - val * chartH;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + chartW, y);
        ctx.stroke();

        // Y labels
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font      = '11px DM Sans, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(1), padL - 8, y + 4);
    });

    // Area fill under curve
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, 'rgba(201,169,110,0.18)');
    grad.addColorStop(1, 'rgba(201,169,110,0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, padT + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padT + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Smooth line (bezier)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX  = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = '#c9a96e';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Dots + X labels
    points.forEach((p, i) => {
        // Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle   = '#c9a96e';
        ctx.fill();
        ctx.strokeStyle = '#0e0e0f';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // X label: entry number
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font      = '11px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${i + 1}`, p.x, H - 8);
    });
}

// ── Render recent entries list ──
function renderEntries(videos) {
    const list = document.getElementById('entries-list');
    if (!list) return;

    const sentimentColor = {
        POSITIVE: 'var(--success)',
        NEUTRAL:  'var(--accent)',
        NEGATIVE: 'var(--danger)',
        MIXED:    'var(--muted)'
    };
    const sentimentBg = {
        POSITIVE: 'var(--success-dim)',
        NEUTRAL:  'var(--accent-dim)',
        NEGATIVE: 'var(--danger-dim)',
        MIXED:    'rgba(255,255,255,0.05)'
    };

    // Show newest first
    const sorted = [...videos].reverse();

    list.innerHTML = sorted.map(v => {
        const date      = new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const location  = (v.locations && v.locations.length > 0) ? v.locations[0] : '';
        const sentiment = v.sentiment || 'NEUTRAL';
        const color     = sentimentColor[sentiment] || 'var(--muted)';
        const bg        = sentimentBg[sentiment]    || 'rgba(255,255,255,0.05)';

        return `
        <div class="entry-row" onclick="showVideoDetail('${v.videoId}')">
            <div class="entry-info">
                <div class="entry-title">${v.title || 'Untitled'}</div>
                <div class="entry-meta">
                    ${date}${location ? ` · ${location}` : ''}
                </div>
            </div>
            <div class="entry-badge" style="color:${color}; background:${bg}; border-color:${color};">
                ${sentiment}
            </div>
        </div>`;
    }).join('');
}

// ── Entry row styles (injected once) ──
(function injectDashboardStyles() {
    if (document.getElementById('dashboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.textContent = `
        .entry-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 0;
            border-bottom: 0.5px solid var(--border);
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .entry-row:last-child { border-bottom: none; }
        .entry-row:hover { opacity: 0.75; }
        .entry-title {
            font-size: 15px;
            font-weight: 500;
            color: var(--text);
            margin-bottom: 3px;
        }
        .entry-meta {
            font-size: 12px;
            color: var(--muted);
        }
        .entry-badge {
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.5px;
            padding: 4px 10px;
            border-radius: 20px;
            border: 0.5px solid;
            white-space: nowrap;
            margin-left: 1rem;
        }
    `;
    document.head.appendChild(style);
})();
