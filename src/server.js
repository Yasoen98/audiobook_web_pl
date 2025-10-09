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

app.get('/api/library', requireAuth, (req, res) => {
  const items = loadJson(LIBRARY_FILE) || [];
  res.json(items);
});

app.post('/api/library', requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'pdfFile', maxCount: 1 },
  { name: 'audioFile', maxCount: 1 }
]), (req, res) => {
  const { title, description, author } = req.body;
  const files = req.files || {};

  if (!title || !description || !author) {
    return res.status(400).json({ message: 'Tytuł, autor i opis są wymagane.' });
  }

  if (!files.pdfFile || !files.audioFile) {
    return res.status(400).json({ message: 'Pliki PDF i audio są wymagane.' });
  const { title, description } = req.body;
  const files = req.files || {};

  if (!title || !description) {
    return res.status(400).json({ message: 'Tytuł i opis są wymagane.' });
  }

  if (!files.coverImage || !files.pdfFile || !files.audioFile) {
    return res.status(400).json({ message: 'Wszystkie pliki (obraz, PDF, audio) są wymagane.' });
  }

  const library = loadJson(LIBRARY_FILE) || [];
  const id = `item-${Date.now()}`;

  const newItem = {
    id,
    title: title.trim(),
    description: description.trim(),
    author: author.trim(),
    imageUrl: files.coverImage ? `/uploads/images/${files.coverImage[0].filename}` : null,
    title,
    description,
    imageUrl: `/uploads/images/${files.coverImage[0].filename}`,
    pdfUrl: `/uploads/pdfs/${files.pdfFile[0].filename}`,
    audioUrl: `/uploads/audio/${files.audioFile[0].filename}`
  };

  library.push(newItem);
  saveJson(LIBRARY_FILE, library);

  res.status(201).json(newItem);
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
