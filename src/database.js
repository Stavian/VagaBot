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

db.exec(`
    CREATE TABLE IF NOT EXISTS games (
        name TEXT PRIMARY KEY,
        max_players INTEGER DEFAULT 5
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT NOT NULL,
        game_name TEXT NOT NULL,
        PRIMARY KEY (user_id, game_name),
        FOREIGN KEY (game_name) REFERENCES games(name) ON DELETE CASCADE
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS user_links (
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, platform)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS last_matches (
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        match_id TEXT NOT NULL,
        PRIMARY KEY (user_id, platform)
    )
`);

// Economy System Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS user_coins (
        user_id TEXT PRIMARY KEY,
        coins INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        last_daily DATETIME,
        daily_streak INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS coin_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        bet_type TEXT NOT NULL,
        target_user_id TEXT,
        target_value REAL,
        match_id TEXT,
        closes_at DATETIME,
        resolved BOOLEAN DEFAULT 0,
        winning_option TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS bet_placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bet_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        choice TEXT NOT NULL,
        placed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE,
        UNIQUE (bet_id, user_id)
    )
`);

// Arc Raiders Extraction Tracking
db.exec(`
    CREATE TABLE IF NOT EXISTS arc_extractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        extraction_id TEXT NOT NULL UNIQUE,
        success BOOLEAN DEFAULT 1,
        kills INTEGER DEFAULT 0,
        damage_dealt INTEGER DEFAULT 0,
        survival_time INTEGER DEFAULT 0,
        loot_count INTEGER DEFAULT 0,
        rarity_common INTEGER DEFAULT 0,
        rarity_uncommon INTEGER DEFAULT 0,
        rarity_rare INTEGER DEFAULT 0,
        rarity_epic INTEGER DEFAULT 0,
        rarity_legendary INTEGER DEFAULT 0,
        squad_size INTEGER DEFAULT 1,
        squad_members TEXT,
        coins_earned INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Voice Chat Quote System
db.exec(`
    CREATE TABLE IF NOT EXISTS voice_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        quote_text TEXT NOT NULL,
        voice_channel_id TEXT,
        voice_channel_name TEXT,
        added_by TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT,
        audio_file_path TEXT
    )
`);

