const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./safety.db");

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        email TEXT,
        phone TEXT
    )`);
});

module.exports = db;
