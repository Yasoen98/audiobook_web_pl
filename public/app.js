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
const categoryForm = document.getElementById('category-form');
const categoryNameInput = document.getElementById('category-name');
const categorySelect = document.getElementById('audiobook-category');
const categoryList = document.getElementById('category-list');
const authorList = document.getElementById('author-list');
const backToCategoriesBtn = document.getElementById('back-to-categories');
const backToAuthorsBtn = document.getElementById('back-to-authors');
const libraryTitle = document.getElementById('library-title');
const librarySubtitle = document.getElementById('library-subtitle');
const libraryList = document.getElementById('library-list');
const emptyLibrary = document.getElementById('empty-library');
const authorTemplate = document.getElementById('author-card-template');
const categoryTemplate = document.getElementById('category-card-template');
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
const speedButton = document.getElementById('speed-popup-btn');
const speedLabel = document.getElementById('speed-label');
const speedModal = document.getElementById('speed-modal');
const speedModalClose = document.getElementById('speed-modal-close');
const speedOptions = Array.from(
  document.querySelectorAll("input[name='speed-option']")
);
const volumeSlider = document.getElementById('volume-slider');
const audioElement = document.getElementById('player-audio');

let currentUser = null;
let libraryItems = [];
let categories = [];
let currentCategoryId = null;
let currentAuthor = null;
let currentTrackId = null;
let pendingResumeTime = null;
let currentSpeed = 1;
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

function resolveAuthorName(author) {
  if (typeof author !== 'string') {
    return 'Nieznany autor';
  }
  const trimmed = author.trim();
  return trimmed || 'Nieznany autor';
}

function getAuthorCategory() {
  return categories.find((category) => category.type === 'author');
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
    currentCategoryId = null;
    currentAuthor = null;
    fetchLibrary();
  } else {
    currentUser = null;
    welcomeText.textContent = '';
    userInfo.classList.add('hidden');
    uploadSection.classList.add('hidden');
    librarySection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    categories = [];
    currentCategoryId = null;
    authorList.innerHTML = '';
    categoryList.innerHTML = '';
    libraryList.innerHTML = '';
    emptyLibrary.classList.add('hidden');
    if (categorySelect) {
      categorySelect.innerHTML = '';
      delete categorySelect.dataset.initialized;
    }
    resetPlayer();
    setPlaybackSpeed(1);
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
  closeSpeedModal();
}

function setPlaybackSpeed(rate) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return;
  }

  currentSpeed = rate;
  audioElement.playbackRate = rate;
  speedLabel.textContent = `${rate}x`;
  speedOptions.forEach((option) => {
    option.checked = Number(option.value) === rate;
  });
}

function openSpeedModal() {
  if (!speedModal.classList.contains('hidden')) {
    return;
  }
  speedModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeSpeedModal() {
  if (speedModal.classList.contains('hidden')) {
    return;
  }
  speedModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
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
    const [categoriesResponse, items] = await Promise.all([
      apiRequest('/api/categories'),
      apiRequest('/api/library')
    ]);
    categories = Array.isArray(categoriesResponse) ? categoriesResponse : [];
    libraryItems = Array.isArray(items) ? items : [];

    if (currentCategoryId && !categories.some((category) => category.id === currentCategoryId)) {
      currentCategoryId = null;
    }

    const currentCategory = categories.find((category) => category.id === currentCategoryId);
    if (!currentCategory || currentCategory.type !== 'author') {
      currentAuthor = null;
    } else if (currentAuthor) {
      const authorNames = groupByAuthor(libraryItems);
      if (!authorNames.has(currentAuthor)) {
        currentAuthor = null;
      }
    }

    renderLibrary();
  } catch (error) {
    console.error(error);
    alert(`Nie udało się pobrać biblioteki: ${error.message}`);
  }
}

