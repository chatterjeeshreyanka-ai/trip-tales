const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

const IMAGE_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${IMAGE_EXTENSIONS[file.mimetype] || ''}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, Object.prototype.hasOwnProperty.call(IMAGE_EXTENSIONS, file.mimetype)),
});

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendPasswordResetEmail(toEmail, name, resetUrl) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — cannot send password reset email.');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Trip Tales <onboarding@resend.dev>',
      to: [toEmail],
      subject: 'Reset your Trip Tales password',
      html: `<p>Hi ${escapeHtml(name)},</p>
        <p>Someone requested a password reset for your Trip Tales account. Click the link below to choose a new password — it expires in 1 hour.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
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
function mapGalleryItem(r) {
  return {
    id: r.id,
    place: r.place,
    caption: r.caption,
    emoji: r.emoji,
    gradient: r.gradient,
    large: !!r.large,
    imageUrl: r.image_filename ? `/uploads/${r.image_filename}` : null,
    uploaderName: r.uploader_name,
  };
}

app.get('/api/gallery', (req, res) => {
  const rows = db.prepare('SELECT * FROM gallery_items ORDER BY id ASC').all();
  res.json({ items: rows.map(mapGalleryItem) });
});

app.post('/api/gallery', imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A JPEG, PNG, WEBP or GIF image is required.' });
  const place = (req.body.place || '').trim().toLowerCase();
  if (!place) return res.status(400).json({ error: 'Destination is required.' });

  let caption = (req.body.caption || '').trim();
  if (!caption) caption = 'Untitled';

  let uploaderName = (req.body.name || '').trim();
  if (!uploaderName && req.session.userId) {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    if (user) uploaderName = user.name;
  }
  if (!uploaderName) uploaderName = 'Anonymous';

  const info = db.prepare(`
    INSERT INTO gallery_items (place, caption, emoji, gradient, large, image_filename, uploader_name)
    VALUES (?, ?, '', '', 0, ?, ?)
  `).run(place, caption, req.file.filename, uploaderName);

  res.json({
    item: {
      id: info.lastInsertRowid,
      place, caption, emoji: '', gradient: '', large: false,
      imageUrl: `/uploads/${req.file.filename}`,
      uploaderName,
    },
  });
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

app.post('/api/auth/forgot', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const genericResponse = { message: "If that email is registered, we've sent a reset link." };
  if (!email) return res.json(genericResponse);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, tokenHash, expiresAt);

    const resetUrl = `${FRONTEND_ORIGIN}/reset-password.html?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (err) {
      console.error('Failed to send password reset email:', err.message);
    }
  }

  // Always the same response, whether or not the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  res.json(genericResponse);
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(tokenHash);
  if (!record || new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, record.user_id);
  db.prepare('DELETE FROM password_resets WHERE id = ?').run(record.id);

  res.json({ ok: true });
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
