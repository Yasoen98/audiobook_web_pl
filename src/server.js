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
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const USERS = {
  admin: { password: 'admin123', role: 'admin' },
  user: { password: 'user123', role: 'user' }
};

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
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
    } else if (file.fieldname === 'audioFile') {
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
  const user = USERS[username];

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
  const items = (loadJson(LIBRARY_FILE) || []).map((item) => ({
    ...item,
    categoryId: item.categoryId || null
  }));
  res.json(items);
});

app.post('/api/library', requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'pdfFile', maxCount: 1 },
  { name: 'audioFile', maxCount: 1 }
]), (req, res) => {
  const { title, description, author } = req.body;
  let { categoryId } = req.body;
  const files = req.files || {};

  if (!title || !description || !author) {
    return res.status(400).json({ message: 'Tytuł, autor i opis są wymagane.' });
  }

  if (!files.pdfFile || !files.audioFile) {
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
    audioUrl: `/uploads/audio/${files.audioFile[0].filename}`
  };

  library.push(newItem);
  saveJson(LIBRARY_FILE, library);

  res.status(201).json(newItem);
});

app.delete('/api/library/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const library = loadJson(LIBRARY_FILE) || [];
  const index = library.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Nie znaleziono audiobooka.' });
  }

  const [removedItem] = library.splice(index, 1);
  saveJson(LIBRARY_FILE, library);

  ['imageUrl', 'pdfUrl', 'audioUrl'].forEach((key) => removeFileByUrl(removedItem[key]));

  const progress = loadJson(PROGRESS_FILE) || {};
  let progressUpdated = false;

  Object.keys(progress).forEach((username) => {
    if (progress[username] && Object.prototype.hasOwnProperty.call(progress[username], id)) {
      delete progress[username][id];
      progressUpdated = true;
    }
  });

  if (progressUpdated) {
    saveJson(PROGRESS_FILE, progress);
  }

  res.json({ message: 'Audiobook został usunięty.' });
});

app.get('/api/progress/:audioId', requireAuth, (req, res) => {
  const { audioId } = req.params;
  const progress = loadJson(PROGRESS_FILE) || {};
  const userProgress = progress[req.session.user.username] || {};
  const time = userProgress[audioId] || 0;
  res.json({ time });
});

app.post('/api/progress', requireAuth, (req, res) => {
  const { audioId, time } = req.body;

  if (!audioId || typeof time !== 'number') {
    return res.status(400).json({ message: 'Niepoprawne dane postępu.' });
  }

  const progress = loadJson(PROGRESS_FILE) || {};
  if (!progress[req.session.user.username]) {
    progress[req.session.user.username] = {};
  }
  progress[req.session.user.username][audioId] = time;
  saveJson(PROGRESS_FILE, progress);
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
