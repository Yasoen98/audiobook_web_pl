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
const userForm = document.getElementById('user-form');
const newUsernameInput = document.getElementById('new-username');
const newPasswordInput = document.getElementById('new-password');
const categoryForm = document.getElementById('category-form');
const categoryNameInput = document.getElementById('category-name');
const categorySelect = document.getElementById('audiobook-category');
const categoryList = document.getElementById('category-list');
const backToCategoriesBtn = document.getElementById('back-to-categories');
const libraryTitle = document.getElementById('library-title');
const librarySubtitle = document.getElementById('library-subtitle');
const libraryList = document.getElementById('library-list');
const emptyLibrary = document.getElementById('empty-library');
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
const speedRange = document.getElementById('speed-range');
const speedInput = document.getElementById('speed-input');
const speedApplyBtn = document.getElementById('speed-apply');
const volumeSlider = document.getElementById('volume-slider');
const audioElement = document.getElementById('player-audio');
const chapterSelect = document.getElementById('chapter-select');

let currentUser = null;
let libraryItems = [];
let categories = [];
let currentCategoryId = null;
let currentTrackId = null;
let currentChapterId = null;
let pendingResume = null;
let currentSpeed = 1;
let progressState = createDefaultProgressState();
let autoResumeAttempted = false;
let pendingSpeedValue = null;
let modalInitialSpeed = null;
const lastProgressUpdate = {};
const UNCATEGORIZED_ID = '__uncategorized__';

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

function createDefaultProgressState() {
  return {
    playbackSpeed: 1,
    lastBookId: null,
    items: {}
  };
}

function clampSpeed(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(2, Math.max(0.5, value));
}

function formatSpeed(rate) {
  return clampSpeed(rate)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function normalizeProgressState(state) {
  const normalized = createDefaultProgressState();
  if (!state || typeof state !== 'object') {
    return normalized;
  }

  if (typeof state.playbackSpeed === 'number') {
    normalized.playbackSpeed = clampSpeed(state.playbackSpeed);
  }

  if (typeof state.lastBookId === 'string' && state.lastBookId.trim()) {
    normalized.lastBookId = state.lastBookId;
  }

  const items = state.items && typeof state.items === 'object' ? state.items : state;
  Object.keys(items).forEach((audioId) => {
    if (audioId === 'playbackSpeed' || audioId === 'lastBookId') {
      return;
    }
    const entry = items[audioId];
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const chapters = entry.chapters && typeof entry.chapters === 'object' ? entry.chapters : {};
    const chapterTimes = {};
    Object.keys(chapters).forEach((chapterId) => {
      const value = chapters[chapterId];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        chapterTimes[chapterId] = value;
      }
    });
    normalized.items[audioId] = {
      lastChapterId:
        typeof entry.lastChapterId === 'string' && entry.lastChapterId.trim()
          ? entry.lastChapterId
          : null,
      chapters: chapterTimes
    };
  });

  return normalized;
}

function ensureProgressItem(audioId) {
  if (!audioId) {
    return null;
  }
  if (!progressState.items[audioId]) {
    progressState.items[audioId] = { lastChapterId: null, chapters: {} };
  }
  return progressState.items[audioId];
}

