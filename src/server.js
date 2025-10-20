const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, '..', 'data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = {
      admin: { password: 'admin123', role: 'admin' },
      user: { password: 'user123', role: 'user' }
    };
    saveJson(USERS_FILE, defaultUsers);
  }
}

function loadUsers() {
  const data = loadJson(USERS_FILE) || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data;
}

function saveUsers(users) {
  saveJson(USERS_FILE, users);
}

function createDefaultProgressState() {
  return {
    playbackSpeed: 1,
    lastBookId: null,
    items: {}
  };
}

function clampPlaybackSpeed(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(2, Math.max(0.5, value));
}

function normalizeProgressEntry(entry) {
  const normalized = createDefaultProgressState();

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return normalized;
  }

  if (typeof entry.playbackSpeed === 'number') {
    normalized.playbackSpeed = clampPlaybackSpeed(entry.playbackSpeed);
  }

  if (typeof entry.lastBookId === 'string' && entry.lastBookId.trim()) {
    normalized.lastBookId = entry.lastBookId;
  }

  if (entry.items && typeof entry.items === 'object' && !Array.isArray(entry.items)) {
    Object.keys(entry.items).forEach((itemId) => {
      const itemEntry = entry.items[itemId];
      if (!itemEntry || typeof itemEntry !== 'object') {
        return;
      }

      const chapters = itemEntry.chapters && typeof itemEntry.chapters === 'object' ? itemEntry.chapters : {};
      const safeChapters = {};
      Object.keys(chapters).forEach((chapterId) => {
        const timeValue = chapters[chapterId];
        if (typeof timeValue === 'number' && Number.isFinite(timeValue) && timeValue >= 0) {
          safeChapters[chapterId] = timeValue;
        }
      });

      normalized.items[itemId] = {
        lastChapterId:
          typeof itemEntry.lastChapterId === 'string' && itemEntry.lastChapterId.trim()
            ? itemEntry.lastChapterId
            : null,
        chapters: safeChapters
      };
    });
  } else {
    Object.keys(entry).forEach((key) => {
      const value = entry[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        normalized.items[key] = {
          lastChapterId: `${key}-chapter-0`,
          chapters: {
            [`${key}-chapter-0`]: value
          }
        };
      }
    });
  }

  return normalized;
}

function normalizeLibraryItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const normalized = { ...item };

  if (Array.isArray(normalized.chapters) && normalized.chapters.length > 0) {
    normalized.chapters = normalized.chapters.map((chapter, index) => ({
      id: chapter && chapter.id ? chapter.id : `${normalized.id || 'item'}-chapter-${index}`,
      name:
        chapter && typeof chapter.name === 'string' && chapter.name.trim()
          ? chapter.name
          : `Rozdział ${index + 1}`,
      url: chapter && chapter.url ? chapter.url : null
    }));
  } else if (normalized.audioUrl) {
    normalized.chapters = [
      {
        id: `${normalized.id}-chapter-0`,
        name: 'Rozdział 1',
        url: normalized.audioUrl
      }
    ];
  } else {
    normalized.chapters = [];
  }

  return normalized;
}