// Migration: Remove role_id if it exists (simplest way is to ignore for now or recreate, 
// but since we are dev, we just ensure the new structure works for new entries. 
// Ideally we would migrate data, but for this switch we'll just handle new structure).

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

    // Role Permission Management
    addConfigRole: (roleId) => {
        const current = module.exports.getConfig('config_roles');
        let roles = current ? current.split(',') : [];
        if (!roles.includes(roleId)) {
            roles.push(roleId);
            module.exports.setConfig('config_roles', roles.join(','));
        }
    },
    removeConfigRole: (roleId) => {
        const current = module.exports.getConfig('config_roles');
        if (!current) return;
        let roles = current.split(',');
        roles = roles.filter(id => id !== roleId);
        module.exports.setConfig('config_roles', roles.join(','));
    },
    getConfigRoles: () => {
        const current = module.exports.getConfig('config_roles');
        return current ? current.split(',') : [];
    },

    // Game Management (LFG)
    addGame: (name) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO games (name, max_players) VALUES (?, ?)');
        return stmt.run(name, 0); // 0 = unlimited/dynamic
    },
    removeGame: (name) => {
        const stmt = db.prepare('DELETE FROM games WHERE name = ?');
        return stmt.run(name);
    },
    getGame: (name) => {
        const stmt = db.prepare('SELECT * FROM games WHERE name = ?');
        return stmt.get(name);
    },
    getAllGames: () => {
        const stmt = db.prepare('SELECT * FROM games');
        return stmt.all();
    },

    // Subscription Management
    subscribe: (userId, gameName) => {
        const stmt = db.prepare('INSERT OR IGNORE INTO subscriptions (user_id, game_name) VALUES (?, ?)');
        return stmt.run(userId, gameName);
    },
    unsubscribe: (userId, gameName) => {
        const stmt = db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND game_name = ?');
        return stmt.run(userId, gameName);
    },
    getSubscribers: (gameName) => {
        const stmt = db.prepare('SELECT user_id FROM subscriptions WHERE game_name = ?');
        return stmt.all(gameName).map(row => row.user_id);
    },
    getUserSubscriptions: (userId) => {
        const stmt = db.prepare('SELECT game_name FROM subscriptions WHERE user_id = ?');
        return stmt.all(userId).map(row => row.game_name);
    },

    // User Linking (Phase 4)
    linkUser: (userId, platform, externalId, metadata = null) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO user_links (user_id, platform, external_id, metadata) VALUES (?, ?, ?, ?)');
        return stmt.run(userId, platform, externalId, metadata);
    },
    getLinkedUser: (userId, platform) => {
        const stmt = db.prepare('SELECT * FROM user_links WHERE user_id = ? AND platform = ?');
        return stmt.get(userId, platform);
    },
    removeLink: (userId, platform) => {
        const stmt = db.prepare('DELETE FROM user_links WHERE user_id = ? AND platform = ?');
        return stmt.run(userId, platform);
    },
    getAllLinksForPlatform: (platform) => {
        const stmt = db.prepare('SELECT * FROM user_links WHERE platform = ?');
        return stmt.all(platform);
    },
    setLastMatch: (userId, platform, matchId) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO last_matches (user_id, platform, match_id) VALUES (?, ?, ?)');
        return stmt.run(userId, platform, matchId);
    },
    getLastMatch: (userId, platform) => {
        const stmt = db.prepare('SELECT match_id FROM last_matches WHERE user_id = ? AND platform = ?');
        const result = stmt.get(userId, platform);
        return result ? result.match_id : null;
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
    },

    // Economy System
    getUserCoins: (userId) => {
        const stmt = db.prepare('SELECT * FROM user_coins WHERE user_id = ?');
        let user = stmt.get(userId);
        if (!user) {
            // Create user with starting coins
            const insertStmt = db.prepare('INSERT INTO user_coins (user_id, coins, total_earned) VALUES (?, ?, ?)');
            insertStmt.run(userId, 100, 100); // Start with 100 coins
            user = { user_id: userId, coins: 100, total_earned: 100, last_daily: null, daily_streak: 0 };
        }
        return user;
    },
    addCoins: (userId, amount, type, reason) => {
        const user = module.exports.getUserCoins(userId);
        const newBalance = user.coins + amount;
        const newTotal = user.total_earned + (amount > 0 ? amount : 0);

        const updateStmt = db.prepare('UPDATE user_coins SET coins = ?, total_earned = ? WHERE user_id = ?');
        updateStmt.run(newBalance, newTotal, userId);

        const logStmt = db.prepare('INSERT INTO coin_transactions (user_id, amount, type, reason) VALUES (?, ?, ?, ?)');
        logStmt.run(userId, amount, type, reason);

        return newBalance;
    },
    claimDaily: (userId) => {
        const user = module.exports.getUserCoins(userId);
        const now = new Date();

        // Check if already claimed today
        if (user.last_daily) {
            const lastClaim = new Date(user.last_daily);
            const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                return { success: false, hoursLeft: Math.ceil(24 - hoursSince) };
            }

            // Check streak
            const daysSince = (now - lastClaim) / (1000 * 60 * 60 * 24);
            const newStreak = daysSince <= 1.5 ? user.daily_streak + 1 : 1; // 1.5 days grace period

            const baseReward = 50;
            const streakBonus = Math.min(newStreak * 10, 100); // Max +100 bonus
            const totalReward = baseReward + streakBonus;

            const updateStmt = db.prepare('UPDATE user_coins SET coins = coins + ?, total_earned = total_earned + ?, last_daily = ?, daily_streak = ? WHERE user_id = ?');
            updateStmt.run(totalReward, totalReward, now.toISOString(), newStreak, userId);

            const logStmt = db.prepare('INSERT INTO coin_transactions (user_id, amount, type, reason) VALUES (?, ?, ?, ?)');
            logStmt.run(userId, totalReward, 'daily', `Tägliche Belohnung (Streak: ${newStreak})`);

            return { success: true, amount: totalReward, streak: newStreak, bonus: streakBonus };
        } else {
            // First daily claim
            const reward = 50;
            const updateStmt = db.prepare('UPDATE user_coins SET coins = coins + ?, total_earned = total_earned + ?, last_daily = ?, daily_streak = 1 WHERE user_id = ?');
            updateStmt.run(reward, reward, now.toISOString(), userId);

            const logStmt = db.prepare('INSERT INTO coin_transactions (user_id, amount, type, reason) VALUES (?, ?, ?, ?)');
            logStmt.run(userId, reward, 'daily', 'Erste tägliche Belohnung');

            return { success: true, amount: reward, streak: 1, bonus: 0 };
        }
    },
    getTopCoinHolders: () => {
        const stmt = db.prepare('SELECT user_id, coins FROM user_coins ORDER BY coins DESC LIMIT 10');
        return stmt.all();
    },
    getTopCoinEarners: () => {
        const stmt = db.prepare('SELECT user_id, total_earned FROM user_coins ORDER BY total_earned DESC LIMIT 10');
        return stmt.all();
    },

    // Betting System
    createBet: (creatorId, title, description, betType, targetUserId = null, targetValue = null, closesAt = null) => {
        const stmt = db.prepare('INSERT INTO bets (creator_id, title, description, bet_type, target_user_id, target_value, closes_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        return stmt.run(creatorId, title, description, betType, targetUserId, targetValue, closesAt);
    },
    placeBet: (betId, userId, amount, choice) => {
        // Check if bet exists and is open
        const betStmt = db.prepare('SELECT * FROM bets WHERE id = ? AND resolved = 0');
        const bet = betStmt.get(betId);
        if (!bet) return { success: false, error: 'Wette nicht gefunden oder bereits beendet' };

        // Check if closes_at has passed
        if (bet.closes_at) {
            const now = new Date();
            const closesAt = new Date(bet.closes_at);
            if (now > closesAt) {
                return { success: false, error: 'Wette ist bereits geschlossen' };
            }
        }

        // Check user has enough coins
        const user = module.exports.getUserCoins(userId);
        if (user.coins < amount) return { success: false, error: 'Nicht genug Coins' };

        // Check if user already placed a bet
        const existingStmt = db.prepare('SELECT * FROM bet_placements WHERE bet_id = ? AND user_id = ?');
        const existing = existingStmt.get(betId, userId);
        if (existing) return { success: false, error: 'Du hast bereits auf diese Wette gesetzt' };

        // Deduct coins
        module.exports.addCoins(userId, -amount, 'bet', `Wette gesetzt: ${bet.title}`);

        // Place bet
        const placeStmt = db.prepare('INSERT INTO bet_placements (bet_id, user_id, amount, choice) VALUES (?, ?, ?, ?)');
        placeStmt.run(betId, userId, amount, choice);

        return { success: true };
    },
    getActiveBets: () => {
        const stmt = db.prepare('SELECT * FROM bets WHERE resolved = 0 ORDER BY created_at DESC');
        return stmt.all();
    },
    getBetById: (betId) => {
        const stmt = db.prepare('SELECT * FROM bets WHERE id = ?');
        return stmt.get(betId);
    },
    getBetPlacements: (betId) => {
        const stmt = db.prepare('SELECT * FROM bet_placements WHERE bet_id = ?');
        return stmt.all(betId);
    },
    resolveBet: (betId, winningOption) => {
        const bet = module.exports.getBetById(betId);
        if (!bet || bet.resolved) return { success: false, error: 'Wette nicht gefunden oder bereits beendet' };

        // Mark bet as resolved
        const updateBetStmt = db.prepare('UPDATE bets SET resolved = 1, winning_option = ? WHERE id = ?');
        updateBetStmt.run(winningOption, betId);

        // Get all placements
        const placements = module.exports.getBetPlacements(betId);
        const winners = placements.filter(p => p.choice === winningOption);
        const losers = placements.filter(p => p.choice !== winningOption);

        const totalPool = placements.reduce((sum, p) => sum + p.amount, 0);
        const winnerPool = winners.reduce((sum, p) => sum + p.amount, 0);

        // Distribute winnings
        if (winnerPool > 0) {
            for (const winner of winners) {
                const share = (winner.amount / winnerPool) * totalPool;
                const winnings = Math.floor(share);
                module.exports.addCoins(winner.user_id, winnings, 'bet_win', `Wette gewonnen: ${bet.title}`);
            }
        }

        return { success: true, winners: winners.length, losers: losers.length, pool: totalPool };
    },

    // Arc Raiders Extraction System
    saveExtraction: (userId, playerId, extractionData) => {
        const stmt = db.prepare(`
            INSERT INTO arc_extractions (
                user_id, player_id, extraction_id, success, kills, damage_dealt,
                survival_time, loot_count, rarity_common, rarity_uncommon,
                rarity_rare, rarity_epic, rarity_legendary, squad_size,
                squad_members, coins_earned, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        return stmt.run(
            userId,
            playerId,
            extractionData.id,
            extractionData.success ? 1 : 0,
            extractionData.kills || 0,
            extractionData.damage_dealt || 0,
            extractionData.survival_time || 0,
            extractionData.loot_count || 0,
            extractionData.rarity_count?.common || 0,
            extractionData.rarity_count?.uncommon || 0,
            extractionData.rarity_count?.rare || 0,
            extractionData.rarity_count?.epic || 0,
            extractionData.rarity_count?.legendary || 0,
            extractionData.squad_size || 1,
            extractionData.squad_members ? JSON.stringify(extractionData.squad_members) : null,
            extractionData.coin_reward || 0,
            extractionData.timestamp ? extractionData.timestamp.toISOString() : new Date().toISOString()
        );
    },
    getLastExtraction: (userId) => {
        const stmt = db.prepare('SELECT extraction_id FROM arc_extractions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1');
        const result = stmt.get(userId);
        return result ? result.extraction_id : null;
    },
    getExtractionStats: (userId) => {
        const stmt = db.prepare(`
            SELECT
                COUNT(*) as total_extractions,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_extractions,
                SUM(kills) as total_kills,
                SUM(damage_dealt) as total_damage,
                SUM(loot_count) as total_loot,
                SUM(coins_earned) as total_coins_earned,
                AVG(survival_time) as avg_survival_time
            FROM arc_extractions
            WHERE user_id = ?
        `);
        return stmt.get(userId);
    },
    getTopExtractors: () => {
        const stmt = db.prepare(`
            SELECT
                user_id,
                COUNT(*) as extractions,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                SUM(rarity_legendary) as legendary_items
            FROM arc_extractions
            GROUP BY user_id
            ORDER BY legendary_items DESC, successful DESC
            LIMIT 10
        `);
        return stmt.all();
    },

    // Voice Quote Management
    addVoiceQuote: (userId, username, quoteText, addedBy, voiceChannelId = null, voiceChannelName = null, tags = null, audioFilePath = null) => {
        const stmt = db.prepare('INSERT INTO voice_quotes (user_id, username, quote_text, added_by, voice_channel_id, voice_channel_name, tags, audio_file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        return stmt.run(userId, username, quoteText, addedBy, voiceChannelId, voiceChannelName, tags, audioFilePath);
    },
    deleteVoiceQuote: (id) => {
        const stmt = db.prepare('DELETE FROM voice_quotes WHERE id = ?');
        return stmt.run(id);
    },
    updateVoiceQuote: (id, newText, newTags) => {
        if (newText && newTags) {
            const stmt = db.prepare('UPDATE voice_quotes SET quote_text = ?, tags = ? WHERE id = ?');
            return stmt.run(newText, newTags, id);
        } else if (newText) {
            const stmt = db.prepare('UPDATE voice_quotes SET quote_text = ? WHERE id = ?');
            return stmt.run(newText, id);
        } else if (newTags) {
            const stmt = db.prepare('UPDATE voice_quotes SET tags = ? WHERE id = ?');
            return stmt.run(newTags, id);
        }
        return { changes: 0 };
    },
    getVoiceQuoteById: (id) => {
        const stmt = db.prepare('SELECT * FROM voice_quotes WHERE id = ?');
        return stmt.get(id);
    },
    getRandomVoiceQuote: (userId = null) => {
        if (userId) {
            const stmt = db.prepare('SELECT * FROM voice_quotes WHERE user_id = ? ORDER BY RANDOM() LIMIT 1');
            return stmt.get(userId);
        }
        const stmt = db.prepare('SELECT * FROM voice_quotes ORDER BY RANDOM() LIMIT 1');
        return stmt.get();
    },
    getMostVoiceQuoted: () => {
        const stmt = db.prepare(`
            SELECT username, COUNT(*) as count
            FROM voice_quotes
            GROUP BY username
            ORDER BY count DESC
            LIMIT 5
        `);
        return stmt.all();
    },
    getTopVoiceSnitch: () => {
        const stmt = db.prepare(`
            SELECT added_by as username, COUNT(*) as count
            FROM voice_quotes
            GROUP BY added_by
            ORDER BY count DESC
            LIMIT 5
        `);
        return stmt.all();
    },
    searchVoiceQuotes: (keyword) => {
        const stmt = db.prepare('SELECT * FROM voice_quotes WHERE quote_text LIKE ? ORDER BY RANDOM()');
        return stmt.all(`%${keyword}%`);
    },
    getVoiceQuotesByChannel: (channelId) => {
        const stmt = db.prepare('SELECT * FROM voice_quotes WHERE voice_channel_id = ? ORDER BY timestamp DESC');
        return stmt.all(channelId);
    }
};
