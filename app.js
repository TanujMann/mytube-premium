const API_INSTANCES = [
    'https://pipedapi.lunar.icu',
    'https://pipedapi.smnz.de',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.kavin.rocks'
];
let API_BASE = null;
const YT_API_KEY = localStorage.getItem('yt_api_key');

// YouTube Iframe API Setup
let ytPlayer;
let isYtPlayerReady = false;
let ytProgressInterval;

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('iframePlayer', {
        height: '100%',
        width: '100%',
        playerVars: {
            'playsinline': 1,
            'controls': 0, // hide yt controls since we use custom
            'disablekb': 1,
            'rel': 0
        },
        events: {
            'onReady': () => { isYtPlayerReady = true; },
            'onStateChange': onYtPlayerStateChange
        }
    });
};

function onYtPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        if (window.updatePlayBtnIcon) window.updatePlayBtnIcon(true);
        if (window.updateMiniPlayBtnIcon) window.updateMiniPlayBtnIcon(true);
        startYtProgressInterval();
    } else {
        if (window.updatePlayBtnIcon) window.updatePlayBtnIcon(false);
        if (window.updateMiniPlayBtnIcon) window.updateMiniPlayBtnIcon(false);
        stopYtProgressInterval();
    }
    
    if (event.data === YT.PlayerState.ENDED) {
        if (typeof playNextTrack === 'function') playNextTrack();
    }
}

function startYtProgressInterval() {
    stopYtProgressInterval();
    ytProgressInterval = setInterval(() => {
        if (!ytPlayer || !ytPlayer.getCurrentTime) return;
        const current = ytPlayer.getCurrentTime();
        const duration = ytPlayer.getDuration();
        if (duration > 0) {
            document.getElementById('currentTime').textContent = formatTime(current);
            document.getElementById('totalTime').textContent = formatTime(duration);
            document.getElementById('progressBarFill').style.width = `${(current / duration) * 100}%`;
        }
    }, 500);
}

function stopYtProgressInterval() {
    clearInterval(ytProgressInterval);
}

