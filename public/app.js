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
    fetchLibrary();
  } else {
    currentUser = null;
    welcomeText.textContent = '';
    userInfo.classList.add('hidden');
    uploadSection.classList.add('hidden');
    librarySection.classList.add('hidden');
    loginSection.classList.remove('hidden');
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
    renderLibrary(items);
  } catch (error) {
    console.error(error);
    alert(`Nie udało się pobrać biblioteki: ${error.message}`);
  }
}

function renderLibrary(items) {
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
      fetchLibrary();
    } catch (error) {
      alert(`Nie udało się przesłać audiobooka: ${error.message}`);
    }
  });
}

fetchSession();
