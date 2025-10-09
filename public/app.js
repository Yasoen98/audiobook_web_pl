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
const speedOptions = Array.from(
  document.querySelectorAll("input[name='speed-option']")
);
const volumeSlider = document.getElementById('volume-slider');
const audioElement = document.getElementById('player-audio');

let currentUser = null;
let libraryItems = [];
let categories = [];
let currentCategoryId = null;
let currentTrackId = null;
let pendingResumeTime = null;
let currentSpeed = 1;
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

function resolveAuthorName(author) {
  if (typeof author !== 'string') {
    return 'Nieznany autor';
  }
  const trimmed = author.trim();
  return trimmed || 'Nieznany autor';
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
