# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VagaBot** - A feature-rich German Discord bot for small gaming communities. Combines quote management, economy/betting system, mini-games, and LFG squad assembly.

**NOTE:** External gaming API integrations (Tracker.gg, Steam, Arc Raiders) are currently **DISABLED** - files renamed to `.disabled` extension.

## Active vs Disabled Features

### ✅ Active Commands (21 total)
- **Quotes:** `/zitat`, `/fail`, `/voice-zitat`, `/voice-recording`, `/manage_quote`, `/suche`, `/tags`
- **Economy:** `/balance`, `/balance-admin`, `/daily`, `/coinflip`, `/roll`, `/roulette`, `/highlow`, `/wette`
- **Gaming/LFG:** `/link`, `/abo`, `/assemble`
- **Rankings:** `/ranking` (quotes & coins only)
- **Utilities:** `/info`, `/config`, `/schedule`, `/ping`, `/uno`

### ❌ Disabled Commands (2 total)
- **`/stats`** (`stats.js.disabled`) - Steam, Tracker.gg gaming stats
- **`/arcraiders`** (`arcraiders.js.disabled`) - Arc Raiders extraction tracking & leaderboard

### 🔧 Disabled Utilities (4 files)
- `src/utils/steam.js.disabled` - Steam API
- `src/utils/tracker.js.disabled` - Tracker.gg API
- `src/utils/arcraiders.js.disabled` - Arc Raiders API
- `src/utils/monitor.js.disabled` - Background gaming monitor

**To Re-enable:** Rename `.disabled` files to `.js`, uncomment lines 6 & 396 in `src/index.js`, redeploy commands.

## Common Commands

```bash
# Install dependencies
npm install

# Deploy slash commands to Discord
npm run deploy
# or
node src/deploy-commands.js

# Development (direct run)
npm start

# Production (PM2 process manager)
npm run pm2:start      # Start bot
npm run pm2:logs       # View logs
npm run pm2:status     # Check status
npm run pm2:restart    # Restart bot
npm run pm2:stop       # Stop bot
```

## Architecture

### Entry Point (src/index.js)
Main Discord client that:
- Dynamically loads all command modules from `src/commands/`
- Maps commands by name to Collection
- Handles all interaction types (commands, buttons, autocomplete, reactions)
- Implements global error handling with Discord channel logging
- Manages graceful shutdown (SIGINT/SIGTERM)

### Database Architecture (SQLite)

**Database abstraction** via `src/database.js`:
- Exports `db` instance (better-sqlite3)
- All commands access shared database connection
- No ORM - raw SQL with prepared statements

**15 Tables:**
- User data: `user_coins`, `coin_transactions`, `user_links`
- Quotes: `quotes`, `voice_quotes`, `allowed_tags`
- Gaming: `games`, `subscriptions`, `last_matches` ~~`arc_extractions`~~ (DISABLED)
- Betting: `bets`, `bet_placements`
- Mini-games: `lottery_tickets`
- Config: `config`

**Note:** `last_matches` and `arc_extractions` tables exist but are not actively used due to disabled monitor/API features.

**Key Patterns:**
- Composite primary keys (e.g., user_id + platform for user_links)
- Transaction logging for all coin operations
- JSON metadata columns for extensibility

### Command Structure

Each command file exports:
```javascript
export default {
  data: new SlashCommandBuilder()...,
  async execute(interaction) { ... },
  async autocomplete(interaction) { ... } // Optional
}
```

**Subcommands** used for complex features:
- `/wette` - 5 subcommands (create, place, list, info, resolve)
- ~~`/arcraiders`~~ - DISABLED (4 subcommands: link, unlink, stats, leaderboard)

### Button Interaction Patterns

Custom ID routing via prefix matching:
```javascript
// Duel system
customId: `duel_accept_${duelId}`
customId: `duel_decline_${duelId}`

// Games
customId: `roulette_join_${gameId}`
customId: `highlow_higher`

// LFG
customId: `lfg_join_${gameName}`
customId: `lfg_leave_${gameName}`

// Navigation
customId: `info_economy`
```

All button handlers live in main `interactionCreate` event with prefix checks.

### Automated Gaming Monitor (src/utils/monitor.js.disabled)

**STATUS: DISABLED** - File renamed to `.disabled` extension and not loaded by bot.

~~**Background job** (runs every 10 minutes):~~
- ~~Checks for new matches across 13 game/platform combinations~~
- ~~Compares current match ID vs last_matches table~~
- ~~Auto-posts memes (K/D < 0.5 → Trash talk, K/D > 3.0 → MVP praise)~~
- ~~Auto-resolves K/D prediction bets~~
- ~~Tracks Arc Raiders extractions with coin rewards~~

**Note:** Monitor is disabled in `src/index.js` (lines 6, 396). To re-enable: rename `.disabled` files back to `.js` and uncomment those lines.

### Economy System

**Starting Balance:** 100 coins per user (on first interaction)

**Coin Sources:**
- Daily claims: 50 base + streak bonus (up to +100)
- ~~Arc Raiders extractions: 50-300+ coins~~ (DISABLED)
- Winning bets: Proportional pool distribution
- Mini-game wins: Variable based on game

**Streak Mechanics:**
- Grace period: 36 hours (1.5 days) to maintain streak
- Milestone bonus: Every 7 days = +100 coins
- Tracked per user in `user_coins.last_daily` and `streak_days`

**Transaction Logging:**
All coin operations logged to `coin_transactions` table with reason field.