// Settings Modal Logic
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const favSingerInput = document.getElementById('favSingerInput');
const musicLangInput = document.getElementById('musicLangInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

// Onboarding Logic
const onboardingModal = document.getElementById('onboardingModal');
const obStep1 = document.getElementById('obStep1');
const obStep2 = document.getElementById('obStep2');
const obUsernameInput = document.getElementById('obUsernameInput');
const obAgeInput = document.getElementById('obAgeInput');
const obNextBtn = document.getElementById('obNextBtn');
const obStartBtn = document.getElementById('obStartBtn');
const pills = document.querySelectorAll('.pill');

obNextBtn.addEventListener('click', () => {
    const username = obUsernameInput.value.trim();
    const age = obAgeInput.value.trim();
    if (!username || !age) {
        alert("Please enter your name and age.");
        return;
    }
    localStorage.setItem('userName', username);
    localStorage.setItem('userAge', age);
    
    obStep1.style.display = 'none';
    obStep2.style.display = 'flex';
});

function checkSelectionReqs() {
    const langs = document.querySelectorAll('.pill[data-type="lang"].selected').length;
    const artists = document.querySelectorAll('.pill[data-type="artist"].selected').length;
    
    if (langs >= 3 && artists >= 3) {
        obStartBtn.disabled = false;
        obStartBtn.style.background = 'var(--accent)';
        obStartBtn.style.cursor = 'pointer';
        obStartBtn.style.boxShadow = '0 10px 20px rgba(239, 68, 68, 0.3)';
    } else {
        obStartBtn.disabled = true;
        obStartBtn.style.background = '#cbd5e1';
        obStartBtn.style.cursor = 'not-allowed';
        obStartBtn.style.boxShadow = 'none';
    }
}

pills.forEach(pill => {
    pill.addEventListener('click', () => {
        // Multi-select toggle
        pill.classList.toggle('selected');
        checkSelectionReqs();
    });
});

obStartBtn.addEventListener('click', () => {
    if (obStartBtn.disabled) return;

    const selectedLangs = Array.from(document.querySelectorAll('.pill[data-type="lang"].selected')).map(p => p.dataset.value);
    const selectedArtists = Array.from(document.querySelectorAll('.pill[data-type="artist"].selected')).map(p => p.dataset.value);
    
    const singer = selectedArtists.join(', ');
    const lang = selectedLangs.join(', ');
    
    localStorage.setItem('favSinger', singer);
    localStorage.setItem('musicLang', lang);
    localStorage.setItem('onboardingComplete', 'true');
    
    onboardingModal.style.display = 'none';
    
    // Sync with settings inputs
    favSingerInput.value = singer;
    musicLangInput.value = lang;
    
    loadTrending();
});

settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = YT_API_KEY || '';
    favSingerInput.value = localStorage.getItem('favSinger') || '';
    musicLangInput.value = localStorage.getItem('musicLang') || '';
    settingsModal.style.display = 'flex';
});
closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
saveApiKeyBtn.addEventListener('click', () => {
    localStorage.setItem('yt_api_key', apiKeyInput.value.trim());
    localStorage.setItem('favSinger', favSingerInput.value.trim());
    localStorage.setItem('musicLang', musicLangInput.value.trim());
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
const loader = document.getElementById('loader');
const sectionTitle = document.getElementById('sectionTitle');
const musicFeedContainer = document.getElementById('musicFeedContainer');
const featuredMusic = document.getElementById('featuredMusic');
const musicList = document.getElementById('musicList');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchSuggestions = document.getElementById('searchSuggestions');
const navHome = document.getElementById('navHome');
const navRecent = document.getElementById('navShorts'); // using old ID from HTML
const navTrending = document.getElementById('navTrending');
const mobileNavHome = document.getElementById('mobileNavHome');
const mobileNavRecent = document.getElementById('mobileNavRecent');
const mobileNavTrending = document.getElementById('mobileNavTrending');

// Player Elements
const playerOverlay = document.getElementById('playerOverlay');
const closePlayerBtn = document.getElementById('closePlayer');

const miniPlayer = document.getElementById('miniPlayer');
const miniPlayerArt = document.getElementById('miniPlayerArt');
const miniPlayerTitle = document.getElementById('miniPlayerTitle');
const miniPlayerArtist = document.getElementById('miniPlayerArtist');
const miniPlayPauseBtn = document.getElementById('miniPlayPauseBtn');
const miniNextBtn = document.getElementById('miniNextBtn');
const miniPlayerLeft = document.getElementById('miniPlayerLeft');
const pipBtn = document.getElementById('pipBtn');

const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const likeBtn = document.getElementById('likeBtn');
const likeIcon = document.getElementById('likeIcon');
const nativePlayer = document.getElementById('nativePlayer');
const iframePlayer = document.getElementById('iframePlayer');
const playerLoader = document.getElementById('playerLoader');
const playerTitle = document.getElementById('playerTitle');
const playerChannelAvatar = document.getElementById('playerChannelAvatar');
const playerChannelName = document.getElementById('playerChannelName');
const playerViews = document.getElementById('playerViews');
const playerDescription = document.getElementById('playerDescription');

// Shorts Elements
const shortsReelsContainer = document.getElementById('shortsReelsContainer');
const shortVideoWrapper = document.getElementById('shortVideoWrapper');
const shortNativePlayer = document.getElementById('shortNativePlayer');
const shortIframePlayer = document.getElementById('shortIframePlayer');
const shortLoader = document.getElementById('shortLoader');
const shortTitle = document.getElementById('shortTitle');
const shortChannel = document.getElementById('shortChannel');

let currentAudioContext = null;

// Format Time
let userMusicData = JSON.parse(localStorage.getItem('userMusicData')) || {
    history: [],
    mostPlayed: {},
    artists: {},
    liked: []
};

function saveMusicData() {
    localStorage.setItem('userMusicData', JSON.stringify(userMusicData));
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    seconds = Math.floor(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
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
    let customSinger = localStorage.getItem('favSinger') || null;
    let customLang = localStorage.getItem('musicLang') || 'English';
    
    let topArtist = customSinger;
    
    if (!topArtist) {
        const artists = Object.entries(userMusicData.artists).sort((a, b) => b[1] - a[1]);
        if (artists.length > 0) {
            topArtist = artists[0][0];
        }
    }
    
    if (topArtist) {
        sectionTitle.textContent = `Mix based on ${topArtist}`;
    } else {
        sectionTitle.textContent = "Recommended For You";
    }
    
    musicFeedContainer.style.display = 'flex';
    if(typeof shortsReelsContainer !== 'undefined') shortsReelsContainer.style.display = 'none';
    featuredMusic.innerHTML = '';
    musicList.innerHTML = '';
    loader.style.display = 'block';

    try {
        if (YT_API_KEY) {
            let apiUrl = '';
            if (topArtist || customLang !== 'English') {
                // Personalized search based on top artist and language
                let searchQuery = '';
                if(topArtist) searchQuery += topArtist + ' ';
                searchQuery += customLang + ' official video -mashup -jukebox -nonstop -"best of" -collection -mix';
                
                apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&videoCategoryId=10&maxResults=30&key=${YT_API_KEY}`;
                
                const res = await fetch(apiUrl, { cache: 'no-store' });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                
                const formatted = data.items.map(item => ({
                    url: `/watch?v=${item.id.videoId}`,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url,
                    uploaderName: item.snippet.channelTitle,
                    duration: "Auto"
                }));
                renderVideos(formatted);
                return;
            } else {
                // Generic Trending Music
                const categories = ['&videoCategoryId=10']; // Strictly Music
                const randomCategory = categories[0];
                apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=US&maxResults=50${randomCategory}&key=${YT_API_KEY}`;
                
                const res = await fetch(apiUrl, { cache: 'no-store' });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                
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
        }

        if (!API_BASE) await findWorkingInstance();
        
        // Piped fallback
        let response;
        if (topArtist || customLang !== 'English') {
            let searchQuery = '';
            if(topArtist) searchQuery += topArtist + ' ';
            searchQuery += customLang + ' official music -mashup -jukebox -nonstop -mix';
            response = await fetchApi(`/search?q=${encodeURIComponent(searchQuery)}&filter=music_songs`);
            const data = await response.json();
            renderVideos(data.items);
        } else {
            response = await fetchApi('/trending?region=US');
            const data = await response.json();
            renderVideos(data);
        }
        
    } catch (err) {
        console.error("Error fetching trending", err);
        musicList.innerHTML = '<p>Error loading videos. Please try again later.</p>';
    } finally {
        loader.style.display = 'none';
        
        // Hide Splash Screen on first load
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            setTimeout(() => {
                splashScreen.style.opacity = '0';
                setTimeout(() => splashScreen.remove(), 500);
            }, 800); // Give it a slight delay so it looks intentional
        }
    }
}



// Fetch and Render Search
async function searchVideos(query) {
    if (!query.trim()) return;
    
    sectionTitle.textContent = `Search Results for "${query}"`;
    videoGrid.style.display = 'grid';
    shortsReelsContainer.style.display = 'none';
    videoGrid.innerHTML = '';
    loader.style.display = 'block';

    try {
        if (YT_API_KEY) {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=30&key=${YT_API_KEY}`, { cache: 'no-store' });
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
        const response = await fetchApi(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
        const data = await response.json();
        renderVideos(data.items);
    } catch (err) {
        console.error(err);
        videoGrid.innerHTML = `<p style="color:var(--danger)">Error loading videos. Please make sure your API key is correct.</p>`;
    } finally {
        loader.style.display = 'none';
    }
}

// Fetch and Render Shorts
let shortsList = [];
let currentShortIndex = 0;

async function loadShorts() {
    sectionTitle.textContent = "YouTube Shorts";
    videoGrid.style.display = 'none';
    shortsReelsContainer.style.display = 'block';
    loader.style.display = 'block';
    
    // Stop any playing short
    shortNativePlayer.src = '';
    shortIframePlayer.src = '';

    try {
        if (YT_API_KEY) {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=%23shorts&type=video&videoDuration=short&maxResults=30&key=${YT_API_KEY}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            
            shortsList = data.items.map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                uploaderName: item.snippet.channelTitle
            }));
            
            if (shortsList.length > 0) {
                currentShortIndex = 0;
                playShort(currentShortIndex);
            }
            return;
        }

        if (!API_BASE) await findWorkingInstance();
        const response = await fetchApi('/trending?region=US');
        const data = await response.json();
        
        shortsList = data.map(item => ({
            id: item.url.split('v=')[1],
            title: item.title,
            uploaderName: item.uploaderName
        }));
        
        if (shortsList.length > 0) {
            currentShortIndex = 0;
            playShort(currentShortIndex);
        }
        
    } catch (err) {
        console.error(err);
        shortTitle.textContent = "Error loading shorts.";
    } finally {
        loader.style.display = 'none';
    }
}

async function playShort(index) {
    if (index < 0 || index >= shortsList.length) return;
    const short = shortsList[index];
    
    shortTitle.textContent = short.title;
    shortChannel.textContent = short.uploaderName;
    shortLoader.style.display = 'block';
    
    shortNativePlayer.style.display = 'none';
    shortIframePlayer.style.display = 'none';
    shortNativePlayer.src = '';
    shortIframePlayer.src = '';
    
    try {
        if (!API_BASE) await findWorkingInstance();
        const response = await fetchApi(`/streams/${short.id}`);
        const streamData = await response.json();
        
        if (streamData.error) throw new Error(streamData.error);
        
        const videoStreams = streamData.videoStreams || [];
        const mp4Streams = videoStreams.filter(s => s.mimeType && s.mimeType.includes('mp4'));
        const bestStream = mp4Streams[0] || videoStreams[0];
        
        if (bestStream && bestStream.url) {
            shortNativePlayer.style.display = 'block';
            shortNativePlayer.src = bestStream.url;
            
            // Audio context trick for iOS autoplay
            if (!currentAudioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) currentAudioContext = new AudioContext();
            }
            if (currentAudioContext && currentAudioContext.state === 'suspended') {
                currentAudioContext.resume();
            }
            
            shortNativePlayer.play().catch(e => console.log('Autoplay blocked:', e));
        } else {
            throw new Error("No MP4 found");
        }
    } catch (err) {
        console.log("Falling back to iframe for short", err);
        shortNativePlayer.style.display = 'none';
        shortIframePlayer.style.display = 'block';
        shortIframePlayer.src = `https://www.youtube.com/embed/${short.id}?autoplay=1&playsinline=1&loop=1&playlist=${short.id}`;
    } finally {
        shortLoader.style.display = 'none';
    }
}

// Shorts Swipe Gesture Logic
let shortStartY = 0;
let shortCurrentY = 0;
let isDragging = false;

function handleStart(e) {
    // Ignore if clicking a button
    if (e.target.closest('button')) return;
    isDragging = true;
    shortStartY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    shortCurrentY = shortStartY;
}

function handleMove(e) {
    if (!isDragging) return;
    shortCurrentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
}

function handleEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    const distance = shortStartY - shortCurrentY;
    
    if (distance > 50) { // Swiped Up -> Next Short
        if (currentShortIndex < shortsList.length - 1) {
            currentShortIndex++;
            playShort(currentShortIndex);
        }
    } else if (distance < -50) { // Swiped Down -> Prev Short
        if (currentShortIndex > 0) {
            currentShortIndex--;
            playShort(currentShortIndex);
        }
    }
    
    shortStartY = 0;
    shortCurrentY = 0;
}

// Touch Events
shortsReelsContainer.addEventListener('touchstart', handleStart, { passive: true });
shortsReelsContainer.addEventListener('touchmove', handleMove, { passive: true });
shortsReelsContainer.addEventListener('touchend', handleEnd);

// Mouse Events
shortsReelsContainer.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// Load initial content or onboarding
if (!localStorage.getItem('onboardingComplete')) {
    onboardingModal.style.display = 'flex';
    // Let the splash screen fade out so onboarding is visible
    setTimeout(() => {
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => splashScreen.remove(), 500);
        }
    }, 800);
} else {
    loadTrending();
}

// Global error handling for unhandled promises
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

// Mouse Wheel (Desktop Scroll)
let wheelTimeout;
shortsReelsContainer.addEventListener('wheel', (e) => {
    e.preventDefault(); // Prevent page scroll
    if (wheelTimeout) return; // Debounce
    
    if (e.deltaY > 50) { // Scrolled Down (equivalent to Swipe Up)
        if (currentShortIndex < shortsList.length - 1) {
            currentShortIndex++;
            playShort(currentShortIndex);
        }
    } else if (e.deltaY < -50) { // Scrolled Up (equivalent to Swipe Down)
        if (currentShortIndex > 0) {
            currentShortIndex--;
            playShort(currentShortIndex);
        }
    }
    
    wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 800); // 800ms cooldown between scrolls
}, { passive: false });

