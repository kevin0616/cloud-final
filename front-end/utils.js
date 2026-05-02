// ── Video Popup (shared across feed and dashboard) ──────

function showVideoPopup(video) {
    // Remove existing popup if any
    const existing = document.getElementById('video-popup-overlay');
    if (existing) existing.remove();

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

    const sentiment = video.sentiment || 'NEUTRAL';
    const color     = sentimentColor[sentiment] || 'var(--muted)';
    const bg        = sentimentBg[sentiment]    || 'rgba(255,255,255,0.05)';
    const date      = new Date(video.createdAt).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
    const location  = (video.locations && video.locations.length > 0) ? ` · ${video.locations[0]}` : '';
    const tags       = (video.tags || []).slice(0, 4);
    const keyPhrases = (video.keyPhrases || []).slice(0, 4).map(k => k.text || k);
    const phrases    = [...tags, ...keyPhrases].slice(0, 6);
    
    const overlay = document.createElement('div');
    overlay.id = 'video-popup-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:1000;
        background:rgba(0,0,0,0.88);
        display:flex; align-items:center; justify-content:center;
        padding: 1rem;
        animation: fadeIn 0.2s ease;
    `;

    overlay.innerHTML = `
        <div id="video-popup-card" style="
            background: var(--surface);
            border: 0.5px solid var(--border);
            border-radius: 16px;
            width: 100%;
            max-width: 600px;
            padding: 1.5rem;
            position: relative;
            max-height: 90vh;
            overflow-y: auto;
        ">
            <button
                onclick="document.getElementById('video-popup-overlay').remove()"
                style="position:absolute;top:12px;right:12px;background:none;border:none;
                       color:var(--muted);font-size:18px;cursor:pointer;line-height:1;padding:4px;">
                ✕
            </button>

            <!-- Title & meta -->
            <h3 style="font-family:'DM Serif Display',serif;font-size:1.3rem;
                       margin-bottom:4px;padding-right:2rem;color:var(--text);">
                ${video.title || 'Untitled'}
            </h3>
            <p style="font-size:12px;color:var(--muted);margin-bottom:1.25rem;">
                ${date}${location}
            </p>

            <!-- Video player -->
            <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;">
                <video
                    id="popup-video-player"
                    controls
                    playsinline
                    style="width:100%;display:block;max-height:340px;object-fit:contain;"
                >
                    <source src="${video.url}" type="${video.mimeType || 'video/mp4'}">
                </video>
            </div>

            <!-- Subtitle loading indicator -->
            <div id="subtitle-status" style="font-size:12px;color:var(--muted);margin-top:6px;min-height:18px;"></div>

            <!-- tags -->
            <div style="margin-top:1rem;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <span style="
                    font-size:11px;font-weight:500;letter-spacing:0.5px;
                    padding:4px 12px;border-radius:20px;border:0.5px solid;
                    color:${color};background:${bg};border-color:${color};
                ">${sentiment}</span>
                ${phrases.map(p => `
                    <span style="font-size:12px;padding:4px 10px;border-radius:20px;
                        background:rgba(255,255,255,0.05);color:var(--muted);
                        border:0.5px solid var(--border);">
                        ${p}
                    </span>
                `).join('')}
            </div>

            <!-- Transcript -->
            
        </div>
    `;

    // Close on backdrop click
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });

    // Close on Escape key
    const onKeyDown = e => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown);
        }
    };
    document.addEventListener('keydown', onKeyDown);

    document.body.appendChild(overlay);

    // Load subtitle after popup is in DOM
    if (video.subtitleUrl) {
        const videoEl = document.getElementById('popup-video-player');
        const track   = document.createElement('track');
        track.src     = video.subtitleUrl;
        track.kind    = 'subtitles';
        track.srclang = 'en';
        track.label   = 'English';
        track.default = true;
        videoEl.appendChild(track);
        videoEl.addEventListener('loadedmetadata', () => {
            if (videoEl.textTracks[0]) {
                videoEl.textTracks[0].mode = 'showing';
            }
        });
    }
}

// ── Load subtitle via presigned URL ──────────────────────
async function loadSubtitle(subtitleKey) {
    const statusEl = document.getElementById('subtitle-status');
    const videoEl  = document.getElementById('popup-video-player');
    if (!videoEl) return;

    try {
        if (statusEl) statusEl.textContent = 'Loading subtitles...';

        // Get presigned URL for the .vtt file from your API
        const res = await apiRequest(`/subtitles/url?key=${encodeURIComponent(subtitleKey)}`);
        const subtitleUrl = res.url;

        // Add track element to video
        const track = document.createElement('track');
        track.src     = subtitleUrl;
        track.kind    = 'subtitles';
        track.srclang = 'en';
        track.label   = 'English';
        track.default = true;
        videoEl.appendChild(track);

        if (statusEl) statusEl.textContent = '';

        // Enable subtitles
        videoEl.addEventListener('loadedmetadata', () => {
            if (videoEl.textTracks[0]) {
                videoEl.textTracks[0].mode = 'showing';
            }
        });

    } catch (e) {
        console.warn('Subtitle load failed:', e);
        if (statusEl) statusEl.textContent = '';
    }
}

function showVideoDetail(videoId) {
    const video = (window._loadedVideos || []).find(v => v.videoId === videoId);
    if (video) {
        showVideoPopup(video);
    } else {
        console.warn('Video not found in cache:', videoId);
    }
}
