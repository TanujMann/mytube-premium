const API_INSTANCES = [
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.smnz.de',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.kavin.rocks'
];
let API_BASE = API_INSTANCES[0]; // Default

// Find a working instance on load
async function findWorkingInstance() {
    for (const url of API_INSTANCES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${url}/trending?region=US`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok) {
                API_BASE = url;
                console.log("Using API:", API_BASE);
                return;
            }
        } catch (e) {
            console.log(`Instance ${url} failed, trying next...`);
        }
    }
}

// DOM Elements
const videoGrid = document.getElementById('videoGrid');
const loader = document.getElementById('loader');
const sectionTitle = document.getElementById('sectionTitle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const navHome = document.getElementById('navHome');
const navTrending = document.getElementById('navTrending');
const mobileNavHome = document.getElementById('mobileNavHome');
const mobileNavTrending = document.getElementById('mobileNavTrending');

// Player Elements
const playerOverlay = document.getElementById('playerOverlay');
const closePlayerBtn = document.getElementById('closePlayer');
const pipBtn = document.getElementById('pipBtn');
const nativePlayer = document.getElementById('nativePlayer');
const playerLoader = document.getElementById('playerLoader');
const playerTitle = document.getElementById('playerTitle');
const playerChannelAvatar = document.getElementById('playerChannelAvatar');
const playerChannelName = document.getElementById('playerChannelName');
const playerViews = document.getElementById('playerViews');
const playerDescription = document.getElementById('playerDescription');

// Format Time
function formatTime(seconds) {
    if (!seconds) return 'Live';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format Views
function formatViews(views) {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views;
}

// Format Upload Date (approximate from relative text if needed, piped gives it directly)
function formatRelativeDate(uploaded) {
    // Piped gives approximate relative date like "2 days ago" in `uploadedDate`
    return uploaded || '';
}

// Fetch and Render Trending
async function loadTrending() {
    sectionTitle.textContent = "Trending Now";
    videoGrid.innerHTML = '';
    loader.style.display = 'block';

    try {
        await findWorkingInstance();
        const response = await fetch(`${API_BASE}/trending?region=US`);
        const data = await response.json();
        renderVideos(data);
    } catch (err) {
        console.error("Error fetching trending", err);
        videoGrid.innerHTML = '<p>Error loading videos. Please try again later.</p>';
    } finally {
        loader.style.display = 'none';
    }
}

// Fetch and Render Search
async function searchVideos(query) {
    if (!query.trim()) return;
    
    sectionTitle.textContent = `Search Results for "${query}"`;
    videoGrid.innerHTML = '';
    loader.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&filter=all`);
        const data = await response.json();
        // search endpoint returns { items: [...] }
        renderVideos(data.items);
    } catch (err) {
        console.error("Error searching", err);
        videoGrid.innerHTML = '<p>Error loading search results.</p>';
    } finally {
        loader.style.display = 'none';
    }
}