// Render Videos to Grids
function renderVideos(videos) {
    if (!videos || videos.length === 0) {
        musicFeedContainer.style.display = 'block';
        featuredMusic.innerHTML = '';
        musicList.innerHTML = '<p>No music found.</p>';
        return;
    }

    const items = videos.filter(v => v.type === 'stream' || YT_API_KEY).map(video => {
        const id = video.url.split('?v=')[1] || video.url.split('/watch?v=')[1];
        return {
            id,
            title: video.title,
            artist: video.uploaderName,
            thumbnail: video.thumbnail || (video.thumbnails && video.thumbnails[0]?.url) || '',
            duration: typeof video.duration === 'string' ? video.duration : formatTime(video.duration),
            url: video.url
        };
    });

    const featured = items.slice(0, 5);
    const list = items.slice(5);

    featuredMusic.innerHTML = featured.map(track => `
        <div class="featured-card" style="background-image: url('${track.thumbnail}')" onclick="openVideo('${track.id}', '${track.title.replace(/'/g, "\\'")}', '${track.artist.replace(/'/g, "\\'")}', '${track.thumbnail}')">
            <div class="featured-card-info">
                <h3 class="featured-card-title">${track.title}</h3>
                <p class="featured-card-artist">${track.artist}</p>
            </div>
            <div class="featured-play-btn"><i class="fa-solid fa-play"></i></div>
        </div>
    `).join('');

    musicList.innerHTML = list.map(track => `
        <div class="music-list-item" onclick="openVideo('${track.id}', '${track.title.replace(/'/g, "\\'")}', '${track.artist.replace(/'/g, "\\'")}', '${track.thumbnail}')">
            <img src="${track.thumbnail}" alt="art" class="music-list-img">
            <div class="music-list-info">
                <div class="music-list-title">${track.title}</div>
                <div class="music-list-artist">${track.artist}</div>
            </div>
            <div class="music-list-duration">${track.duration}</div>
        </div>
    `).join('');
}

