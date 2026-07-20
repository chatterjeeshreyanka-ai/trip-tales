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
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'chatterjeeshreyanka@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

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
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'audio/webm'),
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

function isAdmin(userId) {
  if (!userId) return false;
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  return !!user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.session.userId)) return res.status(403).json({ error: 'Admin access required.' });
  next();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// req.ip depends on Express's trust-proxy hop count matching the host's
// actual proxy chain exactly, which varies by platform. Read the original
// client IP directly off X-Forwarded-For (the leftmost entry, set by the
// first proxy in the chain) instead of relying on that hop count.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress;
}

// In-memory per-IP rate limiter for auth endpoints, to slow down brute-force
// and mass account creation without adding an external dependency.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.start > windowMs) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = clientIp(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }
    next();
  };
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again in 15 minutes.' });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, message: 'Too many signup attempts. Please try again later.' });
const forgotLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many requests. Please try again later.' });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many attempts. Please try again later.' });

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

// ---- Journal ----
app.get('/api/journal', (req, res) => {
  const viewerUserId = req.session.userId || null;
  const viewerIsAdmin = isAdmin(viewerUserId);
  const rows = db.prepare('SELECT * FROM journal_entries ORDER BY id DESC').all();
  res.json({
    entries: rows.map(r => ({
      id: r.id,
      authorName: r.author_name,
      destination: r.destination,
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
      mine: r.user_id === viewerUserId || viewerIsAdmin,
    })),
  });
});

app.post('/api/journal', requireAuth, (req, res) => {
  const destination = (req.body.destination || '').trim();
  const body = (req.body.body || '').trim();
  const title = (req.body.title || '').trim();
  if (!destination) return res.status(400).json({ error: 'Destination is required.' });
  if (!body) return res.status(400).json({ error: 'Please write something for your journal entry.' });

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
  const info = db.prepare(`
    INSERT INTO journal_entries (user_id, author_name, destination, title, body)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.userId, user.name, destination, title || null, body);

  res.json({
    entry: {
      id: info.lastInsertRowid,
      authorName: user.name,
      destination,
      title: title || null,
      body,
      createdAt: new Date().toISOString(),
      mine: true,
    },
  });
});

app.delete('/api/journal/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Entry not found.' });
  if (row.user_id !== req.session.userId && !isAdmin(req.session.userId)) {
    return res.status(403).json({ error: 'You can only delete your own journal entries.' });
  }

  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// ---- Gallery ----
function mapGalleryItem(r, viewerUserId, viewerIsAdmin) {
  const owned = r.user_id != null && r.user_id === viewerUserId;
  return {
    id: r.id,
    place: r.place,
    caption: r.caption,
    emoji: r.emoji,
    gradient: r.gradient,
    large: !!r.large,
    imageUrl: r.image_filename ? `/uploads/${r.image_filename}` : null,
    uploaderName: r.uploader_name,
    mine: owned || (viewerIsAdmin && !!r.image_filename),
  };
}

app.get('/api/gallery', (req, res) => {
  const viewerUserId = req.session.userId || null;
  const viewerIsAdmin = isAdmin(viewerUserId);
  const rows = db.prepare('SELECT * FROM gallery_items ORDER BY id ASC').all();
  res.json({ items: rows.map(r => mapGalleryItem(r, viewerUserId, viewerIsAdmin)) });
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

  // Logged-in uploads are owned via user_id. Anonymous uploads get a random
  // delete token (only ever shown once, in this response) so the uploading
  // browser — and only it — can delete the photo later.
  const userId = req.session.userId || null;
  let deleteToken = null;
  let deleteTokenHash = null;
  if (!userId) {
    deleteToken = crypto.randomBytes(24).toString('hex');
    deleteTokenHash = crypto.createHash('sha256').update(deleteToken).digest('hex');
  }

  const info = db.prepare(`
    INSERT INTO gallery_items (place, caption, emoji, gradient, large, image_filename, uploader_name, user_id, delete_token_hash)
    VALUES (?, ?, '', '', 0, ?, ?, ?, ?)
  `).run(place, caption, req.file.filename, uploaderName, userId, deleteTokenHash);

  res.json({
    item: {
      id: info.lastInsertRowid,
      place, caption, emoji: '', gradient: '', large: false,
      imageUrl: `/uploads/${req.file.filename}`,
      uploaderName,
      mine: !!userId,
      deleteToken,
    },
  });
});

app.put('/api/gallery/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Photo not found.' });
  if (!row.image_filename) return res.status(403).json({ error: 'This item cannot be edited.' });

  if (!isAdmin(req.session.userId)) {
    if (row.user_id != null) {
      if (req.session.userId !== row.user_id) {
        return res.status(403).json({ error: 'You can only edit your own photos.' });
      }
    } else {
      const token = (req.body && req.body.deleteToken) || '';
      const tokenHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
      if (!token || tokenHash !== row.delete_token_hash) {
        return res.status(403).json({ error: 'You can only edit photos you uploaded.' });
      }
    }
  }

  let caption = ((req.body && req.body.caption) || '').trim();
  if (!caption) caption = 'Untitled';

  db.prepare('UPDATE gallery_items SET caption = ? WHERE id = ?').run(caption, row.id);
  res.json({ ok: true, caption });
});

app.delete('/api/gallery/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Photo not found.' });
  if (!row.image_filename) return res.status(403).json({ error: 'This item cannot be deleted.' });

  if (!isAdmin(req.session.userId)) {
    if (row.user_id != null) {
      if (req.session.userId !== row.user_id) {
        return res.status(403).json({ error: 'You can only delete your own photos.' });
      }
    } else {
      const token = (req.body && req.body.deleteToken) || '';
      const tokenHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
      if (!token || tokenHash !== row.delete_token_hash) {
        return res.status(403).json({ error: 'You can only delete photos you uploaded.' });
      }
    }
  }

  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(row.id);
  fs.unlink(path.join(UPLOAD_DIR, row.image_filename), () => {});

  res.json({ ok: true });
});

// ---- Voice entries ----
app.get('/api/voice-entries', (req, res) => {
  const viewerUserId = req.session.userId || null;
  const viewerIsAdmin = isAdmin(viewerUserId);
  const rows = db.prepare('SELECT * FROM voice_entries ORDER BY id DESC LIMIT 100').all();
  res.json({
    entries: rows.map(r => ({
      id: r.id,
      name: r.name,
      destination: r.destination,
      audioUrl: `/uploads/${r.filename}`,
      createdAt: r.created_at,
      mine: (r.user_id != null && r.user_id === viewerUserId) || viewerIsAdmin,
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

  const userId = req.session.userId || null;
  const info = db.prepare('INSERT INTO voice_entries (name, destination, filename, user_id) VALUES (?, ?, ?, ?)')
    .run(name, destination, req.file.filename, userId);

  res.json({
    entry: {
      id: info.lastInsertRowid,
      name,
      destination,
      audioUrl: `/uploads/${req.file.filename}`,
      createdAt: new Date().toISOString(),
      mine: !!userId,
    },
  });
});

app.delete('/api/voice-entries/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM voice_entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Entry not found.' });
  if (row.user_id !== req.session.userId && !isAdmin(req.session.userId)) {
    return res.status(403).json({ error: 'You can only delete your own voice entries.' });
  }

  db.prepare('DELETE FROM voice_entries WHERE id = ?').run(row.id);
  fs.unlink(path.join(UPLOAD_DIR, row.filename), () => {});
  res.json({ ok: true });
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
app.post('/api/auth/signup', signupLimiter, (req, res) => {
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

app.post('/api/auth/login', loginLimiter, (req, res) => {
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

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

app.post('/api/auth/forgot', forgotLimiter, async (req, res) => {
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

app.post('/api/auth/reset-password', resetLimiter, (req, res) => {
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

// ---- Admin: user management ----
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, created_at FROM users ORDER BY id ASC').all();
  res.json({ users: rows });
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account from here.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const photos = db.prepare('SELECT image_filename FROM gallery_items WHERE user_id = ? AND image_filename IS NOT NULL').all(targetId);

  db.transaction(() => {
    db.prepare('DELETE FROM journal_entries WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM chat_messages WHERE sender_id = ? OR recipient_id = ?').run(targetId, targetId);
    db.prepare('DELETE FROM favourites WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM gallery_items WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  })();

  for (const photo of photos) {
    fs.unlink(path.join(UPLOAD_DIR, photo.image_filename), () => {});
  }

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

// ---- Chat ----
function mapChatMessage(row, viewerUserId) {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
    mine: row.sender_id === viewerUserId,
  };
}

app.get('/api/chat/users', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name FROM users WHERE id != ? ORDER BY name ASC').all(req.session.userId);
  res.json({ users: rows });
});

app.get('/api/chat/public', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT cm.*, u.name AS sender_name FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.recipient_id IS NULL
    ORDER BY cm.id DESC LIMIT 200
  `).all();
  res.json({ messages: rows.reverse().map(r => mapChatMessage(r, req.session.userId)) });
});

