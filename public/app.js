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
const libraryFilters = document.getElementById('library-filters');
const librarySearchInput = document.getElementById('library-search');
const filterAuthorSelect = document.getElementById('filter-author');
const filterCategorySelect = document.getElementById('filter-category');
const filterTagSelect = document.getElementById('filter-tag');
const filtersClearBtn = document.getElementById('filters-clear');
const categoryTemplate = document.getElementById('category-card-template');
const itemTemplate = document.getElementById('library-item-template');
const adminToggleBtn = document.getElementById('admin-toggle-btn');
const uploadStatus = document.getElementById('upload-status');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const uploadProgressText = document.getElementById('upload-progress-text');
const adminStatsContainer = document.getElementById('user-stats');
const adminStatsEmpty = document.getElementById('user-stats-empty');
const recommendationsSection = document.getElementById('recommendations-section');
const recommendationsList = document.getElementById('recommendations-list');
const recommendationsEmpty = document.getElementById('recommendations-empty');
const defaultRecommendationsEmptyText = recommendationsEmpty
  ? recommendationsEmpty.textContent
  : 'Brak rekomendacji.';

const playerPanel = document.getElementById('player-panel');
const playerBody = document.getElementById('player-body');
const playerStatus = document.getElementById('player-status');
const playerTitle = document.getElementById('player-title');
const playerAuthor = document.getElementById('player-author');
const playerDescription = document.getElementById('player-description');
const playerCover = document.getElementById('player-cover');
const playerCoverImage = document.getElementById('player-cover-image');
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
const reviewsSection = document.getElementById('reviews-section');
const reviewsSummary = document.getElementById('reviews-summary');
const reviewForm = document.getElementById('review-form');
const reviewRating = document.getElementById('review-rating');
const reviewComment = document.getElementById('review-comment');
const reviewFeedback = document.getElementById('review-feedback');
const reviewsList = document.getElementById('reviews-list');
const reviewsEmpty = document.getElementById('reviews-empty');

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
let adminViewMode = 'library';
const lastProgressUpdate = {};
const UNCATEGORIZED_ID = '__uncategorized__';
let filtersState = { query: '', author: '', category: '', tag: '' };
let currentReviewSummary = null;
let recommendationsData = [];
let recommendationsRefreshTimeout = null;

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

function setCoverImage(container, imageElement, imageUrl, options = {}) {
  if (!container || !imageElement) {
    return;
  }

  const { altText, fallbackAlt } = options;

  if (imageUrl) {
    imageElement.src = imageUrl;
    imageElement.alt = altText || 'Okładka audiobooka';
    container.classList.remove('placeholder');
    if (container.hasAttribute('aria-hidden')) {
      container.setAttribute('aria-hidden', 'false');
    }
  } else {
    imageElement.removeAttribute('src');
    imageElement.alt = fallbackAlt || 'Brak okładki';
    container.classList.add('placeholder');
    if (container.hasAttribute('aria-hidden')) {
      container.setAttribute('aria-hidden', 'true');
    }
  }
}

function showUploadProgress(message, percent) {
  if (!uploadStatus || !uploadProgressBar || !uploadProgressText) {
    return;
  }

  uploadStatus.classList.remove('hidden');

  if (typeof percent === 'number' && Number.isFinite(percent)) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    uploadProgressBar.style.width = `${clamped}%`;
  } else {
    uploadProgressBar.style.width = '0%';
  }

  if (message) {
    uploadProgressText.textContent = message;
  }
}

function resetUploadProgress() {
  if (!uploadStatus || !uploadProgressBar || !uploadProgressText) {
    return;
  }

  uploadProgressBar.style.width = '0%';
  uploadProgressText.textContent = 'Gotowy do przesyłania.';
  uploadStatus.classList.add('hidden');
}

