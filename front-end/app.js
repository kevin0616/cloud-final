// ─── Cognito ──────────────
const COGNITO_CLIENT_ID = "YOUR_CLIENT_ID";
const COGNITO_REGION = "us-east-1";
const API_BASE_URL = "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/v1";
// ──────────────────────────────────────────────────

// --- Auth Guard ---
const ID_TOKEN = localStorage.getItem('id_token');
if (!ID_TOKEN) {
    window.location.href = 'auth.html';
}

// --- Logout ---
function logout() {
    localStorage.removeItem('id_token');
    localStorage.removeItem('email');
    window.location.href = 'auth.html';
}

// --- Page Navigation Logic ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`${pageId}-page`).style.display = 'block';

    if (pageId === 'home') loadFeed();
    if (pageId === 'dashboard') loadDashboard();
}

// --- API Helper ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('id_token');
    const options = {
        method,
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
        }
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

// --- Home Feed ---
async function loadFeed() {
    const container = document.getElementById('video-feed');
    container.innerHTML = "Loading...";
    try {
        const data = await apiRequest('/feed');
        container.innerHTML = data.videos.map(v => `
            <div class="video-card">
                <video src="${v.url}" controls></video>
                <h4>${v.videoId}</h4>
                <p>Sentiment: ${v.sentiment}</p>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = "Error loading feed."; }
}

// --- Search ---
async function handleSearch() {
    const q = document.getElementById('globalSearch').value;
    showPage('search');
    const container = document.getElementById('search-results');
    container.innerHTML = "Searching...";

    const data = await apiRequest(`/search?q=${encodeURIComponent(q)}&type=all`);
    container.innerHTML = data.results.map(item => `
        <div class="video-card">
            <h3>${item.resultType.toUpperCase()}</h3>
            <p>${item.title || item.id}</p>
        </div>
    `).join('');
}

// --- Upload ---
document.getElementById('uploadForm').onsubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('videoTitle').value;
    const result = await apiRequest('/videos', 'POST', {
        title: title,
        s3Key: "uploads/temp-video.mp4"
    });
    alert("Metadata saved! Processing started.");
};

// --- Dashboard & Timeline ---
async function loadDashboard() {
    const ctx = document.getElementById('timelineCanvas').getContext('2d');
    ctx.clearRect(0, 0, 400, 200);
    ctx.beginPath();
    ctx.moveTo(0, 100);
    for (let i = 0; i < 400; i += 40) {
        ctx.lineTo(i, 50 + Math.random() * 100);
    }
    ctx.stroke();
}

// Initial Load
showPage('home');


// --- Upload Page: Mode Toggle ---
function setMode(mode) {
    document.getElementById('upload-section').style.display = mode === 'upload' ? 'block' : 'none';
    document.getElementById('record-section').style.display = mode === 'record' ? 'block' : 'none';
    document.getElementById('mode-upload-btn').classList.toggle('active', mode === 'upload');
    document.getElementById('mode-record-btn').classList.toggle('active', mode === 'record');

    if (mode === 'record') {
        startCamera();
    } else {
        stopCamera();
    }
}

// --- Upload Page: Tags ---
let currentTags = [];

function handleTagAdd(e) {
    if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
        e.preventDefault();
        const newTag = e.target.value.replace(/,$/, '').trim();
        if (newTag && !currentTags.includes(newTag) && currentTags.length < 6) {
            currentTags.push(newTag);
            e.target.value = '';
            renderTags();
        }
    }
}

function removeTag(index) {
    currentTags.splice(index, 1);
    renderTags();
}

function renderTags() {
    const container = document.getElementById('tag-pills');
    container.innerHTML = currentTags.map((tag, i) => `
        <span class="tag-pill" onclick="removeTag(${i})">${tag} ×</span>
    `).join('');
}

// --- Upload Page: Camera Recording ---
let mediaRecorder;
let recordedChunks = [];
let recordedBlob = null;
let recordingStream = null;
let recordingTimer = null;
let recordingSeconds = 0;

async function startCamera() {
    try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('preview').srcObject = recordingStream;
    } catch (err) {
        alert('Could not access camera. Please grant camera permission.');
        console.error(err);
    }
}

function stopCamera() {
    if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
    }
}

async function toggleRecording() {
    const btn = document.getElementById('record-btn');

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        if (!recordingStream) await startCamera();
        if (!recordingStream) return;

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(recordingStream);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            const playback = document.getElementById('recorded-playback');
            playback.src = URL.createObjectURL(recordedBlob);
            playback.style.display = 'block';
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