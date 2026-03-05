const http = require("http");
const { db } = require("../database");

const PORT = parseInt(process.env.STATS_PORT) || 3002;

// Bot user IDs excluded from all per-user stats
const BOT_IDS = [
  process.env.CLIENT_ID,   // VagaBot itself
  process.env.FINN_BOT_ID  // Finn Wegbier
].filter(Boolean);

function botFilter(column) {
  if (!BOT_IDS.length) return { sql: "", params: [] };
  const placeholders = BOT_IDS.map(() => "?").join(", ");
  return { sql: `AND ${column} NOT IN (${placeholders})`, params: BOT_IDS };
}

function getWeeklyStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const periodEnd = new Date().toISOString().slice(0, 10);

  const bf = botFilter("user_id");

  // Top 5 coin holders overall
  const topCoins = db.prepare(`
    SELECT user_id, coins, total_earned
    FROM user_coins
    WHERE 1=1 ${bf.sql}
    ORDER BY coins DESC
    LIMIT 5
  `).all(...bf.params);

  // Most quoted users this week
  const mostQuoted = db.prepare(`
    SELECT username, COUNT(*) as count
    FROM quotes
    WHERE timestamp >= ? ${bf.sql}
    GROUP BY username
    ORDER BY count DESC
    LIMIT 5
  `).all(sevenDaysAgo, ...bf.params);

  // Most fails this week
  const topFails = db.prepare(`
    SELECT username, COUNT(*) as count
    FROM quotes
    WHERE category = 'fail' AND timestamp >= ? ${bf.sql}
    GROUP BY username
    ORDER BY count DESC
    LIMIT 5
  `).all(sevenDaysAgo, ...bf.params);

  // Bet records this week (resolved bets only)
  const bfBet = botFilter("bp.user_id");
  const betRecords = db.prepare(`
    SELECT
      bp.user_id,
      COUNT(*) as total_bets,
      SUM(CASE WHEN bp.choice = b.winning_option THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN bp.choice != b.winning_option THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN bp.choice = b.winning_option THEN bp.amount ELSE -bp.amount END) as net_coins
    FROM bet_placements bp
    JOIN bets b ON bp.bet_id = b.id
    WHERE b.resolved = 1 AND bp.placed_at >= ? ${bfBet.sql}
    GROUP BY bp.user_id
    ORDER BY wins DESC
    LIMIT 5
  `).all(sevenDaysAgo, ...bfBet.params);

  // Coins earned this week (positive transactions only)
  const earnedThisWeek = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_earned
    FROM coin_transactions
    WHERE amount > 0 AND timestamp >= ?
  `).get(sevenDaysAgo);

  // Total coins bet this week
  const betThisWeek = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total_bet
    FROM coin_transactions
    WHERE type = 'bet' AND timestamp >= ?
  `).get(sevenDaysAgo);

  // Most active users (combined quote + bet activity this week)
  const mostActive = db.prepare(`
    SELECT username, COUNT(*) as score
    FROM quotes
    WHERE timestamp >= ? ${bf.sql}
    GROUP BY username
    ORDER BY score DESC
    LIMIT 5
  `).all(sevenDaysAgo, ...bf.params);

  return {
    period: `${periodStart} bis ${periodEnd}`,
    top_coins: topCoins,
    most_quoted: mostQuoted,
    top_fails: topFails,
    bet_records: betRecords,
    most_active: mostActive,
    transactions_summary: {
      total_earned: earnedThisWeek?.total_earned ?? 0,
      total_bet: betThisWeek?.total_bet ?? 0
    }
  };
}

function startStatsServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "GET" && req.url === "/stats/weekly") {
      try {
        const stats = getWeeklyStats();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(stats));
      } catch (err) {
        console.error("[stats] Fehler beim Abfragen der Stats:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[stats] Stats-Server läuft auf 0.0.0.0:${PORT}`);
  });

  server.on("error", err => {
    console.error("[stats] Server-Fehler:", err.message);
  });
}

module.exports = { startStatsServer };