app.post('/api/chat/public', requireAuth, (req, res) => {
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });

  const info = db.prepare('INSERT INTO chat_messages (sender_id, recipient_id, body) VALUES (?, NULL, ?)')
    .run(req.session.userId, body);
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);

  res.json({
    message: { id: info.lastInsertRowid, senderId: req.session.userId, senderName: user.name, body, createdAt: new Date().toISOString(), mine: true },
  });
});

app.get('/api/chat/private/:userId', requireAuth, (req, res) => {
  const otherId = Number(req.params.userId);
  const other = db.prepare('SELECT id, name FROM users WHERE id = ?').get(otherId);
  if (!other) return res.status(404).json({ error: 'User not found.' });

  const rows = db.prepare(`
    SELECT cm.*, u.name AS sender_name FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE (cm.sender_id = ? AND cm.recipient_id = ?) OR (cm.sender_id = ? AND cm.recipient_id = ?)
    ORDER BY cm.id ASC LIMIT 500
  `).all(req.session.userId, otherId, otherId, req.session.userId);

  res.json({ otherUser: other, messages: rows.map(r => mapChatMessage(r, req.session.userId)) });
});

app.post('/api/chat/private/:userId', requireAuth, (req, res) => {
  const otherId = Number(req.params.userId);
  if (otherId === req.session.userId) return res.status(400).json({ error: 'You cannot message yourself.' });
  const other = db.prepare('SELECT id, name FROM users WHERE id = ?').get(otherId);
  if (!other) return res.status(404).json({ error: 'User not found.' });

  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });

  const info = db.prepare('INSERT INTO chat_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)')
    .run(req.session.userId, otherId, body);
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);

  res.json({
    message: { id: info.lastInsertRowid, senderId: req.session.userId, senderName: user.name, body, createdAt: new Date().toISOString(), mine: true },
  });
});

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Trip Tales server running at http://localhost:${PORT}`);
});
