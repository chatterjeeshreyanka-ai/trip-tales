const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const db = require('./db');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://creative-palmier-f29a9c.netlify.app';

const app = express();
app.set('trust proxy', 1);

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'trip-tales-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
  },
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}.webm`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

function mapDestination(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    bg: row.bg,
    cardDesc: row.card_desc,
    fullDesc: row.full_desc,
    bestTime: row.best_time,
    type: row.type,
    idealStay: row.ideal_stay,
    tags: JSON.parse(row.tags),
  };
}

// ---- Destinations ----
app.get('/api/destinations', (req, res) => {
  const rows = db.prepare('SELECT * FROM destinations').all();
  res.json({ destinations: rows.map(mapDestination) });
});

app.get('/api/destinations/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Destination not found.' });
  res.json({ destination: mapDestination(row) });
});

// ---- Stories ----
app.get('/api/stories', (req, res) => {
  const rows = db.prepare('SELECT * FROM stories ORDER BY id ASC').all();
  res.json({ stories: rows });
});

// ---- Gallery ----
app.get('/api/gallery', (req, res) => {
  const rows = db.prepare('SELECT * FROM gallery_items ORDER BY id ASC').all();
  res.json({ items: rows.map(r => ({ ...r, large: !!r.large })) });
});

// ---- Voice entries ----
app.get('/api/voice-entries', (req, res) => {
  const rows = db.prepare('SELECT id, name, destination, filename, created_at FROM voice_entries ORDER BY id DESC LIMIT 100').all();
  res.json({
    entries: rows.map(r => ({
      id: r.id,
      name: r.name,
      destination: r.destination,
      audioUrl: `/uploads/${r.filename}`,
      createdAt: r.created_at,
    })),
  });
});

app.post('/api/voice-entries', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Audio recording is required.' });
  const destination = (req.body.destination || '').trim();
  if (!destination) return res.status(400).json({ error: 'Destination is required.' });

  let name = (req.body.name || '').trim();
  if (!name && req.session.userId) {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    if (user) name = user.name;
  }
  if (!name) name = 'Anonymous';

  const info = db.prepare('INSERT INTO voice_entries (name, destination, filename) VALUES (?, ?, ?)')
    .run(name, destination, req.file.filename);

  res.json({
    entry: {
      id: info.lastInsertRowid,
      name,
      destination,
      audioUrl: `/uploads/${req.file.filename}`,
      createdAt: new Date().toISOString(),
    },
  });
});

// ---- Newsletter ----
app.post('/api/newsletter', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(email);
  if (existing) return res.json({ message: "You're already subscribed — thanks for sticking with us!" });

  db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email);
  res.json({ message: 'Thanks for subscribing! Adventure awaits. ✈️' });
});

// ---- Auth ----
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), normalizedEmail, hash);

  req.session.userId = info.lastInsertRowid;
  res.json({ user: publicUser({ id: info.lastInsertRowid, name: name.trim(), email: normalizedEmail }) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/forgot', (req, res) => {
  // No email service configured; respond the same way regardless of whether the
  // address is registered, so this endpoint can't be used to enumerate accounts.
  res.json({ message: "If that email is registered, we've sent a reset link." });
});

// ---- Favourites ----
app.get('/api/favourites', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT destination FROM favourites WHERE user_id = ?').all(req.session.userId);
  res.json({ favourites: rows.map(r => r.destination) });
});

app.post('/api/favourites/:destination', requireAuth, (req, res) => {
  const { destination } = req.params;
  const existing = db.prepare('SELECT id FROM favourites WHERE user_id = ? AND destination = ?')
    .get(req.session.userId, destination);

  if (existing) {
    db.prepare('DELETE FROM favourites WHERE id = ?').run(existing.id);
    return res.json({ favourited: false });
  }

  db.prepare('INSERT INTO favourites (user_id, destination) VALUES (?, ?)').run(req.session.userId, destination);
  res.json({ favourited: true });
});

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Trip Tales server running at http://localhost:${PORT}`);
});