function getSavedChapterTime(audioId, chapterId) {
  const entry = progressState.items[audioId];
  if (!entry || !entry.chapters || typeof entry.chapters !== 'object') {
    return 0;
  }
  const value = entry.chapters[chapterId];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function updateLocalProgressTime(audioId, chapterId, time) {
  if (!audioId || !chapterId) {
    return;
  }
  const entry = ensureProgressItem(audioId);
  if (!entry.chapters) {
    entry.chapters = {};
  }
  entry.chapters[chapterId] = time;
}

function setLastChapter(audioId, chapterId) {
  if (!audioId || !chapterId) {
    return;
  }
  const entry = ensureProgressItem(audioId);
  entry.lastChapterId = chapterId;
}

function getChapters(item) {
  if (!item || typeof item !== 'object') {
    return [];
  }
  const chapters = Array.isArray(item.chapters) ? item.chapters : [];
  if (chapters.length > 0) {
    return chapters
      .filter((chapter) => chapter && chapter.url)
      .map((chapter, index) => ({
        id: chapter.id || `${item.id}-chapter-${index}`,
        name:
          chapter.name && typeof chapter.name === 'string' && chapter.name.trim()
            ? chapter.name
            : `Rozdział ${index + 1}`,
        url: chapter.url
      }));
  }
  if (item.audioUrl) {
    return [
      {
        id: `${item.id}-chapter-0`,
        name: 'Rozdział 1',
        url: item.audioUrl
      }
    ];
  }
  return [];
}

function resolveAuthorName(author) {
  if (typeof author !== 'string') {
    return 'Nieznany autor';
  }
  const trimmed = author.trim();
  return trimmed || 'Nieznany autor';
}

async function setLoggedIn(user) {
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
    progressState = createDefaultProgressState();
    autoResumeAttempted = false;
    await fetchProgressState();
    await fetchLibrary();
    attemptAutoResume();
  } else {
    currentUser = null;
    welcomeText.textContent = '';
    userInfo.classList.add('hidden');
    uploadSection.classList.add('hidden');
    librarySection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    categories = [];
    currentCategoryId = null;
    categoryList.innerHTML = '';
    libraryList.innerHTML = '';
    emptyLibrary.classList.add('hidden');
    if (categorySelect) {
      categorySelect.innerHTML = '';
      delete categorySelect.dataset.initialized;
    }
    progressState = createDefaultProgressState();
    autoResumeAttempted = false;
    resetPlayer();
    setPlaybackSpeed(1, { persist: false });
  }
}

function resetPlayer() {
  currentTrackId = null;
  currentChapterId = null;
  pendingResume = null;
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
  updateChapterSelect([]);
}

function setPlaybackSpeed(rate, { persist = true } = {}) {
  const clamped = clampSpeed(rate);
  currentSpeed = clamped;
  audioElement.playbackRate = clamped;
  if (speedLabel) {
    speedLabel.textContent = `${formatSpeed(clamped)}x`;
  }
  if (speedRange && Number(speedRange.value) !== clamped) {
    speedRange.value = clamped;
  }
  if (speedInput && Number(speedInput.value) !== clamped) {
    speedInput.value = formatSpeed(clamped);
  }
  progressState.playbackSpeed = clamped;
  if (persist) {
    saveProgressState({ playbackSpeed: clamped });
  }
}