function renderLibrary() {
  updateCategorySelect();

  if (!categories.length) {
    categoryList.classList.add('hidden');
    authorList.classList.add('hidden');
    libraryList.classList.add('hidden');
    backToCategoriesBtn.classList.add('hidden');
    backToAuthorsBtn.classList.add('hidden');
    libraryTitle.textContent = 'Brak kategorii';
    librarySubtitle.textContent = 'Administrator może dodać kategorię w panelu powyżej.';
    showEmptyState('Brak kategorii. Dodaj pierwszą kategorię, aby rozpocząć.');
    return;
  }

  const hasItems = libraryItems.length > 0;

  if (!currentCategoryId) {
    showCategoryOverview();
    if (hasItems) {
      hideEmptyState();
    } else {
      showEmptyState('Brak audiobooków. Administrator może dodać nowe pozycje.');
    }
    return;
  }

  const category = categories.find((entry) => entry.id === currentCategoryId);
  if (!category) {
    currentCategoryId = null;
    renderLibrary();
    return;
  }

  if (category.type === 'author') {
    renderAuthorCategory(category);
  } else {
    renderCustomCategory(category);
  }
}

function showEmptyState(message) {
  if (!emptyLibrary) return;
  emptyLibrary.textContent = message;
  emptyLibrary.classList.remove('hidden');
}

function hideEmptyState() {
  if (!emptyLibrary) return;
  emptyLibrary.classList.add('hidden');
}

function sortCategoriesForDisplay(list) {
  return [...list].sort((a, b) => {
    if (a.type === 'author' && b.type !== 'author') return -1;
    if (a.type !== 'author' && b.type === 'author') return 1;
    return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
  });
}

function showCategoryOverview() {
  if (!categoryTemplate) {
    return;
  }
  categoryList.innerHTML = '';
  categoryList.classList.remove('hidden');
  authorList.classList.add('hidden');
  libraryList.classList.add('hidden');
  backToCategoriesBtn.classList.add('hidden');
  backToAuthorsBtn.classList.add('hidden');
  libraryTitle.textContent = 'Kategorie';
  librarySubtitle.textContent = 'Wybierz kategorię, aby zobaczyć dostępne audiobooki.';

  const sortedCategories = sortCategoriesForDisplay(categories);

  sortedCategories.forEach((category) => {
    const clone = categoryTemplate.content.cloneNode(true);
    const button = clone.querySelector('.category-card');
    const nameEl = clone.querySelector('.category-name');
    const countEl = clone.querySelector('.category-count');
    const itemsInCategory =
      category.type === 'author'
        ? libraryItems.length
        : libraryItems.filter((item) => item.categoryId === category.id).length;

    nameEl.textContent = category.name;
    countEl.textContent = formatCount(itemsInCategory);
    button.addEventListener('click', () => {
      currentCategoryId = category.id;
      currentAuthor = null;
      renderLibrary();
    });

    categoryList.appendChild(clone);
  });
}

function renderAuthorCategory(category) {
  categoryList.classList.add('hidden');
  backToCategoriesBtn.classList.remove('hidden');

  const authorsMap = groupByAuthor(libraryItems);

  if (!authorsMap.size) {
    authorList.classList.add('hidden');
    libraryList.classList.add('hidden');
    backToAuthorsBtn.classList.add('hidden');
    libraryTitle.textContent = `Kategoria: ${category.name}`;
    librarySubtitle.textContent = 'Brak audiobooków przypisanych do autorów.';
    showEmptyState('Brak audiobooków przypisanych do autorów.');
    return;
  }

  if (!currentAuthor || !authorsMap.has(currentAuthor)) {
    currentAuthor = null;
  }

  if (!currentAuthor) {
    showAuthorOverview(authorsMap, category.name);
  } else {
    const items = authorsMap.get(currentAuthor) || [];
    showAuthorItems(currentAuthor, items);
  }
}

function renderCustomCategory(category) {
  categoryList.classList.add('hidden');
  authorList.classList.add('hidden');
  backToAuthorsBtn.classList.add('hidden');
  backToCategoriesBtn.classList.remove('hidden');

  const items = libraryItems.filter((item) => item.categoryId === category.id);
  const hasItems = renderItemsList(items);

  libraryTitle.textContent = `Kategoria: ${category.name}`;
  librarySubtitle.textContent = hasItems
    ? 'Wybierz tytuł, aby uruchomić odtwarzacz.'
    : 'Brak audiobooków w tej kategorii.';

  if (hasItems) {
    hideEmptyState();
  } else {
    showEmptyState('Brak audiobooków w tej kategorii.');
  }
}

