const API_INSTANCES = [
    'https://pipedapi.lunar.icu',
    'https://pipedapi.smnz.de',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.kavin.rocks'
];
let API_BASE = null;
const YT_API_KEY = localStorage.getItem('yt_api_key');

// Settings Modal Logic
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = YT_API_KEY || '';
    settingsModal.style.display = 'flex';
});
closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
saveApiKeyBtn.addEventListener('click', () => {
    localStorage.setItem('yt_api_key', apiKeyInput.value.trim());
    location.reload();
});

// Fetch directly (Proxies are blocked by your local firewall)
async function fetchApi(path) {
    return await fetch(`${API_BASE}${path}`);
}

function parseISO8601Duration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return hours * 3600 + minutes * 60 + seconds;
}

// Find a working instance on load
async function findWorkingInstance() {
    for (const url of API_INSTANCES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const testUrl = `${url}/trending?region=US`;
            const response = await fetch(testUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.ok) {
                API_BASE = url;
                console.log("Using API:", API_BASE);
                return;
            }
        } catch (e) {
            console.log(`Instance ${url} failed via proxy, trying next...`);
        }
    }
}

// DOM Elements
const videoGrid = document.getElementById('videoGrid');
const loader = document.getElementById('loader');
const sectionTitle = document.getElementById('sectionTitle');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchSuggestions = document.getElementById('searchSuggestions');
const navHome = document.getElementById('navHome');
const navTrending = document.getElementById('navTrending');
const mobileNavHome = document.getElementById('mobileNavHome');
const mobileNavTrending = document.getElementById('mobileNavTrending');

// Player Elements
const playerOverlay = document.getElementById('playerOverlay');
const closePlayerBtn = document.getElementById('closePlayer');
const pipBtn = document.getElementById('pipBtn');
const nativePlayer = document.getElementById('nativePlayer');
const iframePlayer = document.getElementById('iframePlayer');
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

// Fetch and Render Trending (Randomized Home Feed)
async function loadTrending() {
    sectionTitle.textContent = "Recommended For You";
    videoGrid.innerHTML = '';
    loader.style.display = 'block';

    // YouTube Video Categories: 0 (All), 10 (Music), 17 (Sports), 20 (Gaming), 23 (Comedy), 24 (Entertainment), 28 (Tech)
    const categories = ['', '&videoCategoryId=10', '&videoCategoryId=17', '&videoCategoryId=20', '&videoCategoryId=23', '&videoCategoryId=24', '&videoCategoryId=28'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];

    try {
        if (YT_API_KEY) {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=IN&maxResults=50${randomCategory}&key=${YT_API_KEY}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            
            // Shuffle the results array so they are always in a random order
            let items = data.items;
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }

            const formatted = items.slice(0, 30).map(item => ({
                url: `/watch?v=${item.id}`,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url,
                uploaderName: item.snippet.channelTitle,
                views: item.statistics.viewCount,
                duration: parseISO8601Duration(item.contentDetails.duration)
            }));
            renderVideos(formatted);
            return;
        }

        if (!API_BASE) await findWorkingInstance();
        const response = await fetchApi('/trending?region=US');
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
        if (YT_API_KEY) {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=30&key=${YT_API_KEY}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const formatted = data.items.map(item => ({
                url: `/watch?v=${item.id.videoId}`,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url,
                uploaderName: item.snippet.channelTitle,
                views: 0,
                duration: 0
            }));
            renderVideos(formatted);
            return;
        }

        if (!API_BASE) await findWorkingInstance();
        const response = await fetchApi(`/search?q=${encodeURIComponent(query)}&filter=all`);
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

    const html = videos.filter(v => v.type === 'stream' || YT_API_KEY).map(video => {
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
    
    // Reset players and unlock audio context for iOS
    iframePlayer.style.display = 'none';
    nativePlayer.style.display = 'block';
    iframePlayer.src = '';
    nativePlayer.src = '';
    
    // iOS Autoplay unlock trick (must be synchronous with click)
    nativePlayer.play().catch(() => {});
    nativePlayer.pause();
    
    playerLoader.style.display = 'flex';
    
    // Reset info
    playerTitle.textContent = 'Loading...';
    playerChannelName.textContent = '';
    playerViews.textContent = '';
    playerDescription.textContent = '';
    playerChannelAvatar.src = '';

    try {
        if (YT_API_KEY) {
            // Fetch metadata from YouTube API so the UI populates immediately
            fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YT_API_KEY}`)
                .then(res => res.json())
                .then(ytData => {
                    if (ytData.items && ytData.items.length > 0) {
                        const item = ytData.items[0];
                        playerTitle.textContent = item.snippet.title;
                        playerChannelName.textContent = item.snippet.channelTitle;
                        playerViews.textContent = `${formatViews(item.statistics.viewCount)} views`;
                        playerDescription.textContent = item.snippet.description || '';
                        
                        // Fetch related videos using title keyword
                        fetchRelatedVideos(item.snippet.title);
                    }
                }).catch(console.error);
        }

        if (!API_BASE && !YT_API_KEY) await findWorkingInstance();
        if (YT_API_KEY && !API_BASE) API_BASE = API_INSTANCES[0]; 

        const response = await fetchApi(`/streams/${videoId}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);
        
        let bestStream = null;
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

        // Only update UI from Piped if YouTube API didn't already do it
        if (!YT_API_KEY) {
            playerTitle.textContent = data.title;
            playerChannelName.textContent = data.uploader;
            playerViews.textContent = `${formatViews(data.views)} views`;
            playerDescription.textContent = data.description || '';
            playerChannelAvatar.src = data.uploaderAvatar || 'https://via.placeholder.com/48';
            
            // If Piped works, render related streams directly
            if (data.relatedStreams && data.relatedStreams.length > 0) {
                renderRelatedVideos(data.relatedStreams);
            }
        } else if (data.uploaderAvatar) {
            playerChannelAvatar.src = data.uploaderAvatar;
        }
        
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
        console.error("Native stream failed, falling back to Iframe", err);
        // Fallback to Iframe Player
        nativePlayer.style.display = 'none';
        iframePlayer.style.display = 'block';
        // Add playsinline=1 so iOS allows autoplay in the iframe
        iframePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;
    } finally {
        playerLoader.style.display = 'none';
    }
}

// Fetch Related Videos via YouTube API keyword search
async function fetchRelatedVideos(title) {
    if (!YT_API_KEY) return;
    const relatedContainer = document.getElementById('relatedVideos');
    relatedContainer.innerHTML = '<p>Loading related videos...</p>';
    
    // Take first 3-4 words of title to find similar videos
    const keyword = encodeURIComponent(title.split(' ').slice(0, 4).join(' '));
    try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${keyword}&type=video&maxResults=15&key=${YT_API_KEY}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        const formatted = data.items.map(item => ({
            url: `/watch?v=${item.id.videoId}`,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url,
            uploaderName: item.snippet.channelTitle,
            views: 0,
            duration: 0
        }));
        renderRelatedVideos(formatted);
    } catch (err) {
        relatedContainer.innerHTML = '<p>Could not load related videos.</p>';
    }
}

