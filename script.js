if (typeof songs === "undefined") {

    document.body.insertAdjacentHTML(
        "afterbegin",
        '<div style="position:fixed;top:0;left:0;right:0;z-index:99;' +
        'background:#b00020;color:#fff;padding:10px;font:14px Arial">' +
        'songs.js was not found. Keep it in the same folder as HTML.html.' +
        '</div>'
    );

    throw new Error("songs.js is missing");

}


/* =====================================================
   2. HTML ELEMENTS
===================================================== */

const audio = document.getElementById("audioPlayer");

const songList = document.getElementById("songList");

const playBtn = document.getElementById("playBtn");

const nextBtn = document.getElementById("nextBtn");

const prevBtn = document.getElementById("prevBtn");

const shuffleBtn = document.getElementById("shuffleBtn");

const repeatBtn = document.getElementById("repeatBtn");

const progressBar = document.getElementById("progressBar");

const volumeBar = document.getElementById("volumeBar");

const currentTitle = document.getElementById("currentTitle");

const currentArtist = document.getElementById("currentArtist");

const miniCover = document.getElementById("miniCover");

const currentTime = document.getElementById("currentTime");

const duration = document.getElementById("duration");

const searchInput = document.getElementById("searchInput");

const songCount = document.getElementById("songCount");

const lyricsContainer = document.getElementById("lyricsContainer");

const lyricsSongName = document.getElementById("lyricsSongName");


/* =====================================================
   3. PLAYER VARIABLES
===================================================== */

let currentSongIndex = 0;

let isPlaying = false;

let isShuffle = false;

let isRepeat = false;

let currentLyrics = [];

let lyricsRequestId = 0;

let activeLyricIndex = -1;

// true after the person pressed play on the current song
let playRequested = false;

// each loaded song gets a number, so one broken file is only reported once
let loadToken = 0;

let failedToken = -1;

// used to skip songs whose mp3 file is missing
let skipping = false;

let skipDirection = 1;

let triedSongs = [];


/* =====================================================
   4. SMALL HELPERS
===================================================== */

// Album is optional in songs.js, so never show "undefined"
function albumOf(song) {

    return song.album || "";

}


// Turns "songs/my song.mp3" into a safe address (spaces, $, # etc.)
function audioPath(src) {

    if (/^(https?:|blob:|data:)/i.test(src)) {

        return src;

    }

    return src
        .replace(/\\/g, "/")
        .split("/")
        .map(part => encodeURIComponent(part))
        .join("/");

}


// Red message bar at the top (disappears by itself)
function showError(message) {

    const old = document.getElementById("playerError");

    if (old) old.remove();

    const bar = document.createElement("div");

    bar.id = "playerError";

    bar.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:99;" +
        "background:#b00020;color:#fff;padding:10px;" +
        "font:14px Arial;text-align:center";

    bar.textContent = message;

    document.body.appendChild(bar);

    setTimeout(() => bar.remove(), 7000);

}


// Does a song match what was typed in the search box?
function matchesSearch(song, text) {

    return (
        song.title + " " +
        song.artist + " " +
        albumOf(song)
    )
        .toLowerCase()
        .includes(text.toLowerCase().trim());

}


function filteredSongs() {

    return songs.filter(song =>
        matchesSearch(song, searchInput.value)
    );

}


/* =====================================================
   5. DISPLAY SONGS
===================================================== */

function displaySongs(list = songs) {

    songList.innerHTML = "";

    if (list.length === 0) {

        songList.innerHTML =
            '<div class="no-results">No songs found.</div>';

        songCount.textContent = "0 SONGS";

        return;

    }

    list.forEach((song) => {

        const originalIndex = songs.indexOf(song);

        const songElement = document.createElement("div");

        songElement.className = "song-item";

        if (originalIndex === currentSongIndex) {
            songElement.classList.add("active");
        }

        songElement.innerHTML = `

            <span>${originalIndex + 1}</span>

            <div class="song-title">

                <div class="song-cover">♫</div>

                <div class="song-details">

                    <h4></h4>

                    <p></p>

                </div>

            </div>

            <span class="album"></span>

            <span>▶</span>

        `;

        songElement.querySelector("h4").textContent = song.title;

        songElement.querySelector(".song-details p").textContent =
            song.artist;

        songElement.querySelector(".album").textContent =
            albumOf(song);

        songElement.addEventListener("click", () => {

            // a direct click = no skipping, show the error if the file is missing
            skipping = false;

            loadSong(originalIndex);

            playSong();

        });

        songList.appendChild(songElement);

    });

    songCount.textContent = `${list.length} SONGS`;

}


