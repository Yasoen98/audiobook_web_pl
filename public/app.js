const loginSection = document.getElementById('login-section');
const uploadSection = document.getElementById('upload-section');
const librarySection = document.getElementById('library-section');
const userInfo = document.getElementById('user-info');
const welcomeText = document.getElementById('welcome-text');
const logoutBtn = document.getElementById('logout-btn');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const uploadForm = document.getElementById('upload-form');
const authorList = document.getElementById('author-list');
const backToAuthorsBtn = document.getElementById('back-to-authors');
const libraryTitle = document.getElementById('library-title');
const librarySubtitle = document.getElementById('library-subtitle');
const libraryList = document.getElementById('library-list');
const emptyLibrary = document.getElementById('empty-library');
const authorTemplate = document.getElementById('author-card-template');
const itemTemplate = document.getElementById('library-item-template');

const playerPanel = document.getElementById('player-panel');
const playerBody = document.getElementById('player-body');
const playerStatus = document.getElementById('player-status');
const playerTitle = document.getElementById('player-title');
const playerAuthor = document.getElementById('player-author');
const playerDescription = document.getElementById('player-description');
const playerCover = document.getElementById('player-cover');
const playPauseBtn = document.getElementById('play-pause');
const progressBar = document.getElementById('player-progress');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const speedSelect = document.getElementById('speed-select');
const volumeSlider = document.getElementById('volume-slider');
const audioElement = document.getElementById('player-audio');

let currentUser = null;
let libraryItems = [];
let currentAuthor = null;
let currentTrackId = null;
let pendingResumeTime = null;
const libraryList = document.getElementById('library-list');
const emptyLibrary = document.getElementById('empty-library');
const itemTemplate = document.getElementById('library-item-template');

let currentUser = null;
const lastProgressUpdate = {};

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function extractErrorMessage(response) {
  try {
    const data = await response.json();
    return data.message || response.statusText;
  } catch (error) {
    return response.statusText;
  }
}

function setLoggedIn(user) {
  currentUser = user;
  if (user) {
    loginSection.classList.add('hidden');
    userInfo.classList.remove('hidden');
    librarySection.classList.remove('hidden');
    welcomeText.textContent = `Zalogowano jako ${user.username} (${user.role})`;
    if (user.role === 'admin') {
      uploadSection.classList.remove('hidden');
    } else {
      uploadSection.classList.add('hidden');
    }
    currentAuthor = null;
    fetchLibrary();
  } else {
    currentUser = null;
    welcomeText.textContent = '';
    userInfo.classList.add('hidden');
    uploadSection.classList.add('hidden');
    librarySection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    authorList.innerHTML = '';
    libraryList.innerHTML = '';
    emptyLibrary.classList.add('hidden');
    resetPlayer();
  }
}

function resetPlayer() {
  currentTrackId = null;
  pendingResumeTime = null;
  audioElement.pause();
  audioElement.removeAttribute('src');
  audioElement.load();
  playPauseBtn.textContent = '▶️';
  progressBar.value = 0;
  progressBar.max = 0;
  currentTimeEl.textContent = '00:00';
  durationEl.textContent = '00:00';
  playerTitle.textContent = '';
  playerAuthor.textContent = '';
  playerDescription.textContent = '';
  playerCover.style.backgroundImage = '';
  playerCover.classList.add('placeholder');
  playerBody.classList.add('hidden');
  playerPanel.classList.add('hidden');
  playerStatus.textContent = 'Wybierz audiobook, aby rozpocząć.';
}

    libraryList.innerHTML = '';
    emptyLibrary.classList.add('hidden');
  }
}

async function fetchSession() {
  try {
    const session = await apiRequest('/api/session');
    if (session) {
      setLoggedIn(session);
    }
  } catch (error) {
    console.warn('Brak aktywnej sesji');
  }
}

async function fetchLibrary() {
  if (!currentUser) return;
  try {
    const items = await apiRequest('/api/library');
    libraryItems = Array.isArray(items) ? items : [];
    renderLibrary(libraryItems);
    renderLibrary(items);
  } catch (error) {
    console.error(error);
    alert(`Nie udało się pobrać biblioteki: ${error.message}`);
  }
}

function renderLibrary(items) {
  if (!items.length) {
    authorList.innerHTML = '';
    libraryList.innerHTML = '';
    libraryList.classList.add('hidden');
    authorList.classList.add('hidden');
    backToAuthorsBtn.classList.add('hidden');
    emptyLibrary.classList.remove('hidden');
    libraryTitle.textContent = 'Twoja biblioteka';
    librarySubtitle.textContent = 'Dodaj pierwszy audiobook, aby zacząć.';
    return;
  }

  emptyLibrary.classList.add('hidden');

  const authorsMap = groupByAuthor(items);
  if (!currentAuthor || !authorsMap.has(currentAuthor)) {
    currentAuthor = null;
  }

  if (currentAuthor) {
    showAuthorItems(currentAuthor, authorsMap.get(currentAuthor) || []);
  } else {
    showAuthorOverview(authorsMap);
  }
}

function groupByAuthor(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.author || 'Nieznany autor';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });
  return map;
}

