const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'lumadlc-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

function requireAuth(req, res, next) {
  if (!req.session.uid) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.uid) return res.status(401).json({ error: 'not_authenticated' });
  const user = db.prepare('SELECT is_admin FROM users WHERE uid = ?').get(req.session.uid);
  if (!user || !user.is_admin) return res.status(403).json({ error: 'not_admin' });
  next();
}

function publicUser(u) {
  return {
    uid: u.uid,
    username: u.username,
    email: u.email,
    hwid: u.hwid,
    subscription_until: u.subscription_until,
    is_admin: !!u.is_admin,
    created_at: u.created_at
  };
}

// ---------- AUTH ----------

app.post('/api/register', (req, res) => {
  const { username, email, password, invite_code } = req.body || {};
  if (!username || !email || !password || !invite_code) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (username.length < 3) return res.status(400).json({ error: 'username_too_short' });
  if (password.length < 6) return res.status(400).json({ error: 'password_too_short' });

  const code = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(invite_code.trim());
  if (!code) return res.status(400).json({ error: 'invalid_invite_code' });
  if (code.used) return res.status(400).json({ error: 'invite_code_used' });

  const existing = db.prepare('SELECT uid FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(400).json({ error: 'user_exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?,?,?)')
    .run(username, email, hash);

  db.prepare('UPDATE invite_codes SET used = 1, used_by = ? WHERE id = ?').run(info.lastInsertRowid, code.id);

  req.session.uid = info.lastInsertRowid;
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(400).json({ error: 'invalid_credentials' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

  req.session.uid = user.uid;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.session.uid);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(publicUser(user));
});

// ---------- ACCOUNT / DASHBOARD ----------

app.post('/api/account/change-email', requireAuth, (req, res) => {
  const { current_password, new_email } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.session.uid);
  if (!bcrypt.compareSync(current_password || '', user.password_hash)) {
    return res.status(400).json({ error: 'wrong_password' });
  }
  const exists = db.prepare('SELECT uid FROM users WHERE email = ? AND uid != ?').get(new_email, user.uid);
  if (exists) return res.status(400).json({ error: 'email_taken' });
  db.prepare('UPDATE users SET email = ? WHERE uid = ?').run(new_email, user.uid);
  res.json({ ok: true });
});

app.post('/api/account/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.session.uid);
  if (!bcrypt.compareSync(current_password || '', user.password_hash)) {
    return res.status(400).json({ error: 'wrong_password' });
  }
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'password_too_short' });
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE uid = ?').run(hash, user.uid);
  res.json({ ok: true });
});

app.post('/api/account/activate-key', requireAuth, (req, res) => {
  const { key_code } = req.body || {};
  const key = db.prepare('SELECT * FROM license_keys WHERE key_code = ?').get((key_code || '').trim());
  if (!key) return res.status(400).json({ error: 'invalid_key' });
  if (key.used) return res.status(400).json({ error: 'key_used' });

  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.session.uid);
  const base = user.subscription_until && new Date(user.subscription_until) > new Date()
    ? new Date(user.subscription_until)
    : new Date();
  base.setDate(base.getDate() + key.duration_days);
  const newUntil = base.toISOString();

  db.prepare('UPDATE users SET subscription_until = ? WHERE uid = ?').run(newUntil, user.uid);
  db.prepare('UPDATE license_keys SET used = 1, used_by = ? WHERE id = ?').run(user.uid, key.id);
  res.json({ ok: true, subscription_until: newUntil });
});

// ---------- ADMIN ----------

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY uid ASC').all();
  res.json(users.map(publicUser));
});

app.post('/api/admin/invite-codes', requireAdmin, (req, res) => {
  const code = 'LUMA-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run(code);
  res.json({ ok: true, code });
});

app.get('/api/admin/invite-codes', requireAdmin, (req, res) => {
  const codes = db.prepare('SELECT * FROM invite_codes ORDER BY id DESC').all();
  res.json(codes);
});

app.post('/api/admin/license-keys', requireAdmin, (req, res) => {
  const { duration_days } = req.body || {};
  const days = parseInt(duration_days, 10);
  if (!days || days <= 0) return res.status(400).json({ error: 'invalid_duration' });
  const key = 'KEY-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + days + 'D';
  db.prepare('INSERT INTO license_keys (key_code, duration_days) VALUES (?,?)').run(key, days);
  res.json({ ok: true, key });
});

app.get('/api/admin/license-keys', requireAdmin, (req, res) => {
  const keys = db.prepare('SELECT * FROM license_keys ORDER BY id DESC').all();
  res.json(keys);
});

app.post('/api/admin/users/:uid/subscription', requireAdmin, (req, res) => {
  const { days } = req.body || {};
  const uid = req.params.uid;
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const base = user.subscription_until && new Date(user.subscription_until) > new Date()
    ? new Date(user.subscription_until)
    : new Date();
  base.setDate(base.getDate() + parseInt(days, 10));
  db.prepare('UPDATE users SET subscription_until = ? WHERE uid = ?').run(base.toISOString(), uid);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`LumaDLC server running on http://localhost:${PORT}`);
});
