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
    if (pageId === 'upload') detectLocation();
    if (pageId === 'search') applyFilters();
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

    const mockEntries = [
        { title: 'Morning walk in Central Park', date: 'Apr 28', sentiment: 'POSITIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=400' },
        { title: 'Coffee at the rooftop', date: 'Apr 27', sentiment: 'POSITIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400' },
        { title: 'Quiet evening journaling', date: 'Apr 26', sentiment: 'NEUTRAL', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400' },
        { title: 'Stressful day at work', date: 'Apr 25', sentiment: 'NEGATIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400' },
        { title: 'Sunset by the river', date: 'Apr 24', sentiment: 'POSITIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },
        { title: 'Reflecting on the week', date: 'Apr 23', sentiment: 'NEUTRAL', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400' }
    ];

    if (mockEntries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No entries yet</h3>
                <p>Start your journey by creating your first journal entry.</p>
                <button class="btn-primary" onclick="showPage('upload')" style="max-width:200px; margin-top:1rem;">Create Entry</button>
            </div>
        `;
        return;
    }

    container.innerHTML = mockEntries.map(entry => `
        <div class="video-card">
            <img src="${entry.thumbnail}" alt="${entry.title}" style="width:100%; height:160px; object-fit:cover; display:block;">
            <div style="padding:12px;">
                <h4 style="margin-bottom:6px;">${entry.title}</h4>
                <p style="font-size:12px; color:var(--muted); margin-bottom:8px;">${entry.date} · ${entry.location}</p>
                <span class="sentiment-badge sentiment-${entry.sentiment.toLowerCase()}">${entry.sentiment}</span>
            </div>
        </div>
    `).join('');
}

// --- Search ---
function handleSearch() {
    showPage('search');
    applyFilters();
}

// --- Upload ---
document.getElementById('uploadForm').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Publishing...';

    try {
        const title = document.getElementById('videoTitle').value;
        await apiRequest('/videos', 'POST', {
            title: title,
            s3Key: "uploads/temp-video.mp4"
        });
        submitBtn.textContent = 'Published!';
        setTimeout(() => {
            document.getElementById('uploadForm').reset();
            currentTags = [];
            renderTags();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);
    } catch (err) {
        submitBtn.textContent = 'Try again';
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);
    }
};

// --- Dashboard & Timeline ---
let timelineChart = null;

async function loadDashboard() {
    const mockData = [
        { date: 'Apr 22', score: 0.65, sentiment: 'POSITIVE' },
        { date: 'Apr 23', score: 0.42, sentiment: 'NEUTRAL' },
        { date: 'Apr 24', score: 0.78, sentiment: 'POSITIVE' },
        { date: 'Apr 25', score: 0.31, sentiment: 'NEGATIVE' },
        { date: 'Apr 26', score: 0.55, sentiment: 'NEUTRAL' },
        { date: 'Apr 27', score: 0.82, sentiment: 'POSITIVE' },
        { date: 'Apr 28', score: 0.71, sentiment: 'POSITIVE' }
    ];

    const ctx = document.getElementById('timelineCanvas').getContext('2d');

    if (timelineChart) timelineChart.destroy();

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: mockData.map(d => d.date),
            datasets: [{
                label: 'Sentiment Score',
                data: mockData.map(d => d.score),
                borderColor: '#c9a96e',
                backgroundColor: 'rgba(201, 169, 110, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#c9a96e',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Score: ${ctx.parsed.y} (${mockData[ctx.dataIndex].sentiment})`
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 1,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888580' }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#888580' }
                }
            }
        }
    });

    loadRecentEntries();
}