### Gaming Integration (DISABLED)

**STATUS: All external gaming API integrations are DISABLED**

**Disabled Commands:**
- `/stats` → `stats.js.disabled` - Gaming stats from Steam/Tracker.gg
- `/arcraiders` → `arcraiders.js.disabled` - Arc Raiders extraction tracking

**Disabled Utilities:**
- `src/utils/tracker.js.disabled` - Tracker.gg API (Siege, BF6, For Honor, Destiny 2, Valorant)
- `src/utils/steam.js.disabled` - Steam API integration
- `src/utils/arcraiders.js.disabled` - Arc Raiders API integration
- `src/utils/monitor.js.disabled` - Background gaming monitor

**Note:** `/link` command still exists for storing user platform IDs locally (no API calls), used by LFG system.

### LFG (Squad Assembly) System

**Smart Player Selection:**
```javascript
// Score-based matching
playing_game = 20 points
online = 10 points
offline = 0 points

// Select top 4 scores, show next 2 as backups
```

**Join/Leave Buttons:**
- Ephemeral responses (only requester sees)
- Real-time squad roster updates
- Ping notifications on join

### Voice Recording System (src/utils/voiceRecorder.js)

**30-second circular buffer:**
- Per-channel audio recording
- Multi-user stream aggregation
- FFmpeg merging to MP3
- Stores audio paths in `voice_quotes` table

**Usage:**
```javascript
/voice-recording start  # Begins recording
/voice-recording stop   # Saves last 30 seconds
```

### Betting System

**Bet Types:**
1. Match outcome (Win/Loss/Draw)
2. K/D prediction (over/under threshold)
3. ~~Arc Raiders extraction success~~ (DISABLED)
4. Custom (manual resolution)

**Resolution:**
- ~~Auto-Resolution: Monitor detects match completion~~ (DISABLED - monitor inactive)
- **Manual Resolution Only:** Admin-only `/wette resolve` command
- Specifies winning outcome
- Refunds on cancelled bets

### Quote System

**Automatic Saving:**
React with 💾 emoji on any message → auto-saved with `#reaction_save` tag

**Categories:**
- General (default)
- Fail (for `/fail` command)
- Win

**Tag Management:**
- Whitelist system (`allowed_tags` table)
- Permission-based tag creation
- Search by keyword or tag

**Leaderboards:**
- Most quoted users
- Top snitches (who saves most quotes)
- Hall of shame (most fails)

## Key Implementation Details

### Database Initialization

Database schema auto-creates on first run (src/database.js). All tables use `IF NOT EXISTS` to avoid conflicts.

### Permission Checks

**Admin Commands:**
- `/manage_quote` - Delete/edit quotes
- `/wette resolve` - Manually resolve bets
- `/config` - Bot configuration

**Role-Based:**
- Config roles stored in database (`config.config_roles` = CSV of role IDs)
- Tag creation requires specific roles or admin

### Error Handling

**Global Handler:**
```javascript
client.on('interactionCreate', async (interaction) => {
  try {
    await command.execute(interaction);
  } catch (error) {
    // Logs to Discord channel + console
    // Sends user-friendly error message
  }
});
```

**Log Channel:**
Set via `/config` - embeds full error stack traces

### PM2 Configuration (ecosystem.config.js)

**Production Settings:**
- Memory limit: 500MB (auto-restart if exceeded)
- Max 10 restarts within 10 seconds (prevents crash loops)
- 4-second restart delay
- Graceful shutdown: 5-second kill timeout
- Logs to `logs/error.log` and `logs/out.log`

## Environment Variables

```env
DISCORD_TOKEN=<bot_token>                    # Required
CLIENT_ID=<application_id>                   # Required
GUILD_ID=<server_id>                         # Optional (for guild commands)
TRN_API_KEY=<tracker_api_key>                # NOT USED (tracker.js disabled)
STEAM_API_KEY=<steam_api_key>                # NOT USED (steam.js disabled)
ARC_RAIDERS_API_KEY=<arc_api_key>            # NOT USED (arcraiders.js disabled)
ARC_RAIDERS_API_URL=https://api.arcraiders.com/v1  # NOT USED (arcraiders.js disabled)
```

**Note:** API keys remain in `.env` but are not loaded by disabled modules.

## Database Config Keys

Set via `/config` command or direct database insert:
- `wett_channel_id` - Channel for bet notifications
- `bot_log_channel_id` - Channel for error logging
- `config_roles` - CSV of role IDs with config permissions (e.g., "123456789,987654321")

## German Language

All user-facing text is in German:
- Command descriptions
- Embed titles, descriptions, field names
- Error messages
- Button labels
- Status messages

## Common Patterns

### Coin Transactions
Always log to both tables:
```javascript
// Update balance
db.prepare(`UPDATE user_coins SET balance = balance + ? WHERE user_id = ?`).run(amount, userId);

// Log transaction
db.prepare(`INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)`).run(userId, amount, reason);
```

### Interaction Deferral
For long-running operations (API calls, database queries):
```javascript
await interaction.deferReply({ ephemeral: true });
// ... perform work ...
await interaction.editReply({ content: 'Done!' });
```

### Autocomplete
Gaming commands use autocomplete for game selection:
```javascript
async autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const games = db.prepare(`SELECT game_name FROM games`).all();
  const filtered = games.filter(g => g.game_name.toLowerCase().includes(focusedValue.toLowerCase()));
  await interaction.respond(filtered.map(g => ({ name: g.game_name, value: g.game_name })));
}
```