// Load Recent History
function loadRecent() {
    sectionTitle.textContent = "Recently Played & Most Played";
    musicFeedContainer.style.display = 'flex';
    if(typeof shortsReelsContainer !== 'undefined') shortsReelsContainer.style.display = 'none';
    loader.style.display = 'none';
    
    if (userMusicData.history.length === 0) {
        featuredMusic.innerHTML = '';
        musicList.innerHTML = '<p style="padding: 20px; text-align: center;">No music history yet. Start listening!</p>';
        return;
    }
    
    // Sort most played
    const topPlayed = Object.values(userMusicData.mostPlayed)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => item.track);
        
    const likedList = (userMusicData.liked || []).slice().reverse();
    const historyList = userMusicData.history.slice(0, 30);
    
    // Format into standard schema for renderVideos
    const formattedLiked = likedList.map(t => ({
        url: `/watch?v=${t.id}`, title: t.title, uploaderName: t.artist, thumbnail: t.thumbnail, duration: "Liked ❤️"
    }));
    
    const formattedFeatured = topPlayed.map(t => ({
        url: `/watch?v=${t.id}`, title: t.title, uploaderName: t.artist, thumbnail: t.thumbnail, duration: "Most Played"
    }));
    
    const formattedHistory = historyList.map(t => ({
        url: `/watch?v=${t.id}`, title: t.title, uploaderName: t.artist, thumbnail: t.thumbnail, duration: "Recent"
    }));
    
    // De-duplicate list to prevent same video showing multiple times consecutively
    const combined = [...formattedLiked, ...formattedFeatured, ...formattedHistory];
    const uniqueMap = new Map();
    combined.forEach(v => {
        if (!uniqueMap.has(v.url)) uniqueMap.set(v.url, v);
    });
    
    renderVideos(Array.from(uniqueMap.values()));
    sectionTitle.textContent = "Liked & Recent History";
}