function setFormDisabled(form, disabled) {
  if (!form || !form.elements) {
    return;
  }

  Array.from(form.elements).forEach((element) => {
    if (element && 'disabled' in element) {
      element.disabled = disabled;
    }
  });
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

function normalizeItemTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags
      .split(/[,;\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function formatRating(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function formatDateShort(isoString) {
  if (!isoString) {
    return '';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function renderTagList(container, tags) {
  if (!container) {
    return;
  }

  const normalized = normalizeItemTags(tags);
  container.innerHTML = '';

  if (!normalized.length) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  normalized.forEach((tag) => {
    const element = document.createElement('li');
    element.textContent = tag;
    container.appendChild(element);
  });
}

function hasActiveFilters() {
  return (
    (filtersState.query && filtersState.query.trim()) ||
    filtersState.author ||
    filtersState.category ||
    filtersState.tag
  );
}

function getFilteredItems() {
  if (!libraryItems.length) {
    return [];
  }

  const query = filtersState.query.trim().toLocaleLowerCase('pl');
  const authorFilter = filtersState.author;
  const categoryFilter = filtersState.category;
  const tagFilter = filtersState.tag;

  return libraryItems.filter((item) => {
    if (categoryFilter) {
      const categoryKey = item.categoryId || UNCATEGORIZED_ID;
      if (categoryFilter === UNCATEGORIZED_ID) {
        if (item.categoryId) {
          return false;
        }
      } else if (categoryKey !== categoryFilter) {
        return false;
      }
    }

    if (authorFilter) {
      const authorKey = resolveAuthorName(item.author).toLocaleLowerCase('pl');
      if (authorKey !== authorFilter) {
        return false;
      }
    }

    if (tagFilter) {
      const tags = normalizeItemTags(item.tags).map((tag) =>
        tag.toLocaleLowerCase('pl')
      );
      if (!tags.includes(tagFilter)) {
        return false;
      }
    }

    if (query) {
      const haystack = [
        item.title || '',
        resolveAuthorName(item.author),
        item.description || '',
        ...normalizeItemTags(item.tags)
      ]
        .join(' ')
        .toLocaleLowerCase('pl');

      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

function populateFilterSelect(select, entries, placeholder) {
  if (!select) {
    return;
  }

  select.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  entries.forEach(([value, label]) => {
    if (typeof value !== 'string') {
      return;
    }
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function setSelectValue(select, value) {
  if (!select) {
    return;
  }
  const available = Array.from(select.options).map((option) => option.value);
  if (available.includes(value)) {
    select.value = value;
  } else {
    select.value = '';
  }
}

function updateLibraryFilters() {
  if (!libraryFilters) {
    return;
  }

  if (!libraryItems.length) {
    libraryFilters.classList.add('hidden');
    if (librarySearchInput) {
      librarySearchInput.value = '';
    }
    if (filterAuthorSelect) {
      filterAuthorSelect.innerHTML = '';
    }
    if (filterCategorySelect) {
      filterCategorySelect.innerHTML = '';
    }
    if (filterTagSelect) {
      filterTagSelect.innerHTML = '';
    }
    return;
  }

  libraryFilters.classList.remove('hidden');

  if (librarySearchInput && librarySearchInput.value !== filtersState.query) {
    librarySearchInput.value = filtersState.query;
  }

  if (filterAuthorSelect) {
    const authors = new Map();
    libraryItems.forEach((item) => {
      const label = resolveAuthorName(item.author);
      const key = label.toLocaleLowerCase('pl');
      if (!authors.has(key)) {
        authors.set(key, label);
      }
    });
    const authorEntries = Array.from(authors.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], 'pl', { sensitivity: 'base' })
    );
    populateFilterSelect(filterAuthorSelect, authorEntries, 'Wszyscy autorzy');
    setSelectValue(filterAuthorSelect, filtersState.author);
  }

  if (filterCategorySelect) {
    const uniqueCategories = new Map();
    categories.forEach((category) => {
      if (category && category.id) {
        uniqueCategories.set(category.id, category.name || 'Kategoria');
      }
    });
    if (libraryItems.some((item) => !item.categoryId)) {
      uniqueCategories.set(UNCATEGORIZED_ID, 'Bez kategorii');
    }
    const categoryEntries = Array.from(uniqueCategories.entries()).sort((a, b) =>
      (a[1] || '').localeCompare(b[1] || '', 'pl', { sensitivity: 'base' })
    );
    populateFilterSelect(
      filterCategorySelect,
      categoryEntries,
      'Wszystkie kategorie'
    );
    setSelectValue(filterCategorySelect, filtersState.category);
  }

  if (filterTagSelect) {
    const tags = new Map();
    libraryItems.forEach((item) => {
      normalizeItemTags(item.tags).forEach((tag) => {
        const key = tag.toLocaleLowerCase('pl');
        if (!tags.has(key)) {
          tags.set(key, tag);
        }
      });
    });
    const tagEntries = Array.from(tags.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], 'pl', { sensitivity: 'base' })
    );
    populateFilterSelect(filterTagSelect, tagEntries, 'Wszystkie tagi');
    setSelectValue(filterTagSelect, filtersState.tag);
  }
}

function resetFilters({ render = true } = {}) {
  filtersState = { query: '', author: '', category: '', tag: '' };
  if (librarySearchInput) {
    librarySearchInput.value = '';
  }
  if (filterAuthorSelect) {
    filterAuthorSelect.value = '';
  }
  if (filterCategorySelect) {
    filterCategorySelect.value = '';
  }
  if (filterTagSelect) {
    filterTagSelect.value = '';
  }
  if (render) {
    renderLibrary();
  }
}

function updateAdminView(mode = adminViewMode) {
  if (!librarySection || !uploadSection) {
    return;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    librarySection.classList.remove('hidden');
    uploadSection.classList.add('hidden');
    if (adminToggleBtn) {
      adminToggleBtn.classList.add('hidden');
      adminToggleBtn.removeAttribute('aria-pressed');
    }
    adminViewMode = 'library';
    return;
  }

  adminViewMode = mode === 'admin' ? 'admin' : 'library';

  if (adminToggleBtn) {
    adminToggleBtn.classList.remove('hidden');
    adminToggleBtn.textContent =
      adminViewMode === 'admin' ? 'Pokaż bibliotekę' : 'Panel administratora';
    adminToggleBtn.setAttribute(
      'aria-pressed',
      adminViewMode === 'admin' ? 'true' : 'false'
    );
  }

  if (adminViewMode === 'admin') {
    uploadSection.classList.remove('hidden');
    librarySection.classList.add('hidden');
  } else {
    librarySection.classList.remove('hidden');
    uploadSection.classList.add('hidden');
  }
}

async function setLoggedIn(user) {
  currentUser = user;
  if (user) {
    loginSection.classList.add('hidden');
    userInfo.classList.remove('hidden');
    welcomeText.textContent = `Zalogowano jako ${user.username} (${user.role})`;
    adminViewMode = 'library';
    if (user.role === 'admin') {
      if (adminToggleBtn) {
        adminToggleBtn.classList.remove('hidden');
      }
      updateAdminView('library');
    } else {
      if (adminToggleBtn) {
        adminToggleBtn.classList.add('hidden');
        adminToggleBtn.removeAttribute('aria-pressed');
      }
      librarySection.classList.remove('hidden');
      uploadSection.classList.add('hidden');
    }
    currentCategoryId = null;
    progressState = createDefaultProgressState();
    autoResumeAttempted = false;
    filtersState = { query: '', author: '', category: '', tag: '' };
    resetReviews();
    resetRecommendations();
    if (librarySearchInput) {
      librarySearchInput.value = '';
    }
    if (filterAuthorSelect) {
      filterAuthorSelect.value = '';
    }
    if (filterCategorySelect) {
      filterCategorySelect.value = '';
    }
    if (filterTagSelect) {
      filterTagSelect.value = '';
    }
    await fetchProgressState();
    await fetchLibrary();
    attemptAutoResume();
  } else {
    currentUser = null;
    welcomeText.textContent = '';
    userInfo.classList.add('hidden');
    if (adminToggleBtn) {
      adminToggleBtn.classList.add('hidden');
      adminToggleBtn.removeAttribute('aria-pressed');
    }
    adminViewMode = 'library';
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
    resetUploadProgress();
    if (adminStatsContainer) {
      adminStatsContainer.innerHTML = '';
      if (adminStatsEmpty) {
        adminStatsContainer.appendChild(adminStatsEmpty);
      }
    }
    resetFilters({ render: false });
    resetReviews();
    resetRecommendations();
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
  setCoverImage(playerCover, playerCoverImage, null, { fallbackAlt: 'Brak okładki' });
  playerBody.classList.add('hidden');
  playerPanel.classList.add('hidden');
  playerStatus.textContent = 'Wybierz audiobook, aby rozpocząć.';
  closeSpeedModal();
  updateChapterSelect([]);
  resetReviews();
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
          chapters: getChapters(item),
          tags: normalizeItemTags(item.tags)
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
    if (currentUser && currentUser.role === 'admin') {
      fetchAdminStats();
    }
    if (currentUser) {
      fetchRecommendations();
    }
  } catch (error) {
    console.error(error);
    alert(`Nie udało się pobrać biblioteki: ${error.message}`);
  }
}

function renderLibrary() {
  updateCategorySelect();
  updateLibraryFilters();

  const filtersActive = hasActiveFilters();
  const filteredItems = filtersActive ? getFilteredItems() : [];

  const uncategorizedCount = libraryItems.filter((item) => !item.categoryId).length;
  const hasCategories = categories.length > 0;
  const hasItems = libraryItems.length > 0;

  if (filtersActive) {
    categoryList.classList.add('hidden');
    backToCategoriesBtn.classList.add('hidden');
    const hasFilteredItems = renderItemsList(filteredItems);

    libraryTitle.textContent = 'Wyniki wyszukiwania';
    if (hasFilteredItems) {
      librarySubtitle.textContent = `Znaleziono ${formatCount(filteredItems.length)} dopasowane do filtrów.`;
      hideEmptyState();
    } else {
      librarySubtitle.textContent = 'Brak wyników dla wybranych filtrów.';
      showEmptyState('Brak wyników. Spróbuj zmienić kryteria wyszukiwania.');
    }
    return;
  }

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
      resetFilters({ render: false });
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
    const coverImage = cover ? cover.querySelector('.cover-image') : null;
    const titleEl = clone.querySelector('h3');
    const descriptionEl = clone.querySelector('.description');
    const pdfLink = clone.querySelector('.pdf-link');
    const playButton = clone.querySelector('.play-btn');
    const deleteButton = clone.querySelector('.delete-btn');
    const authorText = clone.querySelector('.author-text');
    const tagList = clone.querySelector('.tag-list');

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

    renderTagList(tagList, item.tags);

    setCoverImage(cover, coverImage, item.imageUrl, {
      altText: item.title ? `Okładka audiobooka ${item.title}` : 'Okładka audiobooka',
      fallbackAlt: 'Brak okładki'
    });

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

function createStatsMessage(text) {
  const paragraph = document.createElement('p');
  paragraph.className = 'stats-empty';
  paragraph.textContent = text;
  return paragraph;
}

function showAdminStatsLoading() {
  if (!adminStatsContainer) {
    return;
  }
  adminStatsContainer.innerHTML = '';
  adminStatsContainer.appendChild(createStatsMessage('Ładowanie statystyk...'));
}

function renderAdminStats(data) {
  if (!adminStatsContainer) {
    return;
  }

  const stats = Array.isArray(data)
    ? data
    : data && Array.isArray(data.users)
    ? data.users
    : [];

  adminStatsContainer.innerHTML = '';

  if (!stats.length) {
    if (adminStatsEmpty) {
      adminStatsContainer.appendChild(adminStatsEmpty);
    } else {
      adminStatsContainer.appendChild(
        createStatsMessage('Brak zapisanych postępów słuchania.')
      );
    }
    return;
  }

  stats.forEach((userStat) => {
    if (!userStat || !userStat.username) {
      return;
    }

    const card = document.createElement('article');
    card.className = 'stats-user';

    const header = document.createElement('div');
    header.className = 'stats-user-header';

    const title = document.createElement('h4');
    title.textContent = userStat.username;
    header.appendChild(title);

    const total = document.createElement('span');
    total.className = 'stats-total';
    total.textContent = `Łącznie: ${formatDurationDetailed(
      typeof userStat.totalSeconds === 'number' ? userStat.totalSeconds : 0
    )}`;
    header.appendChild(total);

    card.appendChild(header);

    const items = Array.isArray(userStat.items) ? userStat.items : [];

    if (items.length) {
      const currentBookId =
        typeof userStat.currentBookId === 'string' && userStat.currentBookId.trim()
          ? userStat.currentBookId
          : userStat.current && userStat.current.audioId;
      const currentEntry =
        (currentBookId && items.find((entry) => entry && entry.audioId === currentBookId)) ||
        items[0];

      if (currentEntry) {
        const current = document.createElement('p');
        current.className = 'stats-current';
        const chapterInfo =
          currentEntry.lastChapterName && currentEntry.lastChapterName.trim()
            ? ` – ${currentEntry.lastChapterName}`
            : '';
        const lastPosition = formatTime(
          typeof currentEntry.lastPositionSeconds === 'number'
            ? currentEntry.lastPositionSeconds
            : 0
        );
        current.textContent = `Obecnie: ${currentEntry.title || 'Audiobook'}${chapterInfo} (${lastPosition})`;
        card.appendChild(current);
      }

      const list = document.createElement('ul');
      list.className = 'stats-books';

      items.forEach((entry) => {
        if (!entry || !entry.title) {
          return;
        }
        const listItem = document.createElement('li');
        const chapterInfo =
          entry.lastChapterName && entry.lastChapterName.trim()
            ? ` – ${entry.lastChapterName}`
            : '';
        listItem.textContent = `${entry.title}${chapterInfo}: ${formatDurationDetailed(
          typeof entry.totalSeconds === 'number' ? entry.totalSeconds : 0
        )}`;
        list.appendChild(listItem);
      });

      card.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'stats-current';
      empty.textContent = 'Brak zapisanych postępów.';
      card.appendChild(empty);
    }

    adminStatsContainer.appendChild(card);
  });
}

function renderAdminStatsError(message) {
  if (!adminStatsContainer) {
    return;
  }
  adminStatsContainer.innerHTML = '';
  adminStatsContainer.appendChild(
    createStatsMessage(`Nie udało się pobrać statystyk: ${message}`)
  );
}

async function fetchAdminStats() {
  if (!currentUser || currentUser.role !== 'admin' || !adminStatsContainer) {
    return;
  }

  if (adminViewMode === 'admin') {
    showAdminStatsLoading();
  }

  try {
    const response = await apiRequest('/api/admin/stats');
    renderAdminStats(response);
  } catch (error) {
    console.error('Nie udało się pobrać statystyk:', error);
    renderAdminStatsError(error.message);
  }
}

function resetReviews() {
  currentReviewSummary = null;
  if (reviewFeedback) {
    reviewFeedback.textContent = '';
  }
  if (reviewsSummary) {
    reviewsSummary.textContent = '';
  }
  if (reviewsList) {
    reviewsList.innerHTML = '';
    reviewsList.classList.add('hidden');
  }
  if (reviewsEmpty) {
    reviewsEmpty.classList.add('hidden');
  }
  if (reviewForm) {
    reviewForm.reset();
  }
  if (reviewsSection) {
    reviewsSection.classList.add('hidden');
  }
}

function renderReviews(summary) {
  if (!reviewsSection) {
    return;
  }

  if (!summary || summary.audioId !== currentTrackId) {
    return;
  }

  currentReviewSummary = summary;
  reviewsSection.classList.remove('hidden');

  if (reviewFeedback) {
    reviewFeedback.textContent = '';
  }

  if (reviewsSummary) {
    if (summary.totalReviews > 0 && Number.isFinite(summary.averageRating)) {
      const formatted = formatRating(summary.averageRating) || summary.averageRating;
      const countLabel = summary.totalReviews === 1
        ? '1 recenzja'
        : summary.totalReviews >= 2 && summary.totalReviews <= 4
        ? `${summary.totalReviews} recenzje`
        : `${summary.totalReviews} recenzji`;
      reviewsSummary.textContent = `Średnia: ${formatted} / 5 · ${countLabel}`;
    } else {
      reviewsSummary.textContent = 'Brak ocen. Dodaj swoją recenzję!';
    }
  }

  if (reviewForm) {
    const userReview =
      currentUser && Array.isArray(summary.reviews)
        ? summary.reviews.find((entry) => entry && entry.username === currentUser.username)
        : null;
    if (reviewRating) {
      reviewRating.value = userReview ? String(userReview.rating) : '';
    }
    if (reviewComment) {
      reviewComment.value = userReview ? userReview.comment || '' : '';
    }
  }

  if (!reviewsList) {
    return;
  }

  reviewsList.innerHTML = '';
  const list = Array.isArray(summary.reviews) ? summary.reviews : [];

  if (!list.length) {
    reviewsList.classList.add('hidden');
    if (reviewsEmpty) {
      reviewsEmpty.classList.remove('hidden');
    }
    return;
  }

  reviewsList.classList.remove('hidden');
  if (reviewsEmpty) {
    reviewsEmpty.classList.add('hidden');
  }

  const sorted = [...list].sort((a, b) => {
    const first = new Date(b.updatedAt || b.createdAt || 0).getTime();
    const second = new Date(a.updatedAt || a.createdAt || 0).getTime();
    return first - second;
  });

  sorted.forEach((review) => {
    if (!review || typeof review.username !== 'string') {
      return;
    }

    const item = document.createElement('article');
    item.className = 'review-item';

    const header = document.createElement('div');
    header.className = 'review-item-header';

    const name = document.createElement('strong');
    name.textContent = review.username;
    header.appendChild(name);

    if (Number.isFinite(review.rating)) {
      const ratingValue = document.createElement('span');
      ratingValue.className = 'review-rating';
      const formatted = formatRating(review.rating) || review.rating;
      ratingValue.textContent = `${formatted} / 5`;
      header.appendChild(ratingValue);
    }

    const dateText = formatDateShort(review.updatedAt || review.createdAt);
    if (dateText) {
      const dateEl = document.createElement('span');
      dateEl.className = 'review-date';
      dateEl.textContent = dateText;
      header.appendChild(dateEl);
    }

    item.appendChild(header);

    if (review.comment) {
      const content = document.createElement('p');
      content.className = 'review-comment';
      content.textContent = review.comment;
      item.appendChild(content);
    }

    reviewsList.appendChild(item);
  });
}

async function loadReviewsForTrack(audioId) {
  if (!currentUser || !audioId) {
    resetReviews();
    return;
  }

  if (reviewsSection) {
    reviewsSection.classList.remove('hidden');
  }
  if (reviewsSummary) {
    reviewsSummary.textContent = 'Ładowanie recenzji...';
  }
  if (reviewFeedback) {
    reviewFeedback.textContent = '';
  }

  try {
    const summary = await apiRequest(`/api/reviews/${audioId}`);
    if (audioId !== currentTrackId) {
      return;
    }
    const normalizedSummary = summary || {
      audioId,
      averageRating: null,
      totalReviews: 0,
      reviews: []
    };
    renderReviews(normalizedSummary);
  } catch (error) {
    console.warn('Nie udało się pobrać recenzji:', error.message);
    if (audioId !== currentTrackId) {
      return;
    }
    if (reviewFeedback) {
      reviewFeedback.textContent = `Nie udało się pobrać recenzji: ${error.message}`;
    }
    renderReviews({ audioId, averageRating: null, totalReviews: 0, reviews: [] });
  }
}

function resetRecommendations() {
  recommendationsData = [];
  if (recommendationsRefreshTimeout) {
    clearTimeout(recommendationsRefreshTimeout);
    recommendationsRefreshTimeout = null;
  }
  if (!recommendationsSection) {
    return;
  }
  recommendationsSection.classList.add('hidden');
  if (recommendationsList) {
    recommendationsList.innerHTML = '';
    recommendationsList.classList.remove('hidden');
  }
  if (recommendationsEmpty) {
    recommendationsEmpty.textContent = defaultRecommendationsEmptyText;
    recommendationsEmpty.classList.add('hidden');
  }
}

function renderRecommendations(list) {
  if (!recommendationsSection || !recommendationsList || !recommendationsEmpty) {
    return;
  }

  recommendationsData = Array.isArray(list) ? list : [];
  recommendationsSection.classList.remove('hidden');
  recommendationsList.innerHTML = '';

  if (!recommendationsData.length) {
    recommendationsList.classList.add('hidden');
    recommendationsEmpty.textContent = defaultRecommendationsEmptyText;
    recommendationsEmpty.classList.remove('hidden');
    return;
  }

  recommendationsList.classList.remove('hidden');
  recommendationsEmpty.classList.add('hidden');

  recommendationsData.forEach((item) => {
    if (!item || !item.audioId) {
      return;
    }

    const card = document.createElement('article');
    card.className = 'recommendation-card';

    const header = document.createElement('div');
    header.className = 'recommendation-header';

    const title = document.createElement('h4');
    title.textContent = item.title || 'Audiobook';
    header.appendChild(title);

    if (Number.isFinite(item.averageRating) && item.totalReviews) {
      const rating = document.createElement('span');
      rating.className = 'recommendation-rating';
      const formatted = formatRating(item.averageRating) || item.averageRating;
      const countLabel = item.totalReviews === 1
        ? '1 ocena'
        : item.totalReviews >= 2 && item.totalReviews <= 4
        ? `${item.totalReviews} oceny`
        : `${item.totalReviews} ocen`;
      rating.textContent = `${formatted} / 5 · ${countLabel}`;
      header.appendChild(rating);
    }

    card.appendChild(header);

    const meta = document.createElement('p');
    meta.className = 'recommendation-meta';
    const authorName = resolveAuthorName(item.author);
    const categoryName = item.categoryName || 'Bez kategorii';
    meta.textContent = `${authorName} · ${categoryName}`;
    card.appendChild(meta);

    const tagsContainer = document.createElement('ul');
    tagsContainer.className = 'tag-list recommendation-tags';
    renderTagList(tagsContainer, item.tags);
    if (!tagsContainer.classList.contains('hidden')) {
      card.appendChild(tagsContainer);
    }

    if (item.reason) {
      const reason = document.createElement('p');
      reason.className = 'recommendation-reason';
      reason.textContent = item.reason;
      card.appendChild(reason);
    }

    const actions = document.createElement('div');
    actions.className = 'recommendation-actions';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'secondary';
    playBtn.textContent = 'Odtwórz';
    playBtn.addEventListener('click', (event) => {
      event.preventDefault();
      const match = libraryItems.find((entry) => entry.id === item.audioId);
      if (match) {
        loadTrack(match, { autoplay: true, resumeFromProgress: true });
      }
    });

    actions.appendChild(playBtn);
    card.appendChild(actions);

    recommendationsList.appendChild(card);
  });
}

function renderRecommendationsMessage(message) {
  if (!recommendationsSection || !recommendationsEmpty || !recommendationsList) {
    return;
  }
  recommendationsSection.classList.remove('hidden');
  recommendationsList.innerHTML = '';
  recommendationsList.classList.add('hidden');
  recommendationsEmpty.textContent = message;
  recommendationsEmpty.classList.remove('hidden');
}

async function fetchRecommendations() {
  if (!currentUser || !recommendationsSection) {
    return;
  }

  try {
    const response = await apiRequest('/api/recommendations');
    renderRecommendations(Array.isArray(response) ? response : []);
  } catch (error) {
    console.warn('Nie udało się pobrać rekomendacji:', error.message);
    renderRecommendationsMessage(
      `Nie udało się pobrać rekomendacji: ${error.message}`
    );
  }
}

function scheduleRecommendationsRefresh(delay = 4000) {
  if (!currentUser) {
    return;
  }
  if (recommendationsRefreshTimeout) {
    clearTimeout(recommendationsRefreshTimeout);
  }
  recommendationsRefreshTimeout = setTimeout(() => {
    recommendationsRefreshTimeout = null;
    fetchRecommendations();
  }, Math.max(delay, 500));
}

async function loadTrack(item, options = {}) {
  if (!currentUser) return;

  const {
    chapterId: requestedChapterId = null,
    autoplay = true,
    resumeFromProgress = true
  } = options;

  closeSpeedModal();
  resetReviews();

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

  setCoverImage(playerCover, playerCoverImage, item.imageUrl, {
    altText: item.title ? `Okładka audiobooka ${item.title}` : 'Okładka audiobooka',
    fallbackAlt: 'Brak okładki'
  });

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
  loadReviewsForTrack(item.id);

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

function formatDurationDetailed(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
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

if (adminToggleBtn) {
  adminToggleBtn.addEventListener('click', () => {
    if (!currentUser || currentUser.role !== 'admin') {
      return;
    }
    const nextMode = adminViewMode === 'admin' ? 'library' : 'admin';
    updateAdminView(nextMode);
    if (nextMode === 'admin') {
      fetchAdminStats();
    }
  });
}

if (uploadForm) {
  uploadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    const submittedCategory = formData.get('categoryId');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/library');
    xhr.responseType = 'json';

    setFormDisabled(uploadForm, true);
    showUploadProgress('Przygotowywanie przesyłania...', 0);

    xhr.upload.addEventListener('progress', (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        showUploadProgress('Przesyłanie plików...', null);
        return;
      }
      const percent = (progressEvent.loaded / progressEvent.total) * 100;
      showUploadProgress(`Przesyłanie plików... ${Math.round(percent)}%`, percent);
    });

    xhr.addEventListener('load', async () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          showUploadProgress('Przesyłanie zakończone. Aktualizacja biblioteki...', 100);
          uploadForm.reset();
          if (categorySelect) {
            categorySelect.dataset.initialized = 'true';
            const trimmedCategory =
              typeof submittedCategory === 'string'
                ? submittedCategory.trim()
                : '';
            if (trimmedCategory) {
              categorySelect.value = trimmedCategory;
              currentCategoryId = trimmedCategory;
            } else {
              categorySelect.value = '';
              currentCategoryId = UNCATEGORIZED_ID;
            }
          }
          await fetchLibrary();
          setTimeout(() => {
            if (adminViewMode === 'admin') {
              resetUploadProgress();
            }
          }, 2000);
        } else {
          const response = xhr.response;
          const message =
            (response && response.message) ||
            xhr.statusText ||
            'Nie udało się przesłać audiobooka.';
          showUploadProgress(`Nie udało się przesłać audiobooka: ${message}`, 0);
          alert(`Nie udało się przesłać audiobooka: ${message}`);
        }
      } catch (error) {
        showUploadProgress(`Nie udało się przesłać audiobooka: ${error.message}`, 0);
        alert(`Nie udało się przesłać audiobooka: ${error.message}`);
      } finally {
        setFormDisabled(uploadForm, false);
      }
    });

    xhr.addEventListener('error', () => {
      showUploadProgress('Wystąpił błąd sieci podczas przesyłania.', 0);
      alert('Nie udało się przesłać audiobooka: błąd sieci.');
      setFormDisabled(uploadForm, false);
    });

    xhr.addEventListener('abort', () => {
      showUploadProgress('Przesyłanie zostało przerwane.', 0);
      setFormDisabled(uploadForm, false);
    });

    xhr.send(formData);
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

if (librarySearchInput) {
  let searchDebounce = null;
  librarySearchInput.addEventListener('input', () => {
    filtersState.query = librarySearchInput.value.trim();
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    searchDebounce = setTimeout(() => {
      renderLibrary();
    }, 200);
  });
}

if (filterAuthorSelect) {
  filterAuthorSelect.addEventListener('change', () => {
    filtersState.author = filterAuthorSelect.value;
    renderLibrary();
  });
}

if (filterCategorySelect) {
  filterCategorySelect.addEventListener('change', () => {
    filtersState.category = filterCategorySelect.value;
    currentCategoryId = null;
    renderLibrary();
  });
}

if (filterTagSelect) {
  filterTagSelect.addEventListener('change', () => {
    filtersState.tag = filterTagSelect.value;
    renderLibrary();
  });
}

if (filtersClearBtn) {
  filtersClearBtn.addEventListener('click', () => {
    currentCategoryId = null;
    resetFilters();
  });
}

if (reviewForm) {
  reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser || !currentTrackId) {
      if (reviewFeedback) {
        reviewFeedback.textContent = 'Wybierz audiobook, aby dodać recenzję.';
      }
      return;
    }

    const ratingValue = Number(reviewRating ? reviewRating.value : 0);
    if (!Number.isFinite(ratingValue) || ratingValue < 1) {
      if (reviewFeedback) {
        reviewFeedback.textContent = 'Wybierz ocenę w skali 1-5.';
      }
      return;
    }

    const comment = reviewComment ? reviewComment.value.trim() : '';

    try {
      setFormDisabled(reviewForm, true);
      if (reviewFeedback) {
        reviewFeedback.textContent = 'Zapisywanie recenzji...';
      }
      const summary = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId: currentTrackId,
          rating: ratingValue,
          comment
        })
      });
      renderReviews(summary || {
        audioId: currentTrackId,
        averageRating: null,
        totalReviews: 0,
        reviews: []
      });
      if (reviewFeedback) {
        reviewFeedback.textContent = 'Recenzja została zapisana.';
      }
      scheduleRecommendationsRefresh(1500);
    } catch (error) {
      if (reviewFeedback) {
        reviewFeedback.textContent = `Nie udało się zapisać recenzji: ${error.message}`;
      }
    } finally {
      setFormDisabled(reviewForm, false);
    }
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
    scheduleRecommendationsRefresh(8000);
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
    scheduleRecommendationsRefresh(4000);
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
  scheduleRecommendationsRefresh(2000);
});

audioElement.volume = Number(volumeSlider.value);
setPlaybackSpeed(currentSpeed, { persist: false });

fetchSession();