function showAuthorOverview(authorsMap) {
  authorList.innerHTML = '';
  libraryList.classList.add('hidden');
  authorList.classList.remove('hidden');
  backToAuthorsBtn.classList.add('hidden');
  libraryTitle.textContent = 'Autorzy';
  librarySubtitle.textContent = 'Wybierz autora, aby zobaczyć jego audiobooki.';

  const authors = Array.from(authorsMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], 'pl', { sensitivity: 'base' })
  );

  authors.forEach(([author, items]) => {
    const clone = authorTemplate.content.cloneNode(true);
    const button = clone.querySelector('.author-card');
    const nameEl = clone.querySelector('.author-name');
    const countEl = clone.querySelector('.author-count');

    nameEl.textContent = author;
    countEl.textContent = formatCount(items.length);
    button.addEventListener('click', () => loadAuthor(author));

    authorList.appendChild(clone);
  });
}

function showAuthorItems(author, items) {
  currentAuthor = author;
  libraryList.innerHTML = '';
  libraryList.classList.remove('hidden');
  authorList.classList.add('hidden');
  backToAuthorsBtn.classList.remove('hidden');
  libraryTitle.textContent = `Audiobooki autora ${author}`;
  librarySubtitle.textContent = 'Wybierz tytuł, aby uruchomić odtwarzacz.';

  const sortedItems = [...items].sort((a, b) =>
    a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' })
  );

  sortedItems.forEach((item) => {
    const clone = itemTemplate.content.cloneNode(true);
    const article = clone.querySelector('.library-item');
  libraryList.innerHTML = '';
  if (!items.length) {
    emptyLibrary.classList.remove('hidden');
    return;
  }
  emptyLibrary.classList.add('hidden');

  items.forEach((item) => {
    const clone = itemTemplate.content.cloneNode(true);
    const cover = clone.querySelector('.cover');
    const titleEl = clone.querySelector('h3');
    const descriptionEl = clone.querySelector('.description');
    const pdfLink = clone.querySelector('.pdf-link');
    const playButton = clone.querySelector('.play-btn');
    const authorLink = clone.querySelector('.author-link');

    article.dataset.itemId = item.id;
    titleEl.textContent = item.title;
    descriptionEl.textContent = item.description;
    pdfLink.href = item.pdfUrl;
    authorLink.textContent = item.author || 'Nieznany autor';
    authorLink.addEventListener('click', () => loadAuthor(item.author));

    if (item.imageUrl) {
      cover.style.backgroundImage = `url(${item.imageUrl})`;
      cover.classList.remove('placeholder');
    } else {
      cover.style.backgroundImage = '';
      cover.classList.add('placeholder');
    }

    playButton.addEventListener('click', () => loadTrack(item));

    libraryList.appendChild(clone);
  });

  highlightCurrentTrack();
}

function loadAuthor(author) {
  currentAuthor = author;
  renderLibrary(libraryItems);
}

function highlightCurrentTrack() {
  const items = libraryList.querySelectorAll('.library-item');
  items.forEach((item) => {
    if (item.dataset.itemId === currentTrackId) {
      item.classList.add('playing');
    } else {
      item.classList.remove('playing');
    }
  });
}

async function loadTrack(item) {
  if (!currentUser) return;
  if (currentTrackId === item.id && audioElement.src) {
    if (audioElement.paused) {
      try {
        await audioElement.play();
      } catch (error) {
        console.warn('Nie można wznowić odtwarzania:', error.message);
      }
    }
    return;
  }

  currentTrackId = item.id;
  playerPanel.classList.remove('hidden');
  playerBody.classList.remove('hidden');
  playerStatus.textContent = 'Ładowanie audiobooka...';
  playerTitle.textContent = item.title;
  playerAuthor.textContent = `Autor: ${item.author}`;
  playerDescription.textContent = item.description;

  if (item.imageUrl) {
    playerCover.style.backgroundImage = `url(${item.imageUrl})`;
    playerCover.classList.remove('placeholder');
  } else {
    playerCover.style.backgroundImage = '';
    playerCover.classList.add('placeholder');
  }

  audioElement.pause();
  audioElement.currentTime = 0;
  audioElement.src = item.audioUrl;
  audioElement.playbackRate = Number(speedSelect.value) || 1;
  pendingResumeTime = null;

  try {
    const data = await apiRequest(`/api/progress/${item.id}`);
    if (data && typeof data.time === 'number' && data.time > 0) {
      pendingResumeTime = data.time;
      applyPendingResume();
    }
  } catch (error) {
    console.warn('Nie udało się pobrać postępu odsłuchu:', error.message);
  }

  try {
    await audioElement.play();
  } catch (error) {
    console.warn('Nie można automatycznie rozpocząć odtwarzania:', error.message);
    playPauseBtn.textContent = '▶️';
  }

  highlightCurrentTrack();
}

function applyPendingResume() {
  if (pendingResumeTime && audioElement.readyState >= 1 && audioElement.duration) {
    const resumeTime = Math.min(pendingResumeTime, audioElement.duration);
    if (resumeTime > 0) {
      audioElement.currentTime = resumeTime;
    }
    pendingResumeTime = null;
  }
}

function formatCount(count) {
  if (count === 1) {
    return '1 audiobook';
  }
  if (count >= 2 && count <= 4) {
    return `${count} audiobooki`;
  }
  return `${count} audiobooków`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(seconds);
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateProgressUI() {
  if (!audioElement.duration) {
    progressBar.value = 0;
    progressBar.max = 0;
    currentTimeEl.textContent = '00:00';
    return;
  }
  progressBar.max = Math.floor(audioElement.duration);
  progressBar.value = Math.floor(audioElement.currentTime);
  currentTimeEl.textContent = formatTime(audioElement.currentTime);
}

function updateDurationUI() {
  durationEl.textContent = formatTime(audioElement.duration);
    const audio = clone.querySelector('audio');

    cover.src = item.imageUrl;
    cover.alt = `Okładka: ${item.title}`;
    titleEl.textContent = item.title;
    descriptionEl.textContent = item.description;
    pdfLink.href = item.pdfUrl;
    audio.src = item.audioUrl;

    attachAudioHandlers(audio, item.id);

    libraryList.appendChild(clone);
  });
}

function attachAudioHandlers(audio, itemId) {
  audio.addEventListener('loadedmetadata', async () => {
    try {
      const data = await apiRequest(`/api/progress/${itemId}`);
      if (typeof data.time === 'number' && data.time > 0 && data.time < audio.duration) {
        audio.currentTime = data.time;
      }
    } catch (error) {
      console.warn('Nie udało się pobrać postępu odsłuchu:', error.message);
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (!currentUser || !audio.duration) return;
    if (!lastProgressUpdate[itemId] || Date.now() - lastProgressUpdate[itemId] > 5000) {
      lastProgressUpdate[itemId] = Date.now();
      saveProgress(itemId, audio.currentTime);
    }
  });

  audio.addEventListener('ended', () => {
    saveProgress(itemId, 0);
  });
}

async function saveProgress(audioId, time) {
  try {
    await apiRequest('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioId, time })
    });
  } catch (error) {
    console.warn('Nie udało się zapisać postępu:', error.message);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const user = await apiRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value.trim()
      })
    });
    loginForm.reset();
    setLoggedIn(user);
  } catch (error) {
    alert(`Logowanie nie powiodło się: ${error.message}`);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
  } catch (error) {
    console.warn('Problem przy wylogowaniu:', error.message);
  } finally {
    setLoggedIn(null);
  }
});

