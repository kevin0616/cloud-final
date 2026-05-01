
const API_BASE_URL      = "https://p4v9m8o862.execute-api.us-east-1.amazonaws.com/dev";

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

    const title       = document.getElementById('videoTitle').value.trim();
    const file        = document.getElementById('videoFile').files[0];
    const submitBtn   = e.target.querySelector('button[type="submit"]');

    if (!file) return alert('Please select a video file');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Getting upload URL...';

    try {
        const presignRes = await apiRequest('/videos/upload-url', 'POST', {
            fileName:    file.name,
            contentType: file.type || 'video/mp4'
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
            title:   title,
            s3Key:   s3Key,
            fileSize: file.size,
            mimeType: file.type
        });

        alert('Video uploaded successfully!');
        e.target.reset();
        showPage('home');

    } catch (err) {
        console.error(err);
        alert('Upload failed: ' + err.message);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish to Feed';
};

// --- Dashboard & Timeline ---
async function loadDashboard() {
    const ctx = document.getElementById('timelineCanvas').getContext('2d');
    ctx.clearRect(0, 0, 400, 200);
    ctx.beginPath();
    ctx.moveTo(0, 100);
    for(let i = 0; i < 400; i += 40) {
        ctx.lineTo(i, 50 + Math.random() * 100);
    }
    ctx.stroke();
}

// Initial Load
showPage('home');