/* =====================================================
   6. LOAD SONG
===================================================== */

function loadSong(index) {

    currentSongIndex = index;

    const song = songs[currentSongIndex];

    loadToken++;

    playRequested = false;

    audio.pause();

    if (song.src) {

        audio.src = audioPath(song.src);

    } else {

        audio.removeAttribute("src");

        audio.load();

    }

    currentTitle.textContent = song.title;

    currentArtist.textContent = song.artist;

    miniCover.textContent = "♫";

    progressBar.value = 0;

    currentTime.textContent = "0:00";

    duration.textContent = "0:00";

    isPlaying = false;

    playBtn.textContent = "▶";

    displaySongs(filteredSongs());

    loadLyrics(song);

}


/* =====================================================
   7. PLAY SONG
===================================================== */

function playSong() {

    playRequested = true;

    if (!songs[currentSongIndex].src) {

        handleLoadFailure();

        return;

    }

    const token = loadToken;

    const attempt = audio.play();

    if (attempt) {

        attempt
            .then(() => {

                // a newer song was loaded meanwhile: ignore this old answer
                if (token !== loadToken) return;

                isPlaying = true;

                playBtn.textContent = "Ⅱ";

            })
            .catch(error => {

                // a newer song was loaded meanwhile: ignore this old answer
                if (token !== loadToken) return;

                // switching songs quickly cancels the old one: ignore that
                if (error.name === "AbortError") return;

                isPlaying = false;

                playBtn.textContent = "▶";

                // file missing or not an mp3
                if (error.name === "NotSupportedError") {

                    handleLoadFailure();

                    return;

                }

                console.error("Audio playback error:", error);

            });

    }

}


// The mp3 could not be loaded (wrong path, missing file...)
function handleLoadFailure() {

    if (failedToken === loadToken) return;

    failedToken = loadToken;

    isPlaying = false;

    playBtn.textContent = "▶";

    // Next / Previous / song ended: quietly try the next song
    if (skipping) {

        stepSong(skipDirection, true);

        return;

    }

    showError(
        "Can't play \"" + songs[currentSongIndex].title + "\". " +
        "Put the mp3 in the songs folder and make sure the name " +
        "in songs.js matches."
    );

}


audio.addEventListener("error", () => {

    // ignore the error from a song that nobody asked to play yet
    if (!audio.getAttribute("src")) return;

    // a late error from the PREVIOUS song (audio.error is empty once a
    // new song is loaded) must not mark the new song as broken
    if (!audio.error) return;

    if (!playRequested) return;

    handleLoadFailure();

});


// A song really started: stop skipping
audio.addEventListener("playing", () => {

    skipping = false;

    triedSongs = [];

});


// Keep the play button correct even if the browser pauses/plays the audio
audio.addEventListener("play", () => {

    isPlaying = true;

    playBtn.textContent = "Ⅱ";

});

audio.addEventListener("pause", () => {

    isPlaying = false;

    playBtn.textContent = "▶";

});


/* =====================================================
   8. PAUSE SONG
===================================================== */

function pauseSong() {

    audio.pause();

    isPlaying = false;

    playBtn.textContent = "▶";

}


/* =====================================================
   9. PLAY / PAUSE BUTTON
===================================================== */

playBtn.addEventListener("click", () => {

    if (isPlaying) {

        pauseSong();

    } else {

        playSong();

    }

});


/* =====================================================
   10. NEXT / PREVIOUS SONG
   direction: 1 = next, -1 = previous
===================================================== */

// Picks the next song to try (random if shuffle is on).
// Songs already tried in this skip are left out.
function chooseSong(direction) {

    if (isShuffle) {

        const options = songs
            .map((song, index) => index)
            .filter(index => !triedSongs.includes(index));

        if (options.length === 0) return -1;

        return options[Math.floor(Math.random() * options.length)];

    }

    let index = currentSongIndex;

    for (let i = 0; i < songs.length; i++) {

        index = (index + direction + songs.length) % songs.length;

        if (!triedSongs.includes(index)) return index;

    }

    return -1;

}