function buildListeningStats() {
  const users = loadUsers();
  const progress = loadJson(PROGRESS_FILE) || {};
  const libraryItems = (loadJson(LIBRARY_FILE) || []).map(normalizeLibraryItem);
  const libraryMap = new Map(libraryItems.map((item) => [item.id, item]));

  const stats = Object.keys(users).map((username) => {
    const entry = normalizeProgressEntry(progress[username]);
    const items = [];
    let totalSeconds = 0;

    const progressItems = entry.items && typeof entry.items === 'object' ? entry.items : {};

    Object.keys(progressItems).forEach((audioId) => {
      const itemProgress = progressItems[audioId];
      if (!itemProgress || typeof itemProgress !== 'object') {
        return;
      }

      const chapters =
        itemProgress.chapters && typeof itemProgress.chapters === 'object'
          ? itemProgress.chapters
          : {};

      let accumulated = 0;
      Object.keys(chapters).forEach((chapterId) => {
        const value = chapters[chapterId];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          accumulated += value;
        }
      });

      totalSeconds += accumulated;

      let lastChapterId =
        typeof itemProgress.lastChapterId === 'string' && itemProgress.lastChapterId.trim()
          ? itemProgress.lastChapterId
          : null;

      if (!lastChapterId) {
        const chapterIds = Object.keys(chapters);
        if (chapterIds.length) {
          lastChapterId = chapterIds[0];
        }
      }

      const libraryItem = libraryMap.get(audioId);
      let lastChapterName = null;
      if (libraryItem && Array.isArray(libraryItem.chapters)) {
        const foundChapter = libraryItem.chapters.find((chapter) => chapter.id === lastChapterId);
        if (foundChapter) {
          lastChapterName = foundChapter.name;
        }
      }

      const lastPositionSeconds =
        lastChapterId && typeof chapters[lastChapterId] === 'number'
          ? Math.max(0, chapters[lastChapterId])
          : 0;

      items.push({
        audioId,
        title: libraryItem ? libraryItem.title : 'Usunięty audiobook',
        author: libraryItem ? libraryItem.author : null,
        lastChapterId: lastChapterId || null,
        lastChapterName,
        lastPositionSeconds,
        totalSeconds: accumulated
      });
    });

    items.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));

    const currentItem =
      entry.lastBookId && items.find((item) => item.audioId === entry.lastBookId);

    return {
      username,
      role: users[username].role || 'user',
      totalSeconds,
      currentBookId: entry.lastBookId || null,
      current: currentItem || null,
      items
    };
  });

  stats.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0));
  return stats;
}

function loadJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Nie udało się odczytać pliku ${filePath}:`, error);
    return null;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function removeFileByUrl(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') {
    return;
  }

  const sanitized = urlPath.replace(/^\/+/, '');
  const absolutePath = path.normalize(path.join(__dirname, '..', sanitized));
  const uploadsRoot = path.normalize(path.join(__dirname, '..', 'uploads'));
  const relative = path.relative(uploadsRoot, absolutePath);

  if (relative.startsWith('..')) {
    return;
  }

  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.warn(`Nie udało się usunąć pliku ${absolutePath}:`, error.message);
  }
}

function ensureDirectories() {
  const dirs = [
    path.join(UPLOAD_DIR, 'images'),
    path.join(UPLOAD_DIR, 'pdfs'),
    path.join(UPLOAD_DIR, 'audio')
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

ensureDirectories();
ensureFile(LIBRARY_FILE, []);
ensureFile(PROGRESS_FILE, {});
ensureFile(CATEGORIES_FILE, []);
ensureUsersFile();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'audiobook-secret',
    resave: false,
    saveUninitialized: false
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'coverImage') {
      cb(null, path.join(UPLOAD_DIR, 'images'));
    } else if (file.fieldname === 'pdfFile') {
      cb(null, path.join(UPLOAD_DIR, 'pdfs'));
    } else if (file.fieldname === 'audioFiles') {
      cb(null, path.join(UPLOAD_DIR, 'audio'));
    } else {
      cb(null, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Nieautoryzowany dostęp.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ message: 'Wymagane uprawnienia administratora.' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Nieprawidłowe dane logowania.' });
  }

  req.session.user = { username, role: user.role };
  res.json({ username, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Wylogowano.' });
  });
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password } = req.body || {};
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  const trimmedPassword = typeof password === 'string' ? password.trim() : '';

  if (!trimmedUsername || !trimmedPassword) {
    return res.status(400).json({ message: 'Login i hasło są wymagane.' });
  }

  const users = loadUsers();
  if (users[trimmedUsername]) {
    return res.status(409).json({ message: 'Użytkownik o podanej nazwie już istnieje.' });
  }

  users[trimmedUsername] = { password: trimmedPassword, role: 'user' };
  saveUsers(users);

  res.status(201).json({ username: trimmedUsername, role: 'user' });
});

app.get('/api/session', (req, res) => {
  if (req.session.user) {
    return res.json(req.session.user);
  }
  res.status(204).send();
});

app.get('/api/categories', requireAuth, (req, res) => {
  const categories = loadJson(CATEGORIES_FILE) || [];
  res.json(categories);
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const { name } = req.body || {};
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (!trimmed) {
    return res.status(400).json({ message: 'Nazwa kategorii jest wymagana.' });
  }

  const categories = loadJson(CATEGORIES_FILE) || [];
  const exists = categories.some(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (exists) {
    return res
      .status(409)
      .json({ message: 'Kategoria o tej nazwie już istnieje.' });
  }

  const newCategory = {
    id: `category-${Date.now()}`,
    name: trimmed,
    type: 'custom'
  };

  categories.push(newCategory);
  saveJson(CATEGORIES_FILE, categories);

  res.status(201).json(newCategory);
});

app.delete('/api/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const categories = loadJson(CATEGORIES_FILE) || [];
  const index = categories.findIndex((category) => category.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Nie znaleziono kategorii.' });
  }

  categories.splice(index, 1);
  saveJson(CATEGORIES_FILE, categories);

  const library = loadJson(LIBRARY_FILE) || [];
  let libraryUpdated = false;
  const updatedLibrary = library.map((item) => {
    if (item.categoryId === id) {
      libraryUpdated = true;
      return { ...item, categoryId: null };
    }
    return item;
  });

  if (libraryUpdated) {
    saveJson(LIBRARY_FILE, updatedLibrary);
  }

  res.json({ message: 'Kategoria została usunięta.' });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = buildListeningStats();
  res.json(stats);
});

app.get('/api/library', requireAuth, (req, res) => {
  const items = (loadJson(LIBRARY_FILE) || []).map((item) => {
    const normalized = normalizeLibraryItem(item);
    return {
      ...normalized,
      categoryId: normalized.categoryId || null
    };
  });
  res.json(items);
});

app.post(
  '/api/library',
  requireAdmin,
  upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'pdfFile', maxCount: 1 },
    { name: 'audioFiles', maxCount: 150 }
  ]),
  (req, res) => {
    const { title, description, author } = req.body;
    let { categoryId } = req.body;
    const files = req.files || {};

    if (!title || !description || !author) {
      return res.status(400).json({ message: 'Tytuł, autor i opis są wymagane.' });
    }

    if (!files.pdfFile || !files.audioFiles || !files.audioFiles.length) {
      return res.status(400).json({ message: 'Pliki PDF i audio są wymagane.' });
    }

    const categories = loadJson(CATEGORIES_FILE) || [];
    if (categoryId) {
      categoryId = categoryId.trim();
      if (!categories.some((category) => category.id === categoryId)) {
        return res.status(400).json({ message: 'Wybrana kategoria nie istnieje.' });
      }
    } else {
      categoryId = null;
    }

    const library = loadJson(LIBRARY_FILE) || [];
    const id = `item-${Date.now()}`;

    const chapters = files.audioFiles
      .map((file, index) => ({
        id: `${id}-chapter-${index}`,
        name: file.originalname
          ? path.parse(file.originalname).name || `Rozdział ${index + 1}`
          : `Rozdział ${index + 1}`,
        url: `/uploads/audio/${file.filename}`
      }))
      .filter((chapter) => !!chapter.url);

    const newItem = {
      id,
      title: title.trim(),
      description: description.trim(),
      author: author.trim(),
      categoryId,
      imageUrl: files.coverImage
        ? `/uploads/images/${files.coverImage[0].filename}`
        : null,
      pdfUrl: `/uploads/pdfs/${files.pdfFile[0].filename}`,
      chapters
    };

    library.push(newItem);
    saveJson(LIBRARY_FILE, library);

    res.status(201).json(newItem);
  }
);

app.delete('/api/library/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const library = loadJson(LIBRARY_FILE) || [];
  const index = library.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Nie znaleziono audiobooka.' });
  }

  const [removedItem] = library.splice(index, 1);
  saveJson(LIBRARY_FILE, library);

  ['imageUrl', 'pdfUrl'].forEach((key) => removeFileByUrl(removedItem[key]));
  if (Array.isArray(removedItem.chapters)) {
    removedItem.chapters.forEach((chapter) => {
      if (chapter && chapter.url) {
        removeFileByUrl(chapter.url);
      }
    });
  } else if (removedItem.audioUrl) {
    removeFileByUrl(removedItem.audioUrl);
  }

  const progress = loadJson(PROGRESS_FILE) || {};
  let progressUpdated = false;

  Object.keys(progress).forEach((username) => {
    const entry = normalizeProgressEntry(progress[username]);
    if (entry.items && entry.items[id]) {
      delete entry.items[id];
      if (entry.lastBookId === id) {
        entry.lastBookId = null;
      }
      progress[username] = entry;
      progressUpdated = true;
    }
  });

  if (progressUpdated) {
    saveJson(PROGRESS_FILE, progress);
  }

  res.json({ message: 'Audiobook został usunięty.' });
});

app.get('/api/progress', requireAuth, (req, res) => {
  const username = req.session.user.username;
  const progress = loadJson(PROGRESS_FILE) || {};
  const entry = normalizeProgressEntry(progress[username]);
  progress[username] = entry;
  saveJson(PROGRESS_FILE, progress);
  res.json(entry);
});

app.get('/api/progress/:audioId', requireAuth, (req, res) => {
  const { audioId } = req.params;
  const username = req.session.user.username;
  const progress = loadJson(PROGRESS_FILE) || {};
  const entry = normalizeProgressEntry(progress[username]);
  const itemEntry = entry.items[audioId];
  const chapterId = itemEntry && itemEntry.lastChapterId;
  const time =
    chapterId && itemEntry.chapters && typeof itemEntry.chapters[chapterId] === 'number'
      ? itemEntry.chapters[chapterId]
      : 0;
  res.json({ time });
});

app.post('/api/progress', requireAuth, (req, res) => {
  const { audioId, chapterId, time, playbackSpeed, lastBookId, lastChapterId } = req.body || {};
  const username = req.session.user.username;
  const progress = loadJson(PROGRESS_FILE) || {};
  const entry = normalizeProgressEntry(progress[username]);

  let updated = false;

  if (typeof playbackSpeed === 'number' && Number.isFinite(playbackSpeed)) {
    const clamped = clampPlaybackSpeed(playbackSpeed);
    if (clamped !== entry.playbackSpeed) {
      entry.playbackSpeed = clamped;
      updated = true;
    }
  }

  if (typeof lastBookId === 'string' && lastBookId.trim()) {
    if (entry.lastBookId !== lastBookId) {
      entry.lastBookId = lastBookId;
      updated = true;
    }
  }

  if (typeof audioId === 'string' && audioId.trim()) {
    if (!entry.items[audioId]) {
      entry.items[audioId] = { lastChapterId: null, chapters: {} };
      updated = true;
    }

    if (
      typeof lastChapterId === 'string' &&
      lastChapterId.trim() &&
      entry.items[audioId].lastChapterId !== lastChapterId
    ) {
      entry.items[audioId].lastChapterId = lastChapterId;
      updated = true;
    }

    if (
      typeof chapterId === 'string' &&
      chapterId.trim() &&
      typeof time === 'number' &&
      Number.isFinite(time) &&
      time >= 0
    ) {
      if (!entry.items[audioId].chapters) {
        entry.items[audioId].chapters = {};
      }
      entry.items[audioId].chapters[chapterId] = time;
      entry.items[audioId].lastChapterId = chapterId;
      updated = true;
    }
  }

  progress[username] = entry;

  if (updated) {
    saveJson(PROGRESS_FILE, progress);
  }

  res.json({ message: 'Postęp zapisany.' });
});

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