function openSpeedModal(triggerType = 'auto') {
  if (triggerType !== 'manual') {
    return;
  }

  if (!speedModal.classList.contains('hidden')) {
    return;
  }
  modalInitialSpeed = currentSpeed;
  pendingSpeedValue = currentSpeed;
  if (speedRange) {
    speedRange.value = currentSpeed;
  }
  if (speedInput) {
    speedInput.value = formatSpeed(currentSpeed);
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
  if (pendingSpeedValue !== null && modalInitialSpeed !== null) {
    setPlaybackSpeed(modalInitialSpeed, { persist: false });
  }
  pendingSpeedValue = null;
  modalInitialSpeed = null;
}

async function fetchSession() {
  try {
    const session = await apiRequest('/api/session');
    if (session) {
      await setLoggedIn(session);
    }
  } catch (error) {
    console.warn('Brak aktywnej sesji');
  }
}

async function fetchProgressState() {
  if (!currentUser) return;
  try {
    const progress = await apiRequest('/api/progress');
    progressState = normalizeProgressState(progress);
    setPlaybackSpeed(progressState.playbackSpeed || 1, { persist: false });
  } catch (error) {
    console.warn('Nie udało się pobrać ustawień odtwarzania:', error.message);
    progressState = createDefaultProgressState();
    setPlaybackSpeed(1, { persist: false });
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
    libraryItems = Array.isArray(items)
      ? items.map((item) => ({
          ...item,
          chapters: getChapters(item)
        }))
      : [];

    if (
      currentCategoryId &&
      currentCategoryId !== UNCATEGORIZED_ID &&
      !categories.some((category) => category.id === currentCategoryId)
    ) {
      currentCategoryId = null;
    }

    if (
      currentCategoryId === UNCATEGORIZED_ID &&
      !libraryItems.some((item) => !item.categoryId)
    ) {
      currentCategoryId = null;
    }

    renderLibrary();
    attemptAutoResume();
  } catch (error) {
    console.error(error);
    alert(`Nie udało się pobrać biblioteki: ${error.message}`);
  }
}

function renderLibrary() {
  updateCategorySelect();

  const uncategorizedCount = libraryItems.filter((item) => !item.categoryId).length;
  const hasCategories = categories.length > 0;
  const hasItems = libraryItems.length > 0;

  if (!hasCategories && uncategorizedCount === 0) {
    categoryList.classList.add('hidden');
    libraryList.classList.add('hidden');
    backToCategoriesBtn.classList.add('hidden');
    libraryTitle.textContent = 'Brak kategorii';
    librarySubtitle.textContent = 'Administrator może dodać kategorię w panelu powyżej.';
    showEmptyState('Brak kategorii. Dodaj pierwszą kategorię, aby rozpocząć.');
    return;
  }

  if (!currentCategoryId) {
    showCategoryOverview(uncategorizedCount);
    if (hasItems) {
      hideEmptyState();
    } else {
      showEmptyState('Brak audiobooków. Administrator może dodać nowe pozycje.');
    }
    return;
  }

  if (currentCategoryId === UNCATEGORIZED_ID) {
    renderUncategorizedCategory();
    return;
  }

  const category = categories.find((entry) => entry.id === currentCategoryId);
  if (!category) {
    currentCategoryId = null;
    renderLibrary();
    return;
  }

  renderCategoryItems(category);
}

function attemptAutoResume() {
  if (autoResumeAttempted) {
    return;
  }

  if (!progressState.lastBookId) {
    autoResumeAttempted = true;
    return;
  }

  const item = libraryItems.find((entry) => entry.id === progressState.lastBookId);
  if (!item) {
    return;
  }

  autoResumeAttempted = true;
  loadTrack(item, { autoplay: false, resumeFromProgress: true });
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
    const nameA = (a.name || '').toLocaleLowerCase('pl');
    const nameB = (b.name || '').toLocaleLowerCase('pl');
    return nameA.localeCompare(nameB, 'pl', { sensitivity: 'base' });
  });
}

function showCategoryOverview(uncategorizedCount) {
  if (!categoryTemplate) {
    return;
  }
  categoryList.innerHTML = '';
  categoryList.classList.remove('hidden');
  libraryList.classList.add('hidden');
  backToCategoriesBtn.classList.add('hidden');
  libraryTitle.textContent = 'Kategorie';
  librarySubtitle.textContent = 'Wybierz kategorię, aby zobaczyć dostępne audiobooki.';

  const sortedCategories = sortCategoriesForDisplay(categories);
  const categoriesToRender = [...sortedCategories];

  if (uncategorizedCount > 0) {
    categoriesToRender.push({
      id: UNCATEGORIZED_ID,
      name: 'Bez kategorii',
      type: 'virtual'
    });
  }

  categoriesToRender.forEach((category) => {
    const clone = categoryTemplate.content.cloneNode(true);
    const selectBtn = clone.querySelector('.category-select');
    const nameEl = clone.querySelector('.category-name');
    const countEl = clone.querySelector('.category-count');
    const deleteBtn = clone.querySelector('.category-delete');

    const itemsInCategory =
      category.id === UNCATEGORIZED_ID
        ? uncategorizedCount
        : libraryItems.filter((item) => item.categoryId === category.id).length;

    nameEl.textContent = category.name;
    countEl.textContent = formatCount(itemsInCategory);

    selectBtn.addEventListener('click', () => {
      currentCategoryId = category.id;
      renderLibrary();
    });

    if (!currentUser || currentUser.role !== 'admin' || category.id === UNCATEGORIZED_ID) {
      deleteBtn.classList.add('hidden');
    } else {
      deleteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleCategoryDelete(category);
      });
    }

    categoryList.appendChild(clone);
  });
}