function stepSong(direction, continuing = false) {

    // only one song in the list: just play it again
    if (songs.length === 1) {

        audio.currentTime = 0;

        playSong();

        return;

    }

    if (!continuing) {

        triedSongs = [currentSongIndex];

    }

    skipping = true;

    skipDirection = direction;

    const index = chooseSong(direction);

    if (index === -1) {

        skipping = false;

        triedSongs = [];

        pauseSong();

        showError(
            "No playable songs found. Check that the mp3 files " +
            "are in the songs folder."
        );

        return;

    }

    triedSongs.push(index);

    loadSong(index);

    playSong();

}


function nextSong() {

    stepSong(1);

}


function previousSong() {

    // more than 3 seconds played: restart this song instead
    if (audio.currentTime > 3) {

        audio.currentTime = 0;

        return;

    }

    stepSong(-1);

}


nextBtn.addEventListener("click", nextSong);

prevBtn.addEventListener("click", previousSong);


/* =====================================================
   11. SHUFFLE
===================================================== */

shuffleBtn.addEventListener("click", () => {

    isShuffle = !isShuffle;

    shuffleBtn.classList.toggle("selected", isShuffle);

});


/* =====================================================
   12. REPEAT
===================================================== */

repeatBtn.addEventListener("click", () => {

    isRepeat = !isRepeat;

    repeatBtn.classList.toggle("selected", isRepeat);

});


/* =====================================================
   13. AUTOMATIC NEXT SONG
===================================================== */

audio.addEventListener("ended", () => {

    if (isRepeat) {

        audio.currentTime = 0;

        playSong();

    } else {

        nextSong();

    }

});


/* =====================================================
   14. FORMAT TIME
===================================================== */