// Open and Play Video
async function openVideo(videoId, title, uploader, thumbnail) {
    if (!videoId) return;

    // Track Usage
    if (title && uploader) {
        const track = { id: videoId, title, artist: uploader, thumbnail };
        
        // Update Like Button State
        if (userMusicData.liked && userMusicData.liked.some(t => t.id === videoId)) {
            likeIcon.classList.remove('fa-regular');
            likeIcon.classList.add('fa-solid');
            likeIcon.style.color = 'var(--accent)';
        } else {
            likeIcon.classList.add('fa-regular');
            likeIcon.classList.remove('fa-solid');
            likeIcon.style.color = 'white';
        }
        
        likeBtn.onclick = () => {
            if (!userMusicData.liked) userMusicData.liked = [];
            const index = userMusicData.liked.findIndex(t => t.id === videoId);
            if (index > -1) {
                userMusicData.liked.splice(index, 1);
                likeIcon.classList.add('fa-regular');
                likeIcon.classList.remove('fa-solid');
                likeIcon.style.color = 'white';
            } else {
                userMusicData.liked.push(track);
                likeIcon.classList.remove('fa-regular');
                likeIcon.classList.add('fa-solid');
                likeIcon.style.color = 'var(--accent)';
            }
            saveMusicData();
        };

        userMusicData.history = userMusicData.history.filter(t => t.id !== videoId);
        userMusicData.history.unshift(track);
        if (userMusicData.history.length > 100) userMusicData.history.pop();
        
        if (!userMusicData.mostPlayed[videoId]) userMusicData.mostPlayed[videoId] = { count: 0, track };
        userMusicData.mostPlayed[videoId].count++;
        
        userMusicData.artists[uploader] = (userMusicData.artists[uploader] || 0) + 1;
        saveMusicData();
    }

    playerOverlay.classList.add('active');
    
    // Reset players and unlock audio context for iOS
    if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
    document.getElementById('iframePlayer').style.display = 'none';
    nativePlayer.style.display = 'none';
    musicArtwork.style.display = 'block';
    nativePlayer.src = '';
    
    // Set UI immediately from passed data
    playerTitle.textContent = title || 'Loading...';
    playerChannelName.textContent = uploader || '';
    if (thumbnail) {
        musicArtwork.src = thumbnail;
    } else {
        musicArtwork.src = 'icon.png';
    }
    
    // Default to showing custom controls
    document.getElementById('playerProgress').style.display = 'block';
    document.getElementById('playerActions').style.display = 'flex';
    
    // Reset Progress Bar
    document.getElementById('progressBarFill').style.width = '0%';
    document.getElementById('currentTime').textContent = '0:00';
    document.getElementById('totalTime').textContent = '0:00';
    playPauseBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    
    // iOS Autoplay unlock trick (must be synchronous with click)
    nativePlayer.play().catch(() => {});
    nativePlayer.pause();
    
    playerLoader.style.display = 'flex';
    
    // Reset legacy info to prevent errors
    playerViews.textContent = '';
    playerDescription.textContent = '';
    playerChannelAvatar.src = '';
    
    // Reset description to collapsed state
    document.getElementById('descBox').classList.add('collapsed');

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
                        
                        // Fetch related videos using full item for tags/channel
                        fetchRelatedVideos(item);
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

        // Only update legacy UI from Piped if YouTube API didn't already do it
        if (!YT_API_KEY) {
            playerTitle.textContent = data.title;
            playerChannelName.textContent = data.uploader;
            playerViews.textContent = `${formatViews(data.views)} views`;
            playerDescription.textContent = data.description || '';
            playerChannelAvatar.src = data.uploaderAvatar || 'https://via.placeholder.com/48';
            if(data.thumbnailUrl) musicArtwork.src = data.thumbnailUrl;
            
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
                title: data.title || title,
                artist: data.uploader || uploader,
                album: 'BAJAAO !! Premium',
                artwork: [
                    { src: thumbnail || data.thumbnailUrl || 'icon.png', sizes: '512x512', type: 'image/png' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => { nativePlayer.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { nativePlayer.pause(); });
            // For background play reliability on some mobile browsers
            navigator.mediaSession.setActionHandler('seekbackward', (details) => { nativePlayer.currentTime = Math.max(nativePlayer.currentTime - (details.seekOffset || 10), 0); });
            navigator.mediaSession.setActionHandler('seekforward', (details) => { nativePlayer.currentTime = Math.min(nativePlayer.currentTime + (details.seekOffset || 10), nativePlayer.duration); });
        }

        musicArtwork.style.display = 'none';
        nativePlayer.style.display = 'block';
        nativePlayer.play();
    } catch (err) {
        console.error("Native stream failed, falling back to Iframe", err);
        // Fallback to Iframe Player
        nativePlayer.style.display = 'none';
        musicArtwork.style.display = 'none';
        document.getElementById('playerProgress').style.display = 'block';
        document.getElementById('playerActions').style.display = 'flex';
        document.getElementById('iframePlayer').style.display = 'block';
        
        const tryLoadYtVideo = (retries = 3) => {
            if (isYtPlayerReady && ytPlayer && ytPlayer.loadVideoById) {
                ytPlayer.loadVideoById(videoId);
            } else if (retries > 0) {
                setTimeout(() => tryLoadYtVideo(retries - 1), 500);
            } else {
                console.error("YT API not ready for fallback after retries.");
            }
        };
        tryLoadYtVideo();
    } finally {
        playerLoader.style.display = 'none';
    }
}

// Fetch Related Videos via YouTube API keyword search
async function fetchRelatedVideos(videoItem) {
    if (!YT_API_KEY) return;
    const relatedContainer = document.getElementById('relatedVideos');
    relatedContainer.innerHTML = '<p>Loading related videos...</p>';
    
    let query = '';
    const tags = videoItem.snippet.tags;
    
    // Instead of chopping the title (which just returns 15 copies of the same song),
    // we randomly select 2 of the creator's video tags to search. This gives a natural
    // mix of "Related Genre / Related Topic" videos, just like the YouTube algorithm!
    if (tags && tags.length > 0) {
        const shuffledTags = tags.sort(() => 0.5 - Math.random());
        query = shuffledTags.slice(0, 2).join(' ');
    } else {
        // If they didn't tag the video, fall back to showing other videos from that channel
        query = videoItem.snippet.channelTitle;
    }
    
    const keyword = encodeURIComponent(query);
    try {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${keyword}&type=video&videoCategoryId=10&maxResults=15&key=${YT_API_KEY}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        const formatted = data.items
            .filter(item => item.id.videoId !== videoItem.id) // Exclude the current video
            .map(item => ({
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

// Queue State
let currentQueue = [];
let currentQueueIndex = -1;

function updateQueue(videos) {
    currentQueue = videos.map(video => {
        return {
            id: video.url.includes('?v=') ? video.url.split('?v=')[1] : video.url.split('/').pop(),
            title: video.title,
            uploader: video.uploaderName,
            thumbnail: video.thumbnail || (video.thumbnails && video.thumbnails[0]?.url) || ''
        };
    });
    currentQueueIndex = -1;
}

// Render Related Videos in Player
function renderRelatedVideos(videos) {
    const relatedContainer = document.getElementById('relatedVideos');
    
    updateQueue(videos);
    
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

// --- Custom Player Controls Logic ---

function togglePlayPause() {
    if (nativePlayer.style.display !== 'none') {
        if (nativePlayer.paused) {
            nativePlayer.play();
        } else {
            nativePlayer.pause();
        }
    } else if (ytPlayer && ytPlayer.getPlayerState) {
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            ytPlayer.pauseVideo();
        } else {
            ytPlayer.playVideo();
        }
    }
}

playPauseBtn.addEventListener('click', togglePlayPause);
nextBtn.addEventListener('click', playNextTrack);
prevBtn.addEventListener('click', playPrevTrack);

function playNextTrack() {
    if (currentQueue.length > 0) {
        currentQueueIndex++;
        if (currentQueueIndex >= currentQueue.length) currentQueueIndex = 0;
        const nextTrack = currentQueue[currentQueueIndex];
        openVideo(nextTrack.id, nextTrack.title, nextTrack.uploader, nextTrack.thumbnail);
    }
}

function playPrevTrack() {
    if (currentQueue.length > 0) {
        currentQueueIndex--;
        if (currentQueueIndex < 0) currentQueueIndex = currentQueue.length - 1;
        const prevTrack = currentQueue[currentQueueIndex];
        openVideo(prevTrack.id, prevTrack.title, prevTrack.uploader, prevTrack.thumbnail);
    }
}

// Auto play next track when video ends
nativePlayer.addEventListener('ended', playNextTrack);

window.updatePlayBtnIcon = (isPlaying) => {
    if (isPlaying) {
        playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
};

nativePlayer.addEventListener('play', () => updatePlayBtnIcon(true));
nativePlayer.addEventListener('pause', () => updatePlayBtnIcon(false));

nativePlayer.addEventListener('timeupdate', () => {
    const current = nativePlayer.currentTime;
    const duration = nativePlayer.duration;
    if (duration) {
        const progressPercent = (current / duration) * 100;
        document.getElementById('progressBarFill').style.width = `${progressPercent}%`;
        document.getElementById('currentTime').textContent = formatTime(Math.floor(current));
        document.getElementById('totalTime').textContent = formatTime(Math.floor(duration));
    }
});

const progressBarBg = document.getElementById('progressBarBg');
progressBarBg.addEventListener('click', (e) => {
    const rect = progressBarBg.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    if (nativePlayer.style.display !== 'none') {
        nativePlayer.currentTime = pos * nativePlayer.duration;
    } else if (ytPlayer && ytPlayer.getDuration) {
        ytPlayer.seekTo(pos * ytPlayer.getDuration(), true);
    }
});

// Close Player overrides -> Minimizes the player
closePlayerBtn.addEventListener('click', () => {
    playerOverlay.classList.remove('active');
    miniPlayer.style.display = 'flex';
});

// Mini Player Maximize
miniPlayerLeft.addEventListener('click', () => {
    miniPlayer.style.display = 'none';
    playerOverlay.classList.add('active');
});

// Mini Player Controls
miniPlayPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
});
miniNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playNextTrack();
});

// Update Mini Player UI when song plays
const originalPlayAudio = playAudio;
window.playAudio = async function(videoId, title, uploader, thumbnail) {
    miniPlayerTitle.textContent = title;
    miniPlayerArtist.textContent = uploader;
    miniPlayerArt.src = thumbnail || 'icon.png';
    // hide mini player if we open full player
    miniPlayer.style.display = 'none';
    await originalPlayAudio(videoId, title, uploader, thumbnail);
};

// Update Mini play/pause icon
const updateMiniPlayBtnIcon = (isPlaying) => {
    if (isPlaying) {
        miniPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        miniPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
};

// Sync mini button with main button
nativePlayer.addEventListener('play', () => updateMiniPlayBtnIcon(true));
nativePlayer.addEventListener('pause', () => updateMiniPlayBtnIcon(false));

// --- Swipe Gestures ---
let touchStartY = 0;
let touchStartX = 0;

playerOverlay.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
});
playerOverlay.addEventListener('touchend', e => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchEndY - touchStartY;
    const diffX = touchEndX - touchStartX;
    
    // Swipe down to minimize
    if (diffY > 50 && Math.abs(diffY) > Math.abs(diffX)) {
        playerOverlay.classList.remove('active');
        miniPlayer.style.display = 'flex';
    }
    
    // Swipe left to next track
    if (diffX < -50 && Math.abs(diffX) > Math.abs(diffY)) {
        playNextTrack();
    }
    // Swipe right to prev track
    if (diffX > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        playPrevTrack();
    }
});

miniPlayer.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
});
miniPlayer.addEventListener('touchend', e => {
    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchEndY - touchStartY;
    // Swipe up to maximize
    if (diffY < -30) {
        miniPlayer.style.display = 'none';
        playerOverlay.classList.add('active');
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

// Live Search Suggestions & History
let suggestionTimeout;

function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem('searchHistory')) || []; } catch { return []; }
}
function saveSearchHistory(query) {
    if (!query.trim()) return;
    let history = getSearchHistory();
    history = history.filter(item => item !== query); // Remove duplicate
    history.unshift(query);
    if (history.length > 5) history.pop();
    localStorage.setItem('searchHistory', JSON.stringify(history));
}
function showHistory() {
    const history = getSearchHistory();
    if (history.length > 0) {
        searchSuggestions.innerHTML = `<div style="padding: 10px 15px; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Recent Searches</div>` + 
            history.map(text => 
                `<div class="search-suggestion-item" onclick="applySuggestion('${text.replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-clock-rotate-left"></i> ${text}
                </div>`
            ).join('');
        searchSuggestions.style.display = 'flex';
    } else {
        searchSuggestions.style.display = 'none';
    }
}