function renderUncategorizedCategory() {
  categoryList.classList.add('hidden');
  backToCategoriesBtn.classList.remove('hidden');

  const items = libraryItems.filter((item) => !item.categoryId);
  const hasItems = renderItemsList(items);

  libraryTitle.textContent = 'Audiobooki bez kategorii';
  librarySubtitle.textContent = hasItems
    ? 'Wybierz tytuł, aby uruchomić odtwarzacz.'
    : 'Brak audiobooków przypisanych do tej sekcji.';

  if (hasItems) {
    hideEmptyState();
  } else {
    showEmptyState('Brak audiobooków przypisanych do tej sekcji.');
  }
}

function renderCategoryItems(category) {
  categoryList.classList.add('hidden');
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

  renderCategoryItems(category);
}

async function handleCategoryDelete(category) {
  if (!category || !category.id) {
    return;
  }

  const confirmation = window.confirm(
    `Czy na pewno chcesz usunąć kategorię "${category.name}"?`
  );

  if (!confirmation) {
    return;
  }

  try {
    await apiRequest(`/api/categories/${category.id}`, { method: 'DELETE' });
    if (currentCategoryId === category.id) {
      currentCategoryId = null;
    }
    await fetchLibrary();
    alert('Kategoria została usunięta.');
  } catch (error) {
    alert(`Nie udało się usunąć kategorii: ${error.message}`);
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
    nextValue = '';
  }

  if (!availableValues.includes(nextValue)) {
    nextValue = '';
  }

  categorySelect.value = nextValue;
  categorySelect.dataset.initialized = 'true';
}

