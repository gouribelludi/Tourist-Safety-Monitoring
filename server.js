const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const db = require('./db');
let mongoEnabled = false;
let getUsersCollection = null;
require('dotenv').config({ path: path.join(__dirname, '.env') });
// If explicitly disabled, skip attempting Mongo connection
const disableMongo = process.env.MONGO_DISABLE === 'true';

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'tourist-safety-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files from root directory
app.use(express.static(path.join(__dirname)));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));
// Serve Tourist Safety micro-frontend under /tourist-safety
app.use('/tourist-safety', express.static(path.join(__dirname, 'tourist-safety', 'frontend')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

function ensureAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success:false, message:'Not authenticated' });
  }
  next();
}

app.get('/gps-tracker', (req, res) => {
  res.sendFile(path.join(__dirname, 'gps-tracker.html'));
});

app.get('/emergency-map', (req, res) => {
  res.sendFile(path.join(__dirname, 'emergency-map.html'));
});

app.get('/police-medical', (req, res) => {
  res.sendFile(path.join(__dirname, 'police-medical.html'));
});

app.get('/admin-map', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-map.html'));
});

// Convenience route to Tourist Safety app
app.get('/tourist-safety', (req, res) => {
  res.sendFile(path.join(__dirname, 'tourist-safety', 'frontend', 'index.html'));
});

// Utility helpers
// Auth status endpoint for frontend polling
app.get('/auth/status', (req, res) => {
  if (req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  res.json({ authenticated: false });
});

function ensureTrackingUser(req) {
  if (!req.session.trackingUserId) {
    req.session.trackingUserId = crypto.randomUUID();
  }
  return req.session.trackingUserId;
}

function getLatestPosition(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT latitude, longitude, accuracy, timestamp FROM positions WHERE userId = ? ORDER BY timestamp DESC LIMIT 1`,
      [userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      }
    );
  });
}

// Tracking API
// Start tracking: registers user info and optional first position
app.post('/api/track/start', (req, res) => {
  try {
    const userId = ensureTrackingUser(req);
    const { name, phone, destination, email, latitude, longitude, accuracy } = req.body;

    const createdAt = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO users (id, name, phone, destination, email, tracking, createdAt) VALUES (?,?,?,?,?,1,?)`,
      [userId, name || '', phone || '', destination || '', email || '', createdAt],
      (err) => {
        if (err) {
          console.error('DB user insert error', err);
          return res.status(500).json({ success: false, message: 'Failed to start tracking' });
        }

        if (latitude && longitude) {
          db.run(
            `INSERT INTO positions (userId, latitude, longitude, accuracy, timestamp) VALUES (?,?,?,?,?)`,
            [userId, latitude, longitude, accuracy || null, createdAt]
          );
        }

        res.json({ success: true, userId });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// Position update
app.post('/api/track/position', (req, res) => {
  const userId = ensureTrackingUser(req);
  const { latitude, longitude, accuracy } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ success: false, message: 'Invalid coordinates' });
  }
  const timestamp = new Date().toISOString();
  db.run(
    `INSERT INTO positions (userId, latitude, longitude, accuracy, timestamp) VALUES (?,?,?,?,?)`,
    [userId, latitude, longitude, accuracy || null, timestamp],
    (err) => {
      if (err) {
        console.error('DB position insert error', err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    }
  );
});

// Current user tracking summary
app.get('/api/track/me', async (req, res) => {
  const userId = req.session.trackingUserId;
  if (!userId) return res.json({ active: false });
  db.get(`SELECT id, name, phone, destination, email, tracking, createdAt FROM users WHERE id = ?`, [userId], async (err, userRow) => {
    if (err) return res.status(500).json({ success: false });
    if (!userRow) return res.json({ active: false });
    try {
      const latestPos = await getLatestPosition(userId);
      res.json({ active: true, user: userRow, latestPosition: latestPos });
    } catch (e) {
      res.status(500).json({ success: false });
    }
  });
});

// Active trackers list (latest position per user)
app.get('/api/track/active', (req, res) => {
  // Fetch users with tracking=1 and join latest position
  const sql = `SELECT u.id, u.name, u.phone, u.destination, u.email,
    (SELECT latitude FROM positions p WHERE p.userId = u.id ORDER BY timestamp DESC LIMIT 1) AS latitude,
    (SELECT longitude FROM positions p WHERE p.userId = u.id ORDER BY timestamp DESC LIMIT 1) AS longitude,
    (SELECT accuracy FROM positions p WHERE p.userId = u.id ORDER BY timestamp DESC LIMIT 1) AS accuracy,
    (SELECT timestamp FROM positions p WHERE p.userId = u.id ORDER BY timestamp DESC LIMIT 1) AS lastUpdate
    FROM users u WHERE u.tracking = 1`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('DB active trackers error', err);
      return res.status(500).json({ success: false });
    }
    const filtered = rows.filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number');
    res.json({ success: true, trackers: filtered });
  });
});