searchInput.addEventListener('focus', () => {
    if (!searchInput.value.trim()) showHistory();
});

searchInput.addEventListener('input', (e) => {
    clearTimeout(suggestionTimeout);
    const query = e.target.value.trim();
    
    if (!query) {
        showHistory();
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
    saveSearchHistory(text);
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
    const val = searchInput.value;
    saveSearchHistory(val);
    searchVideos(val);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchSuggestions.style.display = 'none';
        const val = searchInput.value;
        saveSearchHistory(val);
        searchVideos(val);
    }
});

// Navigation Events

function resetNav() {
    [navHome, navRecent, navTrending, mobileNavHome, mobileNavRecent, mobileNavTrending].forEach(el => {
        if (el) el.classList.remove('active');
    });
}

// Navigation Setup
function setupNav(navElement, mobileNavElement, loadFunc) {
    [navElement, mobileNavElement].forEach(el => {
        if (!el) return;
        el.addEventListener('click', (e) => {
            e.preventDefault();
            resetNav();
            navElement.classList.add('active');
            if (mobileNavElement) mobileNavElement.classList.add('active');
            
            // If they click the Shorts/Recent tab, call loadRecent instead!
            if (navElement.id === 'navShorts') {
                loadRecent();
            } else {
                loadFunc();
            }
        });
    });
}