// Render Related Videos in Player
function renderRelatedVideos(videos) {
    const relatedContainer = document.getElementById('relatedVideos');
    if (!videos || videos.length === 0) {
        relatedContainer.innerHTML = '<p>No related videos found.</p>';
        return;
    }

    const html = videos.map(video => {
        // Handle both Piped and YouTube API formats
        const thumbnail = video.thumbnail || (video.thumbnails && video.thumbnails[0]?.url) || '';
        const duration = video.duration ? formatTime(video.duration) : '';
        const views = video.views ? `${formatViews(video.views)} views` : '';
        const time = video.uploadedDate ? formatRelativeDate(video.uploadedDate) : '';
        const vidId = video.url.includes('?v=') ? video.url.split('?v=')[1] : video.url.split('/').pop();
        
        return `
            <div class="video-card" onclick="openVideo('${vidId}')" style="display: flex; gap: 10px; margin-bottom: 10px; background: transparent; border: none; box-shadow: none;">
                <div class="thumbnail" style="width: 160px; flex-shrink: 0; border-radius: 8px;">
                    <img src="${thumbnail}" alt="${video.title}" loading="lazy">
                    <span class="duration">${duration}</span>
                </div>
                <div class="video-details" style="padding: 0; display: flex; flex-direction: column; justify-content: center;">
                    <h3 class="video-title" style="font-size: 0.9rem; -webkit-line-clamp: 2;" title="${video.title}">${video.title}</h3>
                    <p class="channel-name" style="font-size: 0.8rem;">${video.uploaderName}</p>
                    <p class="video-stats" style="font-size: 0.75rem;">${views}</p>
                </div>
            </div>
        `;
    }).join('');

    relatedContainer.innerHTML = html;
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
        console.log("App backgrounded - relying on MediaSession for background audio");
    }
});

// JSONP Search Suggestions to bypass CORS
function fetchSuggestionsJSONP(query) {
    return new Promise((resolve) => {
        const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            // YouTube JSONP format: ["query", [["sugg1",0], ["sugg2",0]]]
            const suggestions = data[1].map(item => item[0]);
            resolve(suggestions);
        };
        const script = document.createElement('script');
        script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&jsonp=${callbackName}`;
        document.body.appendChild(script);
    });
}

// Live Search Suggestions
let suggestionTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(suggestionTimeout);
    const query = e.target.value.trim();
    
    if (!query) {
        searchSuggestions.style.display = 'none';
        return;
    }

    suggestionTimeout = setTimeout(async () => {
        try {
            const suggestions = await fetchSuggestionsJSONP(query);
            
            if (suggestions && suggestions.length > 0) {
                searchSuggestions.innerHTML = suggestions.map(text => 
                    `<div class="search-suggestion-item" onclick="applySuggestion('${text.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-magnifying-glass"></i> ${text}
                    </div>`
                ).join('');
                searchSuggestions.style.display = 'flex';
            } else {
                searchSuggestions.style.display = 'none';
            }
        } catch (err) {
            console.error("Suggestions error", err);
        }
    }, 200);
});

// Apply clicked suggestion
window.applySuggestion = function(text) {
    searchInput.value = text;
    searchSuggestions.style.display = 'none';
    searchVideos(text);
};

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        searchSuggestions.style.display = 'none';
    }
});

searchBtn.addEventListener('click', () => {
    searchSuggestions.style.display = 'none';
    searchVideos(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchSuggestions.style.display = 'none';
        searchVideos(searchInput.value);
    }
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
