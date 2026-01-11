const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/database.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'));
}

const db = new Database(dbPath);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        quote_text TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        added_by TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

module.exports = {
    addQuote: (userId, username, quoteText, addedBy, category = 'general') => {
        const stmt = db.prepare('INSERT INTO quotes (user_id, username, quote_text, added_by, category) VALUES (?, ?, ?, ?, ?)');
        return stmt.run(userId, username, quoteText, addedBy, category);
    },
    getRandomQuote: (userId = null) => {
        if (userId) {
            const stmt = db.prepare('SELECT * FROM quotes WHERE user_id = ? ORDER BY RANDOM() LIMIT 1');
            return stmt.get(userId);
        }
        const stmt = db.prepare('SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1');
        return stmt.get();
    },
    getRoast: (userId = null) => {
        if (userId) {
            const stmt = db.prepare("SELECT * FROM quotes WHERE user_id = ? AND category = 'fail' ORDER BY RANDOM() LIMIT 1");
            return stmt.get(userId);
        }
        const stmt = db.prepare("SELECT * FROM quotes WHERE category = 'fail' ORDER BY RANDOM() LIMIT 1");
        return stmt.get();
    }
};