// Render Video Cards
function renderVideos(videos) {
    if (!videos || videos.length === 0) {
        videoGrid.innerHTML = '<p>No videos found.</p>';
        return;
    }

    const html = videos.filter(v => v.type === 'stream').map(video => {
        const thumbnail = video.thumbnail || (video.thumbnails && video.thumbnails[0]?.url) || '';
        const duration = formatTime(video.duration);
        const views = video.views ? `${formatViews(video.views)} views` : '';
        const time = formatRelativeDate(video.uploadedDate);
        const avatar = video.uploaderAvatar || 'https://via.placeholder.com/36';
        
        return `
            <div class="video-card" onclick="openVideo('${video.url.split('?v=')[1]}')">
                <div class="thumbnail">
                    <img src="${thumbnail}" alt="${video.title}" loading="lazy">
                    <span class="duration">${duration}</span>
                </div>
                <div class="video-details">
                    <img class="channel-avatar" src="${avatar}" alt="${video.uploaderName}">
                    <div class="video-info-meta">
                        <h3 class="video-title" title="${video.title}">${video.title}</h3>
                        <p class="channel-name">${video.uploaderName}</p>
                        <p class="video-stats">${views} • ${time}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    videoGrid.innerHTML = html;
}

// Open and Play Video
async function openVideo(videoId) {
    if (!videoId) return;

    playerOverlay.classList.add('active');
    nativePlayer.style.display = 'none';
    playerLoader.style.display = 'flex';
    
    // Reset info
    playerTitle.textContent = 'Loading...';
    playerChannelName.textContent = '';
    playerViews.textContent = '';
    playerDescription.textContent = '';
    playerChannelAvatar.src = '';
    nativePlayer.src = '';

    try {
        const response = await fetch(`${API_BASE}/streams/${videoId}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Find best video stream (prefer mp4 with video + audio, else combine, but for simple native HTML5 we want a combined stream)
        // Piped provides videoStreams (video only usually, sometimes combined).
        // Best approach for web without HLS.js is finding a combined mp4 format if possible.
        // Wait, piped often returns hls manifest. Let's use hls if possible, or direct mp4.
        
        let bestStream = null;
        
        // Look for combined streams
        const combined = data.videoStreams.filter(s => s.videoOnly === false && s.mimeType.includes('mp4'));
        if (combined.length > 0) {
            bestStream = combined.sort((a, b) => b.quality.localeCompare(a.quality))[0].url;
        } else {
            // Fallback to highest quality stream available
            const streams = data.videoStreams.filter(s => s.mimeType.includes('mp4'));
            if(streams.length > 0) bestStream = streams[0].url;
        }

        // If no direct combined MP4, we can fallback to the HLS playlist, but Safari only supports it natively.
        // For broad support without external library, we hope for a combined MP4.
        if (bestStream) {
            nativePlayer.src = bestStream;
        } else if (data.hls) {
            nativePlayer.src = data.hls;
        }

        playerTitle.textContent = data.title;
        playerChannelName.textContent = data.uploader;
        playerViews.textContent = `${formatViews(data.views)} views`;
        playerDescription.textContent = data.description || '';
        playerChannelAvatar.src = data.uploaderAvatar || 'https://via.placeholder.com/48';
        
        // Setup Media Session for Background Play (iOS/Android Lock Screen)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: data.title,
                artist: data.uploader,
                album: 'MyTube Premium',
                artwork: [
                    { src: data.uploaderAvatar || 'icon.png', sizes: '96x96', type: 'image/png' },
                    { src: data.uploaderAvatar || 'icon.png', sizes: '256x256', type: 'image/png' },
                    { src: data.uploaderAvatar || 'icon.png', sizes: '512x512', type: 'image/png' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => { nativePlayer.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { nativePlayer.pause(); });
            // For background play reliability on some mobile browsers
            navigator.mediaSession.setActionHandler('seekbackward', (details) => { nativePlayer.currentTime = Math.max(nativePlayer.currentTime - (details.seekOffset || 10), 0); });
            navigator.mediaSession.setActionHandler('seekforward', (details) => { nativePlayer.currentTime = Math.min(nativePlayer.currentTime + (details.seekOffset || 10), nativePlayer.duration); });
        }

        nativePlayer.style.display = 'block';
        nativePlayer.play();
    } catch (err) {
        console.error("Error loading stream", err);
        playerTitle.textContent = 'Failed to load video stream (Ad-blocker/Rate limit)';
    } finally {
        playerLoader.style.display = 'none';
    }
}

// Close Video Player
closePlayerBtn.addEventListener('click', () => {
    playerOverlay.classList.remove('active');
    nativePlayer.pause();
    nativePlayer.src = '';
    
    // Exit PiP if active
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(console.error);
    }
});

// Picture in Picture (PiP)
pipBtn.addEventListener('click', async () => {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (nativePlayer.requestPictureInPicture) {
            // Modern Web API
            await nativePlayer.requestPictureInPicture();
        } else if (nativePlayer.webkitSupportsPresentationMode && typeof nativePlayer.webkitSetPresentationMode === "function") {
            // iOS Safari Native PiP
            nativePlayer.webkitSetPresentationMode(nativePlayer.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
        } else {
            alert('Picture-in-Picture is not supported in this browser.');
        }
    } catch (err) {
        console.error('PiP Error:', err);
    }
});

// Handle visibility change to attempt keeping audio alive (iOS trick)
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && !nativePlayer.paused) {
        // iOS sometimes pauses video when backgrounded unless it's in PiP
        // Having mediaSession active usually lets the user resume from Control Center
        console.log("App backgrounded - relying on MediaSession for background audio");
    }
});

// Event Listeners
searchBtn.addEventListener('click', () => searchVideos(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchVideos(searchInput.value);
});

navHome.addEventListener('click', (e) => {
    e.preventDefault();
    navHome.classList.add('active');
    navTrending.classList.remove('active');
    mobileNavHome.classList.add('active');
    mobileNavTrending.classList.remove('active');
    searchInput.value = '';
    loadTrending();
});

navTrending.addEventListener('click', (e) => {
    e.preventDefault();
    navTrending.classList.add('active');
    navHome.classList.remove('active');
    mobileNavTrending.classList.add('active');
    mobileNavHome.classList.remove('active');
    loadTrending();
});

mobileNavHome.addEventListener('click', (e) => {
    e.preventDefault();
    navHome.classList.add('active');
    navTrending.classList.remove('active');
    mobileNavHome.classList.add('active');
    mobileNavTrending.classList.remove('active');
    searchInput.value = '';
    loadTrending();
});

mobileNavTrending.addEventListener('click', (e) => {
    e.preventDefault();
    navTrending.classList.add('active');
    navHome.classList.remove('active');
    mobileNavTrending.classList.add('active');
    mobileNavHome.classList.remove('active');
    loadTrending();
});

// Init
loadTrending();