function updateCategorySelect() {
  if (!categorySelect) {
    return;
  }

  const wasInitialized = categorySelect.dataset.initialized === 'true';
  const previousValue = categorySelect.value;

  categorySelect.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Bez kategorii';
  categorySelect.appendChild(placeholderOption);

  const sortedCategories = sortCategoriesForDisplay(categories);
  sortedCategories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });

  const availableValues = Array.from(categorySelect.options).map((option) => option.value);
  let nextValue = previousValue;

  if (!wasInitialized) {
    const authorCategory = getAuthorCategory();
    nextValue = authorCategory ? authorCategory.id : '';
  } else if (!availableValues.includes(nextValue)) {
    const authorCategory = getAuthorCategory();
    nextValue = authorCategory ? authorCategory.id : '';
  }

  if (!availableValues.includes(nextValue)) {
    nextValue = '';
  }

  categorySelect.value = nextValue;
  categorySelect.dataset.initialized = 'true';
}

function groupByAuthor(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = resolveAuthorName(item.author);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });
  return map;
}

function showAuthorOverview(authorsMap, categoryName) {
  const authors = Array.from(authorsMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], 'pl', { sensitivity: 'base' })
  );

  if (!authors.length) {
    authorList.innerHTML = '';
    authorList.classList.add('hidden');
    libraryList.classList.add('hidden');
    backToAuthorsBtn.classList.add('hidden');
    libraryTitle.textContent = `Kategoria: ${categoryName}`;
    librarySubtitle.textContent = 'Brak audiobooków przypisanych do autorów.';
    showEmptyState('Brak audiobooków przypisanych do autorów.');
    return;
  }

  hideEmptyState();
  authorList.innerHTML = '';
  authorList.classList.remove('hidden');
  libraryList.classList.add('hidden');
  backToAuthorsBtn.classList.add('hidden');
  libraryTitle.textContent = `Kategoria: ${categoryName}`;
  librarySubtitle.textContent = 'Wybierz autora, aby zobaczyć jego audiobooki.';

  if (!authorTemplate) {
    return;
  }

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
  authorList.classList.add('hidden');
  backToAuthorsBtn.classList.remove('hidden');

  const hasItems = renderItemsList(items);

  libraryTitle.textContent = `Audiobooki autora ${author}`;
  librarySubtitle.textContent = hasItems
    ? 'Wybierz tytuł, aby uruchomić odtwarzacz.'
    : 'Brak audiobooków dla tego autora.';

  if (hasItems) {
    hideEmptyState();
  } else {
    showEmptyState('Brak audiobooków dla wybranego autora.');
  }
}

function renderItemsList(items) {
  if (!itemTemplate) {
    return false;
  }
  libraryList.innerHTML = '';

  if (!items.length) {
    libraryList.classList.add('hidden');
    return false;
  }

  libraryList.classList.remove('hidden');

  const sortedItems = [...items].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', 'pl', { sensitivity: 'base' })
  );

  sortedItems.forEach((item) => {
    const clone = itemTemplate.content.cloneNode(true);
    const article = clone.querySelector('.library-item');
    const cover = clone.querySelector('.cover');
    const titleEl = clone.querySelector('h3');
    const descriptionEl = clone.querySelector('.description');
    const pdfLink = clone.querySelector('.pdf-link');
    const playButton = clone.querySelector('.play-btn');
    const deleteButton = clone.querySelector('.delete-btn');
    const authorLink = clone.querySelector('.author-link');

    article.dataset.itemId = item.id;
    titleEl.textContent = item.title;
    descriptionEl.textContent = item.description || '';

    if (item.pdfUrl) {
      pdfLink.href = item.pdfUrl;
      pdfLink.classList.remove('hidden');
    } else {
      pdfLink.removeAttribute('href');
      pdfLink.classList.add('hidden');
    }

    const authorName = resolveAuthorName(item.author);
    authorLink.textContent = authorName;
    authorLink.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      loadAuthor(authorName);
    });

    if (item.imageUrl) {
      cover.style.backgroundImage = `url(${item.imageUrl})`;
      cover.classList.remove('placeholder');
    } else {
      cover.style.backgroundImage = '';
      cover.classList.add('placeholder');
    }

    playButton.addEventListener('click', () => loadTrack(item));

    if (currentUser && currentUser.role === 'admin') {
      deleteButton.classList.remove('hidden');
      deleteButton.addEventListener('click', () => handleDelete(item));
    } else {
      deleteButton.remove();
    }

    libraryList.appendChild(clone);
  });

  highlightCurrentTrack();
  return true;
}