function updateChapterSelect(chapters, selectedId) {
  if (!chapterSelect) {
    return;
  }

  chapterSelect.innerHTML = '';

  if (!Array.isArray(chapters) || chapters.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Brak rozdziałów';
    chapterSelect.appendChild(option);
    chapterSelect.disabled = true;
    chapterSelect.dataset.itemId = '';
    return;
  }

  const normalizedChapters = chapters.filter((chapter) => chapter && chapter.id && chapter.url);
  if (!normalizedChapters.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Brak rozdziałów';
    chapterSelect.appendChild(option);
    chapterSelect.disabled = true;
    chapterSelect.dataset.itemId = '';
    return;
  }

  normalizedChapters.forEach((chapter) => {
    const option = document.createElement('option');
    option.value = chapter.id;
    option.textContent = chapter.name || 'Rozdział';
    chapterSelect.appendChild(option);
  });

  const ids = normalizedChapters.map((chapter) => chapter.id);
  let nextValue = selectedId && ids.includes(selectedId) ? selectedId : ids[0];
  chapterSelect.value = nextValue;
  chapterSelect.disabled = normalizedChapters.length === 0;
  chapterSelect.dataset.itemId = currentTrackId || '';
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
    const authorText = clone.querySelector('.author-text');

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
    authorText.textContent = authorName;

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

async function loadTrack(item, options = {}) {
  if (!currentUser) return;

  const {
    chapterId: requestedChapterId = null,
    autoplay = true,
    resumeFromProgress = true
  } = options;

  closeSpeedModal();

  const chapters = getChapters(item);
  if (!chapters.length) {
    alert('Brak rozdziałów audio dla tego audiobooka.');
    return;
  }

  const progressEntry = ensureProgressItem(item.id);
  let selectedChapter = chapters[0];

  if (requestedChapterId) {
    const match = chapters.find((chapter) => chapter.id === requestedChapterId);
    if (match) {
      selectedChapter = match;
    }
  } else if (progressEntry.lastChapterId) {
    const savedChapter = chapters.find((chapter) => chapter.id === progressEntry.lastChapterId);
    if (savedChapter) {
      selectedChapter = savedChapter;
    }
  }

  const sameTrackSameChapter =
    currentTrackId === item.id && currentChapterId === selectedChapter.id && !!audioElement.src;

  const savedTime = getSavedChapterTime(item.id, selectedChapter.id);
  const shouldResume = resumeFromProgress && savedTime > 0;

  if (sameTrackSameChapter) {
    if (audioElement.paused && autoplay) {
      try {
        await audioElement.play();
      } catch (error) {
        console.warn('Nie można wznowić odtwarzania:', error.message);
      }
    } else if (!autoplay) {
      audioElement.pause();
    }
    return;
  }

  currentTrackId = item.id;
  currentChapterId = selectedChapter.id;
  progressState.lastBookId = item.id;
  setLastChapter(item.id, selectedChapter.id);
  updateLocalProgressTime(item.id, selectedChapter.id, savedTime);

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

  updateChapterSelect(chapters, selectedChapter.id);

  audioElement.pause();
  audioElement.currentTime = 0;
  audioElement.src = selectedChapter.url;
  audioElement.load();
  pendingResume = shouldResume
    ? {
        chapterId: selectedChapter.id,
        time: savedTime
      }
    : null;

  setPlaybackSpeed(progressState.playbackSpeed || currentSpeed, { persist: false });
  saveProgressState({
    lastBookId: item.id,
    audioId: item.id,
    lastChapterId: selectedChapter.id
  });

  highlightCurrentTrack();

  if (autoplay) {
    try {
      await audioElement.play();
    } catch (error) {
      console.warn('Nie można automatycznie rozpocząć odtwarzania:', error.message);
      playPauseBtn.textContent = '▶️';
      playerStatus.textContent = 'Gotowy do odtwarzania.';
    }
  } else {
    playPauseBtn.textContent = '▶️';
    playerStatus.textContent = 'Gotowy do odtwarzania.';
  }
}

function applyPendingResume() {
  if (
    pendingResume &&
    pendingResume.chapterId === currentChapterId &&
    audioElement.readyState >= 1 &&
    audioElement.duration
  ) {
    const resumeTime = Math.min(pendingResume.time, audioElement.duration);
    if (resumeTime > 0) {
      audioElement.currentTime = resumeTime;
    }
    pendingResume = null;
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
    if (progressState.items[item.id]) {
      delete progressState.items[item.id];
    }
    if (progressState.lastBookId === item.id) {
      progressState.lastBookId = null;
    }
    renderLibrary();
    alert('Audiobook został usunięty.');
  } catch (error) {
    alert(`Nie udało się usunąć audiobooka: ${error.message}`);
  }
}

async function saveProgressState(update = {}) {
  if (!currentUser) return;
  try {
    await apiRequest('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
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
    await setLoggedIn(user);
  } catch (error) {
    alert(`Logowanie nie powiodło się: ${error.message}`);
  }
});

if (userForm) {
  userForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = newUsernameInput ? newUsernameInput.value.trim() : '';
    const password = newPasswordInput ? newPasswordInput.value.trim() : '';
    if (!username || !password) {
      return;
    }

    try {
      await apiRequest('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      userForm.reset();
      alert(`Użytkownik "${username}" został dodany.`);
    } catch (error) {
      alert(`Nie udało się dodać użytkownika: ${error.message}`);
    }
  });
}

logoutBtn.addEventListener('click', async () => {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
  } catch (error) {
    console.warn('Problem przy wylogowaniu:', error.message);
  } finally {
    await setLoggedIn(null);
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
        const trimmedCategory =
          typeof selectedCategory === 'string' ? selectedCategory.trim() : '';
        if (trimmedCategory) {
          categorySelect.value = trimmedCategory;
          currentCategoryId = trimmedCategory;
        } else {
          categorySelect.value = '';
          currentCategoryId = UNCATEGORIZED_ID;
        }
      }
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
    renderLibrary();
  });
}

