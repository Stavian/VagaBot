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
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        image_url TEXT,
        tags TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS allowed_tags (
        tag_name TEXT PRIMARY KEY,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    )
`);

// Migration: Add image_url and tags columns if they don't exist
try {
    db.exec("ALTER TABLE quotes ADD COLUMN image_url TEXT");
} catch (error) { /* Ignore */ }

try {
    db.exec("ALTER TABLE quotes ADD COLUMN tags TEXT");
} catch (error) { /* Ignore */ }

// Seed default tag
try {
    const stmt = db.prepare("INSERT OR IGNORE INTO allowed_tags (tag_name, created_by) VALUES (?, ?)");
    stmt.run('#reaction_save', 'SYSTEM');
    stmt.run('#general', 'SYSTEM');
} catch (error) { /* Ignore */ }

module.exports = {
    // Config Management
    setConfig: (key, value) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        return stmt.run(key, value);
    },
    getConfig: (key) => {
        const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
        const result = stmt.get(key);
        return result ? result.value : null;
    },

    // Tag Management
    getAllTags: () => {
        const stmt = db.prepare('SELECT tag_name FROM allowed_tags');
        return stmt.all().map(row => row.tag_name);
    },
    createTag: (tagName, createdBy) => {
        const stmt = db.prepare('INSERT OR IGNORE INTO allowed_tags (tag_name, created_by) VALUES (?, ?)');
        return stmt.run(tagName, createdBy);
    },
    tagExists: (tagName) => {
        const stmt = db.prepare('SELECT 1 FROM allowed_tags WHERE tag_name = ?');
        return !!stmt.get(tagName);
    },

    // Quote Management
    addQuote: (userId, username, quoteText, addedBy, category = 'general', imageUrl = null, tags = null) => {
        const stmt = db.prepare('INSERT INTO quotes (user_id, username, quote_text, added_by, category, image_url, tags) VALUES (?, ?, ?, ?, ?, ?, ?)');
        return stmt.run(userId, username, quoteText, addedBy, category, imageUrl, tags);
    },
    deleteQuote: (id) => {
        const stmt = db.prepare('DELETE FROM quotes WHERE id = ?');
        return stmt.run(id);
    },
    updateQuote: (id, newText, newTags) => {
         // Dynamic update: update text only, tags only, or both
         if (newText && newTags) {
             const stmt = db.prepare('UPDATE quotes SET quote_text = ?, tags = ? WHERE id = ?');
             return stmt.run(newText, newTags, id);
         } else if (newText) {
             const stmt = db.prepare('UPDATE quotes SET quote_text = ? WHERE id = ?');
             return stmt.run(newText, id);
         } else if (newTags) {
             const stmt = db.prepare('UPDATE quotes SET tags = ? WHERE id = ?');
             return stmt.run(newTags, id);
         }
         return { changes: 0 };
    },
    getQuoteById: (id) => {
        const stmt = db.prepare('SELECT * FROM quotes WHERE id = ?');
        return stmt.get(id);
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
    },
    getTopFailures: () => {
        const stmt = db.prepare(`
            SELECT username, COUNT(*) as count 
            FROM quotes 
            WHERE category = 'fail' 
            GROUP BY username 
            ORDER BY count DESC 
            LIMIT 5
        `);
        return stmt.all();
    },
    getMostQuoted: () => {
        const stmt = db.prepare(`
            SELECT username, COUNT(*) as count 
            FROM quotes 
            GROUP BY username 
            ORDER BY count DESC 
            LIMIT 5
        `);
        return stmt.all();
    },
    getTopSnitch: () => {
        const stmt = db.prepare(`
            SELECT added_by as username, COUNT(*) as count 
            FROM quotes 
            GROUP BY added_by 
            ORDER BY count DESC 
            LIMIT 5
        `);
        return stmt.all();
    },
    searchQuotes: (keyword) => {
        const stmt = db.prepare('SELECT * FROM quotes WHERE quote_text LIKE ? ORDER BY RANDOM()');
        return stmt.all(`%${keyword}%`);
    }
};