// Stop tracking for current user
app.post('/api/track/stop', (req, res) => {
  const userId = req.session.trackingUserId;
  if (!userId) return res.json({ success: true }); // Nothing to stop
  db.run(`UPDATE users SET tracking = 0 WHERE id = ?`, [userId], (err) => {
    if (err) {
      console.error('DB stop tracking error', err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true });
  });
});

// Password hashing helpers (PBKDF2)
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}
function verifyPassword(password, stored) {
  if (!stored || !stored.salt || !stored.hash) return false;
  const attempt = crypto.pbkdf2Sync(password, stored.salt, 120000, 32, 'sha256').toString('hex');
  return attempt === stored.hash;
}

// Register endpoint
app.post('/register', async (req, res) => {
  // If Mongo disabled, just return not supported
  if (!mongoEnabled) {
    return res.status(200).json({ success:false, message:'Registration disabled (Mongo not active)' });
  }
  try {
    const usersCol = getUsersCollection();
    const { username, password, email } = req.body || {};
    if (!username || !password) return res.status(400).json({ success:false, message:'Username & password required' });
    const existing = await usersCol.findOne({ username });
    if (existing) return res.status(409).json({ success:false, message:'Username already exists' });
    const pw = hashPassword(password);
    await usersCol.insertOne({ username, password: pw, email: email || '', createdAt: new Date() });
    res.json({ success:true, message:'Registered successfully' });
  } catch (e) {
    console.error('Register error', e);
    res.status(500).json({ success:false, message:'Internal error' });
  }
});

// Login endpoint using MongoDB
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ success:false, message:'Missing credentials' });
  // Fallback simple auth when Mongo disabled: accept demo credentials or any non-empty pair
  if (!mongoEnabled) {
    const demoUser = process.env.DEMO_USER || 'tourist';
    const demoPass = process.env.DEMO_PASS || 'safe123';
    if (username === demoUser && password === demoPass) {
      req.session.user = { username }; return res.json({ success:true, message:'Login successful (fallback)' });
    }
    // Allow any non-empty credentials for demo mode
    req.session.user = { username };
    return res.json({ success:true, message:'Login successful (demo any user)' });
  }
  try {
    const usersCol = getUsersCollection();
    const user = await usersCol.findOne({ username });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success:false, message:'Invalid username or password' });
    }
    req.session.user = { username: user.username };
    res.json({ success:true, message:'Login successful' });
  } catch (e) {
    console.error('Login error', e);
    res.status(500).json({ success:false, message:e?.message || 'Internal error' });
  }
});

// Health check for Mongo
app.get('/debug/mongo', (req, res) => {
  try {
    getUsersCollection();
    res.json({ connected: true });
  } catch (e) {
    res.json({ connected: false, error: e?.message || String(e) });
  }
});

// Logout endpoint
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

let server;
if (!disableMongo) {
  try {
    const { connectMongo: cm, getUsersCollection: guc } = require('./mongo');
    connectMongo = cm; getUsersCollection = guc;
    connectMongo().then(async (usersCol) => {
      mongoEnabled = true;
      const demoUser = process.env.DEMO_USER;
      const demoPass = process.env.DEMO_PASS;
      if (demoUser && demoPass) {
        const exists = await usersCol.findOne({ username: demoUser });
        if (!exists) {
          const pw = hashPassword(demoPass);
          await usersCol.insertOne({ username: demoUser, password: pw, email: '', seeded: true, createdAt: new Date() });
          console.log('[mongo] Seeded demo user');
        }
      }
      server = app.listen(port, () => {
        console.log(`\n[server] Running with Mongo enabled at http://localhost:${port}`);
      });
    }).catch(err => {
      console.warn('[mongo] Connection failed, falling back to demo auth:', err.message);
      server = app.listen(port, () => {
        console.log(`[server] Running in FALLBACK mode (no Mongo) at http://localhost:${port}`);
      });
    });
  } catch (e) {
    console.warn('[mongo] Module load failed, fallback auth active:', e.message);
    server = app.listen(port, () => {
      console.log(`[server] Running in FALLBACK mode (module error) at http://localhost:${port}`);
    });
  }
} else {
  console.log('[config] MONGO_DISABLE=true -> skipping Mongo connection');
  server = app.listen(port, () => {
    console.log(`[server] Running in FALLBACK mode (Mongo disabled) at http://localhost:${port}`);
  });
}

if (server) {
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});