function formatTime(seconds) {

    if (!Number.isFinite(seconds)) {

        return "0:00";

    }

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${remainingSeconds
        .toString()
        .padStart(2, "0")}`;

}


/* =====================================================
   15. UPDATE PROGRESS BAR
===================================================== */

// smaller steps = smooth seeking (it was 1% jumps before)
progressBar.step = "0.1";

audio.addEventListener("timeupdate", () => {

    if (audio.duration) {

        const progress =
            (audio.currentTime / audio.duration) * 100;

        progressBar.value = progress;

        currentTime.textContent =
            formatTime(audio.currentTime);

        duration.textContent =
            formatTime(audio.duration);

    }

});


audio.addEventListener("loadedmetadata", () => {

    duration.textContent = formatTime(audio.duration);

});


/* =====================================================
   16. SEEK MUSIC
===================================================== */

progressBar.addEventListener("input", () => {

    if (audio.duration) {

        audio.currentTime =
            (progressBar.value / 100) * audio.duration;

        currentTime.textContent =
            formatTime(audio.currentTime);

    }

});


/* =====================================================
   17. VOLUME CONTROL
===================================================== */

audio.volume = Number(volumeBar.value);

volumeBar.addEventListener("input", () => {

    audio.volume = Number(volumeBar.value);

});


/* =====================================================
   18. SEARCH SONGS
===================================================== */

searchInput.addEventListener("input", () => {

    displaySongs(filteredSongs());

});


/* =====================================================
   19. LOAD LYRICS
   Lyrics come from songs.js (lyrics: [...] or a text block).
   lyricsUrl still works too, if the page is on a web server.
===================================================== */

async function loadLyrics(song) {

    // Identify this specific request

    const requestId = ++lyricsRequestId;

    currentLyrics = [];

    activeLyricIndex = -1;

    lyricsContainer.innerHTML = "";

    lyricsContainer.scrollTop = 0;

    lyricsSongName.textContent =
        song.title + " - " + song.artist;

    let lyricsData = song.lyrics;

    const hasInlineLyrics =
        Array.isArray(lyricsData)
            ? lyricsData.length > 0
            : Boolean(lyricsData && String(lyricsData).trim());

    // No lyrics inside songs.js: try the lyricsUrl file

    if (!hasInlineLyrics) {

        if (!song.lyricsUrl || !song.lyricsUrl.trim()) {

            lyricsContainer.textContent =
                "No lyrics available for this song.";

            return;

        }

        lyricsContainer.textContent = "Loading lyrics...";

        try {

            const response = await fetch(song.lyricsUrl);

            if (!response.ok) {

                throw new Error("Lyrics file not found.");

            }

            lyricsData = await response.text();

        } catch (error) {

            if (requestId !== lyricsRequestId) return;

            lyricsContainer.textContent =
                "Unable to load lyrics. Put them inside songs.js, " +
                "or open the page through a web server.";

            console.error("Lyrics error:", error);

            return;

        }

    }

    // Ignore outdated requests

    if (requestId !== lyricsRequestId) return;

    currentLyrics = Array.isArray(lyricsData)
        ? lyricsData.map(([time, text]) => ({
            time: Number.isFinite(Number(time)) ? Number(time) : null,
            text: String(text)
        }))
        : parseLyrics(String(lyricsData));

    if (currentLyrics.length === 0) {

        lyricsContainer.textContent =
            "No readable lyrics found.";

        return;

    }

    lyricsContainer.innerHTML = "";

    currentLyrics.forEach((line, index) => {

        const p = document.createElement("p");

        p.textContent = line.text;

        p.dataset.index = index;

        // click a timed line to jump the song to that part

        if (line.time !== null) {

            p.addEventListener("click", () => {

                if (audio.getAttribute("src")) {

                    audio.currentTime = line.time;

                }

            });

        }

        lyricsContainer.appendChild(p);

    });

    updateLyrics();

}


/* =====================================================
   20. PARSE LYRICS
   SUPPORTS LRC AND PLAIN TXT
===================================================== */

function parseLyrics(text) {

    const lines = text.split(/\r?\n/);

    const result = [];

    lines.forEach(line => {

        const match = line.match(
            /^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)$/
        );

        if (match) {

            const minutes = Number(match[1]);

            const seconds = Number(match[2]);

            const timestamp = minutes * 60 + seconds;

            result.push({

                time: timestamp,

                text: match[3].trim()

            });

        } else if (line.trim()) {

            result.push({

                time: null,

                text: line.trim()

            });

        }

    });

    // stable sort: timed lines by time, plain lines keep their order at the end

    return result
        .map((line, order) => ({ line, order }))
        .sort((a, b) => {

            if (a.line.time === null && b.line.time === null) {
                return a.order - b.order;
            }

            if (a.line.time === null) return 1;

            if (b.line.time === null) return -1;

            return a.line.time - b.line.time || a.order - b.order;

        })
        .map(item => item.line);

}


/* =====================================================
   21. SYNCHRONIZED LYRICS
===================================================== */

function updateLyrics() {

    if (!currentLyrics.length) return;

    const current = audio.currentTime;

    let activeIndex = -1;

    currentLyrics.forEach((line, index) => {

        if (line.time !== null && current >= line.time) {

            activeIndex = index;

        }

    });

    // nothing changed: don't touch the page (stops the scroll jitter)

    if (activeIndex === activeLyricIndex) return;

    activeLyricIndex = activeIndex;

    const lines = lyricsContainer.querySelectorAll("p");

    lines.forEach((line, index) => {

        line.classList.toggle("active-lyric", index === activeIndex);

    });

    if (activeIndex === -1) {

        lyricsContainer.scrollTo({ top: 0, behavior: "smooth" });

        return;

    }

    const line = lines[activeIndex];

    if (!line) return;

    const containerRect =
        lyricsContainer.getBoundingClientRect();

    const lineRect = line.getBoundingClientRect();

    const targetScroll =
        lyricsContainer.scrollTop +
        lineRect.top -
        containerRect.top -
        lyricsContainer.clientHeight / 2 +
        lineRect.height / 2;

    lyricsContainer.scrollTo({
        top: targetScroll,
        behavior: "smooth"
    });

}


// UPDATE WHEN MUSIC PLAYS (and when you seek)

audio.addEventListener("timeupdate", updateLyrics);

audio.addEventListener("seeked", updateLyrics);


/* =====================================================
   22. TOP BAR ARROWS AND SIDEBAR LINKS
===================================================== */

const arrowButtons = document.querySelectorAll(".navigation button");

if (arrowButtons[0]) {

    arrowButtons[0].addEventListener("click", () => history.back());

}

if (arrowButtons[1]) {

    arrowButtons[1].addEventListener("click", () => history.forward());

}


// highlight the sidebar link you clicked (Home / Library / Lyrics)

const sidebarLinks = document.querySelectorAll(".sidebar nav a");

sidebarLinks.forEach(link => {

    link.addEventListener("click", () => {

        sidebarLinks.forEach(item =>
            item.classList.toggle("active", item === link)
        );

    });

});


/* =====================================================
   23. INITIALIZE MUSIC PLAYER
===================================================== */

displaySongs();

loadSong(0);

console.log("CAMPUS BEATS successfully initialized!");