function loadRecentEntries() {
    const mockEntries = [
        { title: 'Morning walk in Central Park', date: 'Apr 28', sentiment: 'POSITIVE', location: 'New York, USA' },
        { title: 'Coffee at the rooftop', date: 'Apr 27', sentiment: 'POSITIVE', location: 'New York, USA' },
        { title: 'Quiet evening journaling', date: 'Apr 26', sentiment: 'NEUTRAL', location: 'New York, USA' },
        { title: 'Stressful day at work', date: 'Apr 25', sentiment: 'NEGATIVE', location: 'New York, USA' }
    ];

    const container = document.getElementById('recent-entries');
    container.innerHTML = mockEntries.map(entry => `
        <div class="entry-item">
            <div>
                <div class="entry-title">${entry.title}</div>
                <div class="entry-meta">${entry.date} · ${entry.location}</div>
            </div>
            <span class="sentiment-badge sentiment-${entry.sentiment.toLowerCase()}">${entry.sentiment}</span>
        </div>
    `).join('');
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

// --- Upload Page: Location ---
function detectLocation() {
    const input = document.getElementById('videoLocation');

    if (!navigator.geolocation) {
        input.placeholder = 'Geolocation not supported';
        return;
    }

    input.placeholder = 'Detecting location...';
    input.value = '';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                const data = await response.json();
                const city = data.address.city || data.address.town || data.address.village || '';
                const country = data.address.country || '';
                input.value = city && country ? `${city}, ${country}` : data.display_name;
            } catch (err) {
                input.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            }
        },
        (err) => {
            input.placeholder = 'Location permission denied';
            console.error(err);
        }
    );
}

// --- Search Page ---
const searchEntries = [
    { title: 'Morning walk in Central Park', date: '2026-04-28', sentiment: 'POSITIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=400' },
    { title: 'Coffee at the rooftop', date: '2026-04-27', sentiment: 'POSITIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400' },
    { title: 'Quiet evening journaling', date: '2026-04-26', sentiment: 'NEUTRAL', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400' },
    { title: 'Stressful day at work', date: '2026-04-25', sentiment: 'NEGATIVE', location: 'New York, USA', thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400' },
    { title: 'Sunset in Tokyo', date: '2026-04-15', sentiment: 'POSITIVE', location: 'Tokyo, Japan', thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },
    { title: 'Lost in Shibuya', date: '2026-04-14', sentiment: 'NEUTRAL', location: 'Tokyo, Japan', thumbnail: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400' }
];

function applyFilters() {
    const query = document.getElementById('globalSearch').value.toLowerCase().trim();
    const selectedEmotions = Array.from(document.querySelectorAll('.search-filters input[type="checkbox"]:checked')).map(c => c.value);
    const locationFilter = document.getElementById('filter-location').value.toLowerCase().trim();
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    let results = searchEntries.filter(entry => {
        if (query && !entry.title.toLowerCase().includes(query)) return false;
        if (selectedEmotions.length > 0 && !selectedEmotions.includes(entry.sentiment)) return false;
        if (locationFilter && !entry.location.toLowerCase().includes(locationFilter)) return false;
        if (dateFrom && entry.date < dateFrom) return false;
        if (dateTo && entry.date > dateTo) return false;
        return true;
    });

    renderSearchResults(results);
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    const summary = document.getElementById('search-summary');

    if (results.length === 0) {
        summary.textContent = 'No entries match your filters';
        container.innerHTML = `
            <div class="empty-state">
                <h3>Nothing found</h3>
                <p>Try adjusting your filters or search terms.</p>
            </div>
        `;
        return;
    }

    summary.textContent = `Showing ${results.length} ${results.length === 1 ? 'entry' : 'entries'}`;
    container.innerHTML = results.map(entry => `
        <div class="video-card">
            <img src="${entry.thumbnail}" alt="${entry.title}" style="width:100%; height:160px; object-fit:cover; display:block;">
            <div style="padding:12px;">
                <h4 style="margin-bottom:6px;">${entry.title}</h4>
                <p style="font-size:12px; color:var(--muted); margin-bottom:8px;">${formatDate(entry.date)} · ${entry.location}</p>
                <span class="sentiment-badge sentiment-${entry.sentiment.toLowerCase()}">${entry.sentiment}</span>
            </div>
        </div>
    `).join('');
}

function formatDate(isoDate) {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function resetFilters() {
    document.querySelectorAll('.search-filters input[type="checkbox"]').forEach(c => c.checked = false);
    document.getElementById('filter-location').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('globalSearch').value = '';
    applyFilters();
}