if (uploadForm) {
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    try {
      await apiRequest('/api/library', {
        method: 'POST',
        body: formData
      });
      uploadForm.reset();
      currentAuthor = null;
      fetchLibrary();
    } catch (error) {
      alert(`Nie udało się przesłać audiobooka: ${error.message}`);
    }
  });
}

backToAuthorsBtn.addEventListener('click', () => {
  currentAuthor = null;
  renderLibrary(libraryItems);
});

playPauseBtn.addEventListener('click', async () => {
  if (!audioElement.src) return;
  if (audioElement.paused) {
    try {
      await audioElement.play();
    } catch (error) {
      console.warn('Nie można odtworzyć:', error.message);
    }
  } else {
    audioElement.pause();
  }
});

progressBar.addEventListener('input', () => {
  if (!audioElement.duration) return;
  audioElement.currentTime = Number(progressBar.value);
});

speedSelect.addEventListener('change', () => {
  const rate = Number(speedSelect.value);
  if (Number.isFinite(rate)) {
    audioElement.playbackRate = rate;
  }
});

volumeSlider.addEventListener('input', () => {
  const volume = Number(volumeSlider.value);
  audioElement.volume = Number.isFinite(volume) ? volume : 1;
});

audioElement.addEventListener('loadedmetadata', () => {
  updateDurationUI();
  updateProgressUI();
  applyPendingResume();
});

audioElement.addEventListener('durationchange', updateDurationUI);

audioElement.addEventListener('timeupdate', () => {
  updateProgressUI();
  if (!currentTrackId || !audioElement.duration) return;
  if (!lastProgressUpdate[currentTrackId] || Date.now() - lastProgressUpdate[currentTrackId] > 5000) {
    lastProgressUpdate[currentTrackId] = Date.now();
    saveProgress(currentTrackId, audioElement.currentTime);
  }
});

audioElement.addEventListener('play', () => {
  playPauseBtn.textContent = '⏸';
  playerStatus.textContent = 'Odtwarzanie';
});

audioElement.addEventListener('pause', () => {
  if (audioElement.ended) return;
  playPauseBtn.textContent = '▶️';
  playerStatus.textContent = 'Wstrzymano';
});

audioElement.addEventListener('ended', () => {
  playPauseBtn.textContent = '▶️';
  playerStatus.textContent = 'Zakończono odsłuch.';
  if (currentTrackId) {
    lastProgressUpdate[currentTrackId] = Date.now();
    saveProgress(currentTrackId, 0);
  }
  highlightCurrentTrack();
});

audioElement.volume = Number(volumeSlider.value);

fetchSession();