setupNav(navHome, mobileNavHome, () => { searchInput.value = ''; loadTrending(); });
setupNav(navRecent, mobileNavRecent, () => { searchInput.value = ''; loadRecent(); });
setupNav(navTrending, mobileNavTrending, () => { searchInput.value = ''; loadTrending(); });

// Init
if (!localStorage.getItem('onboardingComplete')) {
    onboardingModal.style.display = 'flex';
    // Let the splash screen fade out so onboarding is visible
    setTimeout(() => {
        const splashScreen = document.getElementById('splashScreen');
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => splashScreen.remove(), 500);
        }
    }, 800);
} else {
    loadTrending();
}

// --- Pull to Refresh Logic ---
let ptrStartY = 0;
let ptrCurrentY = 0;
let isPulling = false;
const ptrSpinner = document.getElementById('ptrSpinner');
const mainContent = document.getElementById('mainContent');

mainContent.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
        ptrStartY = e.touches[0].clientY;
        isPulling = true;
        ptrSpinner.style.transition = 'none';
    }
}, { passive: true });

mainContent.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    ptrCurrentY = e.touches[0].clientY;
    const distance = ptrCurrentY - ptrStartY;
    
    if (distance > 0 && window.scrollY === 0) {
        // Prevent default only when pulling down at the top to avoid bouncing
        if (e.cancelable) e.preventDefault();
        
        const pullDistance = Math.min(distance * 0.5, 80); // Damping factor
        ptrSpinner.style.opacity = Math.min(pullDistance / 60, 1);
        ptrSpinner.style.transform = `translateX(-50%) translateY(${pullDistance}px) rotate(${pullDistance * 5}deg)`;
    }
}, { passive: false });

mainContent.addEventListener('touchend', () => {
    if (!isPulling) return;
    isPulling = false;
    
    const distance = ptrCurrentY - ptrStartY;
    ptrSpinner.style.transition = 'transform 0.3s, top 0.3s, opacity 0.3s';
    
    if (distance > 60 && window.scrollY === 0) {
        // Trigger Refresh
        ptrSpinner.classList.add('refreshing');
        ptrSpinner.style.transform = 'translateX(-50%)';
        
        const activeLoadFunc = navShorts.classList.contains('active') ? loadShorts : loadTrending;
        
        // Reload the feed
        activeLoadFunc().then(() => {
            ptrSpinner.classList.remove('refreshing');
            ptrSpinner.style.transform = 'translateX(-50%) translateY(0)';
            ptrSpinner.style.opacity = '0';
        });
    } else {
        // Cancel Refresh
        ptrSpinner.style.transform = 'translateX(-50%) translateY(0)';
        ptrSpinner.style.opacity = '0';
    }
});