function loadAuthor(author) {
  const authorCategory = getAuthorCategory();
  if (!authorCategory) {
    return;
  }
  currentCategoryId = authorCategory.id;
  currentAuthor = resolveAuthorName(author);
  renderLibrary();
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
  const authorName = resolveAuthorName(item.author);
  playerAuthor.textContent = `Autor: ${authorName}`;
  playerDescription.textContent = item.description || '';

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
  setPlaybackSpeed(currentSpeed);
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
  openSpeedModal();
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
}

async function handleDelete(item) {
  const confirmation = window.confirm(`Czy na pewno chcesz usunąć "${item.title}"?`);
  if (!confirmation) {
    return;
  }

  try {
    await apiRequest(`/api/library/${item.id}`, { method: 'DELETE' });
    libraryItems = libraryItems.filter((entry) => entry.id !== item.id);
    if (currentTrackId === item.id) {
      resetPlayer();
    }
    renderLibrary();
    alert('Audiobook został usunięty.');
  } catch (error) {
    alert(`Nie udało się usunąć audiobooka: ${error.message}`);
  }
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
      if (categorySelect) {
        categorySelect.dataset.initialized = 'true';
        const selectedCategory = formData.get('categoryId');
        if (typeof selectedCategory === 'string') {
          categorySelect.value = selectedCategory;
          currentCategoryId = selectedCategory ? selectedCategory : null;
        }
      }
      if (categorySelect && !categorySelect.value) {
        const authorCategory = getAuthorCategory();
        currentCategoryId = authorCategory ? authorCategory.id : null;
      }
      currentAuthor = null;
      fetchLibrary();
    } catch (error) {
      alert(`Nie udało się przesłać audiobooka: ${error.message}`);
    }
  });
}

if (categoryForm) {
  categoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = categoryNameInput ? categoryNameInput.value.trim() : '';
    if (!name) {
      return;
    }

    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (categoryNameInput) {
        categoryNameInput.value = '';
      }
      currentCategoryId = null;
      currentAuthor = null;
      await fetchLibrary();
      alert('Kategoria została dodana.');
    } catch (error) {
      alert(`Nie udało się dodać kategorii: ${error.message}`);
    }
  });
}

if (backToCategoriesBtn) {
  backToCategoriesBtn.addEventListener('click', () => {
    currentCategoryId = null;
    currentAuthor = null;
    renderLibrary();
  });
}

if (backToAuthorsBtn) {
  backToAuthorsBtn.addEventListener('click', () => {
    currentAuthor = null;
    renderLibrary();
  });
}

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

speedButton.addEventListener('click', () => {
  openSpeedModal();
});

speedModalClose.addEventListener('click', () => {
  closeSpeedModal();
});

speedModal.addEventListener('click', (event) => {
  if (event.target === speedModal) {
    closeSpeedModal();
  }
});

speedOptions.forEach((option) => {
  option.addEventListener('change', () => {
    const rate = Number(option.value);
    if (Number.isFinite(rate)) {
      setPlaybackSpeed(rate);
    }
    closeSpeedModal();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSpeedModal();
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
setPlaybackSpeed(currentSpeed);

fetchSession();
