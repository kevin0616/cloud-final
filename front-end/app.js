const API_BASE_URL     = "https://p4v9m8o862.execute-api.us-east-1.amazonaws.com/dev";
const VIDEO_BUCKET_URL = 'https://amzn-storage-bucket-final.s3.us-east-1.amazonaws.com';
window._allVideos = [];
// --- Auth Guard ---
const ID_TOKEN = localStorage.getItem('id_token');
if (!ID_TOKEN) window.location.href = 'auth.html';

// --- Logout ---
function logout() {
    localStorage.removeItem('id_token');
    localStorage.removeItem('email');
    window.location.href = 'auth.html';
}

// --- Page Navigation ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`${pageId}-page`).style.display = 'block';
    if (pageId === 'home')      loadFeed();
    if (pageId === 'dashboard') loadDashboard();
    if (pageId === 'upload')    detectLocation();
    if (pageId === 'search')    applyFilters();
}

// --- API Helper ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('id_token');
    const options = {
        method,
        headers: { 'Authorization': token, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (response.status === 401) {
        localStorage.removeItem('id_token');
        window.location.href = 'auth.html';
        return;
    }
    return response.json();
}

// ─────────────────────────────────────────
// HOME FEED
// ─────────────────────────────────────────
/*
async function loadFeed() {
    const container = document.getElementById('video-feed');
    container.innerHTML = '<p style="color:var(--muted);padding:1rem;">Loading...</p>';
    try {
        const data = await apiRequest('/feed');
        const videos = data?.videos ?? [];
        window._allVideos = videos;  // cache for search page

        if (videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No entries yet</h3>
                    <p>Start your journey by creating your first journal entry.</p>
                    <button class="btn-primary" onclick="showPage('upload')"
                        style="max-width:200px;margin-top:1rem;">Create Entry</button>
                </div>`;
            return;
        }
        container.innerHTML = videos.map(v => renderVideoCard(v)).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:var(--muted);">Error loading feed.</p>';
    }
}
*/

function handleSearch() {
    showPage('search');
}

async function applyFilters() {
    let videos = [];
    
    try {
        if (window._allVideos && window._allVideos.length > 0) {
            videos = window._allVideos;
        } else {
            const data = await apiRequest('/feed');
            videos = data?.videos ?? [];
            window._allVideos = videos;
        }

        const query    = (document.getElementById('globalSearch')?.value ?? '').toLowerCase().trim();
        const location = (document.getElementById('filter-location')?.value ?? '').toLowerCase().trim();
        const dateFrom = document.getElementById('filter-date-from')?.value ?? '';
        const dateTo   = document.getElementById('filter-date-to')?.value ?? '';
        const selected = Array.from(
            document.querySelectorAll('.search-filters input[type="checkbox"]:checked')
        ).map(c => c.value);

        const results = videos.filter(v => {
            const title      = (v.title ?? '').toLowerCase();
            const transcript = (v.transcript ?? '').toLowerCase();
            const loc        = (v.location ?? '').toLowerCase();
            const date       = (v.createdAt ?? '').slice(0, 10);
            const sentiment  = (v.sentiment ?? '').toUpperCase();
            const tags       = Array.isArray(v.tags) ? v.tags : [];

            if (query && !title.includes(query) && !transcript.includes(query) && !tags.some(tag => String(tag).toLowerCase().includes(query))) return false;
            if (selected.length > 0 && !selected.includes(sentiment)) return false;
            if (location && !loc.includes(location)) return false;
            if (dateFrom && date < dateFrom) return false;
            if (dateTo && date > dateTo) return false;
            return true;
        });

        const summary   = document.getElementById('search-summary');
        const container = document.getElementById('search-results');
        if (!summary || !container) return;

        summary.textContent = results.length === videos.length
            ? `${results.length} ${results.length === 1 ? 'entry' : 'entries'}`
            : `${results.length} of ${videos.length} entries`;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Nothing found</h3>
                    <p>Try adjusting your filters or search terms.</p>
                </div>`;
            return;
        }

        container.innerHTML = results.map(v => renderVideoCard(v)).join('');
            
    } catch (err) {
        console.error(err);
    }
}

function resetFilters() {
    document.querySelectorAll('.search-filters input[type="checkbox"]').forEach(c => c.checked = false);
    const loc  = document.getElementById('filter-location');
    const from = document.getElementById('filter-date-from');
    const to   = document.getElementById('filter-date-to');
    if (loc)  loc.value  = '';
    if (from) from.value = '';
    if (to)   to.value   = '';
    document.getElementById('globalSearch').value = '';
    applyFilters();
}

// ─────────────────────────────────────────
// SHARED CARD RENDERER
// ─────────────────────────────────────────

function renderVideoCard(v) {
    const { videoId = '', title = 'Untitled', desc = '', createdAt = '',
            s3Key = '', location = '', sentiment = 'NEUTRAL' } = v;
    const dateStr     = createdAt ? formatDate(createdAt) : '';
    const locationStr = (location ?? '').trim();
    const videoUrl    = `${VIDEO_BUCKET_URL}/${s3Key}`;
    const sentClass   = sentiment.toLowerCase();
    const tags       = (v.tags || []).slice(0, 4);
    const keyPhrases = (v.keyPhrases || []).slice(0, 4).map(k => k.text || k);
    const phrases    = [...tags, ...keyPhrases].slice(0, 6);

    return `
        <div class="video-card" data-video-id="${videoId}">
            <video
                src="${videoUrl}"
                style="width:100%; height:160px; object-fit:cover; display:block; background:#111;"
                preload="metadata"
                playsinline
                onclick="showVideoDetail('${videoId}')"
            ></video>
            <div style="padding:12px;">
                <h4 style="margin-bottom:6px;">${escapeHtml(title)}</h4>
                <p style="font-size:12px; color:var(--muted); margin-bottom:8px;">
                    ${dateStr}${dateStr && locationStr ? ' · ' : ''}${escapeHtml(locationStr)}
                </p>
                ${desc ? `<p style="font-size:13px; color:var(--muted); margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(desc)}</p>` : ''}
                <div style="margin-top:1rem;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <span class="sentiment-badge sentiment-${sentClass}">${sentiment}</span>
                    ${phrases.map(p => `
                        <span style="font-size:12px;padding:4px 10px;border-radius:20px;
                            background:rgba(255,255,255,0.05);color:var(--muted);
                            border:0.5px solid var(--border);">
                            ${p}
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────

document.getElementById('uploadForm').onsubmit = async (e) => {
    e.preventDefault();

    const title       = document.getElementById('videoTitle').value.trim();
    const description = document.getElementById('videoDesc').value.trim();
    const location    = document.getElementById('videoLocation').value.trim();
    const tags        = Array.from(document.querySelectorAll('#tag-pills .tag-pill'))
                            .map(pill => pill.textContent.replace('×', '').trim());
    const submitBtn   = e.target.querySelector('button[type="submit"]');
    const isRecord    = document.getElementById('mode-record-btn').classList.contains('active');
    const file        = isRecord
        ? (recordedBlob ? new File([recordedBlob], 'recorded.webm', { type: 'video/webm' }) : null)
        : document.getElementById('videoFile').files[0];

    if (!file) return alert(isRecord ? 'Please record a video first' : 'Please select a video file');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Getting upload URL...';

    try {
        const presignRes = await apiRequest('/videos/upload-url', 'POST', {
            fileName: file.name, contentType: file.type || 'video/mp4'
        });
        const { uploadUrl, s3Key } = presignRes;

        submitBtn.textContent = 'Uploading video...';
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'video/mp4' },
            body: file
        });
        if (!uploadRes.ok) throw new Error('S3 upload failed');

        submitBtn.textContent = 'Saving...';
        await apiRequest('/videos', 'POST', {
            title, description, location, tags, s3Key,
            fileSize: file.size, mimeType: file.type
        });

        alert('Video uploaded successfully!');
        e.target.reset();
        document.getElementById('tag-pills').innerHTML = '';
        currentTags = [];
        showPage('search');
    } catch (err) {
        console.error(err);
        alert('Upload failed: ' + err.message);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish to Feed';
};

// ─────────────────────────────────────────
// UPLOAD PAGE: MODE, TAGS, CAMERA, LOCATION
// ─────────────────────────────────────────

function setMode(mode) {
    document.getElementById('upload-section').style.display  = mode === 'upload' ? 'block' : 'none';
    document.getElementById('record-section').style.display  = mode === 'record' ? 'block' : 'none';
    document.getElementById('mode-upload-btn').classList.toggle('active', mode === 'upload');
    document.getElementById('mode-record-btn').classList.toggle('active', mode === 'record');
    mode === 'record' ? startCamera() : stopCamera();
}

let currentTags = [];

function handleTagAdd(e) {
    if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
        e.preventDefault();
        const tag = e.target.value.replace(/,$/, '').trim();
        if (tag && !currentTags.includes(tag) && currentTags.length < 6) {
            currentTags.push(tag);
            e.target.value = '';
            renderTags();
        }
    }
}

function removeTag(i) { currentTags.splice(i, 1); renderTags(); }

function renderTags() {
    document.getElementById('tag-pills').innerHTML = currentTags.map((tag, i) =>
        `<span class="tag-pill" onclick="removeTag(${i})">${tag} ×</span>`
    ).join('');
}

let mediaRecorder, recordedChunks = [], recordedBlob = null,
    recordingStream = null, recordingTimer = null, recordingSeconds = 0;

async function startCamera() {
    try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('preview').srcObject = recordingStream;
    } catch (err) { alert('Could not access camera. Please grant camera permission.'); }
}

function stopCamera() {
    if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()); recordingStream = null; }
}

async function toggleRecording() {
    const btn = document.getElementById('record-btn');
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        if (!recordingStream) await startCamera();
        if (!recordingStream) return;
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(recordingStream);
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            const pb = document.getElementById('recorded-playback');
            pb.src = URL.createObjectURL(recordedBlob);
            pb.style.display = 'block';
        };
        mediaRecorder.start();
        recordingSeconds = 0;
        document.getElementById('record-timer').textContent = '00:00';
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
            const s = String(recordingSeconds % 60).padStart(2, '0');
            document.getElementById('record-timer').textContent = `${m}:${s}`;
        }, 1000);
        btn.textContent = 'Stop Recording';
        btn.classList.add('active');
    } else {
        mediaRecorder.stop();
        clearInterval(recordingTimer);
        btn.textContent = 'Start Recording';
        btn.classList.remove('active');
    }
}

function detectLocation() {
    const input = document.getElementById('videoLocation');
    if (!navigator.geolocation) { input.placeholder = 'Geolocation not supported'; return; }
    input.placeholder = 'Detecting location...';
    input.value = '';
    navigator.geolocation.getCurrentPosition(async pos => {
        try {
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
            const data = await res.json();
            const city    = data.address.city || data.address.town || data.address.village || '';
            const country = data.address.country || '';
            input.value = city && country ? `${city}, ${country}` : data.display_name;
        } catch { input.value = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`; }
    }, () => { input.placeholder = 'Location permission denied'; });
}

// ─────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

showPage('search');
