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
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
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

function ensureReviewsFile() {
  if (!fs.existsSync(REVIEWS_FILE)) {
    saveJson(REVIEWS_FILE, {});
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

function loadReviews() {
  const data = loadJson(REVIEWS_FILE) || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data;
}

function saveReviews(reviews) {
  saveJson(REVIEWS_FILE, reviews);
}

function clampRating(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const clamped = Math.min(5, Math.max(1, value));
  return Math.round(clamped * 2) / 2;
}

function normalizeTagsInput(input) {
  if (Array.isArray(input)) {
    return normalizeTagsInput(input.join(','));
  }
  if (typeof input !== 'string') {
    return [];
  }
  const values = input
    .split(/[,;\n]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const seen = new Set();
  const tags = [];
  values.forEach((tag) => {
    const key = tag.toLocaleLowerCase('pl');
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  });

  return tags;
}

function normalizeAuthorValue(author) {
  if (typeof author !== 'string') {
    return 'Nieznany autor';
  }
  const trimmed = author.trim();
  return trimmed || 'Nieznany autor';
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

  if (Array.isArray(normalized.tags)) {
    normalized.tags = normalizeTagsInput(normalized.tags.join(','));
  } else if (typeof normalized.tags === 'string') {
    normalized.tags = normalizeTagsInput(normalized.tags);
  } else {
    normalized.tags = [];
  }

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

function normalizeReviewEntries(list) {
  if (!Array.isArray(list)) {
    return { reviews: [], changed: !!list };
  }

  let changed = false;
  const reviews = [];

  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      changed = true;
      return;
    }

    const rating = clampRating(Number(entry.rating));
    if (rating === null) {
      changed = true;
      return;
    }

    const username =
      typeof entry.username === 'string' && entry.username.trim()
        ? entry.username.trim()
        : 'Anonim';
    const comment =
      typeof entry.comment === 'string' && entry.comment.trim()
        ? entry.comment.trim().slice(0, 2000)
        : '';
    const createdAt =
      typeof entry.createdAt === 'string' && entry.createdAt.trim()
        ? entry.createdAt
        : new Date().toISOString();
    const updatedAt =
      typeof entry.updatedAt === 'string' && entry.updatedAt.trim()
        ? entry.updatedAt
        : createdAt;

    if (
      rating !== entry.rating ||
      username !== entry.username ||
      comment !== entry.comment ||
      createdAt !== entry.createdAt ||
      updatedAt !== entry.updatedAt
    ) {
      changed = true;
    }

    reviews.push({ username, rating, comment, createdAt, updatedAt });
  });

  return { reviews, changed };
}

function buildReviewSummary(audioId, reviewsData) {
  if (!audioId) {
    return { audioId: null, averageRating: null, totalReviews: 0, reviews: [] };
  }

  const entry = normalizeReviewEntries(reviewsData[audioId]);

  if (entry.changed) {
    reviewsData[audioId] = entry.reviews;
    saveReviews(reviewsData);
  }

  const totalReviews = entry.reviews.length;
  const sum = entry.reviews.reduce((acc, review) => acc + review.rating, 0);
  const averageRating =
    totalReviews > 0 ? Number((sum / totalReviews).toFixed(2)) : null;

  return {
    audioId,
    averageRating,
    totalReviews,
    reviews: entry.reviews
  };
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
ensureReviewsFile();

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
  const { username, password } = req.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedPassword = typeof password === 'string' ? password.trim() : '';

  if (!normalizedUsername || !normalizedPassword) {
    return res
      .status(400)
      .json({ message: 'Login i hasło są wymagane, aby się zalogować.' });
  }

  const users = loadUsers();
  const user = users[normalizedUsername];

  if (!user || user.password !== normalizedPassword) {
    return res.status(401).json({ message: 'Nieprawidłowe dane logowania.' });
  }

  req.session.user = { username: normalizedUsername, role: user.role };
  res.json({ username: normalizedUsername, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Wylogowano.' });
  });
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  const trimmedPassword = typeof password === 'string' ? password.trim() : '';
  const normalizedRole = role === 'admin' ? 'admin' : 'user';

  if (!trimmedUsername || !trimmedPassword) {
    return res.status(400).json({ message: 'Login i hasło są wymagane.' });
  }

  const users = loadUsers();
  if (users[trimmedUsername]) {
    return res.status(409).json({ message: 'Użytkownik o podanej nazwie już istnieje.' });
  }

  users[trimmedUsername] = { password: trimmedPassword, role: normalizedRole };
  saveUsers(users);

  res.status(201).json({ username: trimmedUsername, role: normalizedRole });
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
    const { title, description, author, tags: rawTags } = req.body;
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
    const tags = normalizeTagsInput(rawTags);

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
      tags,
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

app.post(
  '/api/library/:id/chapters',
  requireAdmin,
  upload.array('audioFiles', 150),
  (req, res) => {
    const { id } = req.params;
    const trimmedId = typeof id === 'string' ? id.trim() : '';
    const files = Array.isArray(req.files) ? req.files : [];

    if (!trimmedId) {
      return res.status(400).json({ message: 'Identyfikator audiobooka jest wymagany.' });
    }

    if (!files.length) {
      return res.status(400).json({ message: 'Dodaj przynajmniej jeden plik audio.' });
    }

    const library = loadJson(LIBRARY_FILE) || [];
    const index = library.findIndex((item) => item && item.id === trimmedId);

    if (index === -1) {
      return res.status(404).json({ message: 'Nie znaleziono audiobooka.' });
    }

    const libraryItem = library[index] || {};
    let chapters = Array.isArray(libraryItem.chapters)
      ? libraryItem.chapters.filter((chapter) => chapter && chapter.url)
      : [];

    if (!chapters.length && libraryItem.audioUrl) {
      chapters = [
        {
          id: `${trimmedId}-chapter-0`,
          name: libraryItem.title ? `${libraryItem.title} – Rozdział 1` : 'Rozdział 1',
          url: libraryItem.audioUrl
        }
      ];
      delete libraryItem.audioUrl;
    }

    const startingIndex = chapters.length;

    files.forEach((file, fileIndex) => {
      if (!file || !file.filename) {
        return;
      }
      const position = startingIndex + fileIndex;
      const baseName = file.originalname
        ? path.parse(file.originalname).name
        : null;
      const name = baseName && baseName.trim()
        ? baseName.trim()
        : `Rozdział ${position + 1}`;

      chapters.push({
        id: `${trimmedId}-chapter-${position}`,
        name,
        url: `/uploads/audio/${file.filename}`
      });
    });

    if (!chapters.length) {
      return res.status(400).json({ message: 'Nie udało się przetworzyć przesłanych plików audio.' });
    }

    library[index] = {
      ...libraryItem,
      chapters
    };

    saveJson(LIBRARY_FILE, library);

    res.status(201).json(normalizeLibraryItem(library[index]));
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

  const reviewsData = loadReviews();
  if (reviewsData && typeof reviewsData === 'object' && reviewsData[id]) {
    delete reviewsData[id];
    saveReviews(reviewsData);
  }

  res.json({ message: 'Audiobook został usunięty.' });
});

app.get('/api/reviews/:audioId', requireAuth, (req, res) => {
  const { audioId } = req.params;
  const trimmed = typeof audioId === 'string' ? audioId.trim() : '';

  if (!trimmed) {
    return res.status(400).json({ message: 'Identyfikator audiobooka jest wymagany.' });
  }

  const reviewsData = loadReviews();
  const summary = buildReviewSummary(trimmed, reviewsData);
  res.json(summary);
});

app.post('/api/reviews', requireAuth, (req, res) => {
  const { audioId, rating, comment } = req.body || {};
  const normalizedId = typeof audioId === 'string' ? audioId.trim() : '';

  if (!normalizedId) {
    return res.status(400).json({ message: 'Identyfikator audiobooka jest wymagany.' });
  }

  const numericRating = clampRating(Number(rating));
  if (numericRating === null) {
    return res.status(400).json({ message: 'Ocena musi być liczbą w zakresie 1-5.' });
  }

  const library = loadJson(LIBRARY_FILE) || [];
  const exists = library.some((item) => item && item.id === normalizedId);
  if (!exists) {
    return res.status(404).json({ message: 'Nie znaleziono wskazanego audiobooka.' });
  }

  const trimmedComment =
    typeof comment === 'string' && comment.trim()
      ? comment.trim().slice(0, 2000)
      : '';

  const username = req.session.user.username;
  const now = new Date().toISOString();
  const reviewsData = loadReviews();
  const list = Array.isArray(reviewsData[normalizedId])
    ? reviewsData[normalizedId]
    : [];

  const existingIndex = list.findIndex(
    (review) => review && review.username === username
  );

  if (existingIndex !== -1) {
    return res.status(409).json({ message: 'Recenzja dla tego audiobooka już istnieje.' });
  }

  list.push({
    username,
    rating: numericRating,
    comment: trimmedComment,
    createdAt: now,
    updatedAt: now
  });

  reviewsData[normalizedId] = list;
  saveReviews(reviewsData);

  const summary = buildReviewSummary(normalizedId, reviewsData);
  res.json(summary);
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
