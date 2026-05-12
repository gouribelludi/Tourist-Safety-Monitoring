const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tracker.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    destination TEXT,
    email TEXT,
    tracking INTEGER,
    createdAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS positions (
    userId TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    timestamp TEXT
  )`);
});

module.exports = db;