if (chapterSelect) {
  chapterSelect.addEventListener('change', () => {
    const targetItemId = chapterSelect.dataset.itemId || currentTrackId;
    const chapterId = chapterSelect.value;
    if (!targetItemId || !chapterId) {
      return;
    }
    const item = libraryItems.find((entry) => entry.id === targetItemId);
    if (item) {
      loadTrack(item, { chapterId, autoplay: true, resumeFromProgress: true });
    }
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
  if (currentTrackId && currentChapterId) {
    updateLocalProgressTime(currentTrackId, currentChapterId, audioElement.currentTime);
  }
});

speedButton.addEventListener('click', (event) => {
  if (!event.isTrusted) {
    return;
  }

  openSpeedModal('manual');
});

speedModalClose.addEventListener('click', () => {
  closeSpeedModal();
});

speedModal.addEventListener('click', (event) => {
  if (event.target === speedModal) {
    closeSpeedModal();
  }
});

if (speedRange) {
  speedRange.addEventListener('input', () => {
    const rate = Number(speedRange.value);
    if (Number.isFinite(rate)) {
      pendingSpeedValue = clampSpeed(rate);
      setPlaybackSpeed(rate, { persist: false });
    }
  });
}

if (speedInput) {
  const applySpeedInput = () => {
    const rate = Number(speedInput.value);
    if (Number.isFinite(rate)) {
      pendingSpeedValue = clampSpeed(rate);
      setPlaybackSpeed(rate, { persist: false });
    }
  };
  speedInput.addEventListener('change', applySpeedInput);
  speedInput.addEventListener('blur', applySpeedInput);
}

if (speedApplyBtn) {
  speedApplyBtn.addEventListener('click', () => {
    const rate = pendingSpeedValue ?? currentSpeed;
    setPlaybackSpeed(rate);
    modalInitialSpeed = null;
    pendingSpeedValue = null;
    closeSpeedModal();
  });
}

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
  if (!currentTrackId || !currentChapterId || !audioElement.duration) return;
  const key = `${currentTrackId}:${currentChapterId}`;
  if (!lastProgressUpdate[key] || Date.now() - lastProgressUpdate[key] > 5000) {
    lastProgressUpdate[key] = Date.now();
    const time = Math.floor(audioElement.currentTime);
    updateLocalProgressTime(currentTrackId, currentChapterId, time);
    saveProgressState({
      audioId: currentTrackId,
      chapterId: currentChapterId,
      time,
      lastBookId: currentTrackId
    });
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
  if (currentTrackId && currentChapterId) {
    const time = Math.floor(audioElement.currentTime);
    const key = `${currentTrackId}:${currentChapterId}`;
    lastProgressUpdate[key] = Date.now();
    updateLocalProgressTime(currentTrackId, currentChapterId, time);
    saveProgressState({
      audioId: currentTrackId,
      chapterId: currentChapterId,
      time,
      lastBookId: currentTrackId
    });
  }
});

audioElement.addEventListener('ended', () => {
  playPauseBtn.textContent = '▶️';
  playerStatus.textContent = 'Zakończono odsłuch.';
  if (currentTrackId && currentChapterId) {
    const key = `${currentTrackId}:${currentChapterId}`;
    lastProgressUpdate[key] = Date.now();
    updateLocalProgressTime(currentTrackId, currentChapterId, 0);
    saveProgressState({
      audioId: currentTrackId,
      chapterId: currentChapterId,
      time: 0,
      lastBookId: currentTrackId
    });
  }
  highlightCurrentTrack();
});

audioElement.volume = Number(volumeSlider.value);
setPlaybackSpeed(currentSpeed, { persist: false });

fetchSession();
