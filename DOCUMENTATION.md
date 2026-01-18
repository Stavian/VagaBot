# VagaBot - Complete Documentation

**Last Updated:** 2026-01-18
**Version:** 2.0.0
**Language:** German (Deutsch)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Project Roadmap](#project-roadmap)
3. [Technical Architecture](#technical-architecture)
4. [Setup & Installation](#setup--installation)
5. [Deployment Guide](#deployment-guide)
6. [Features Documentation](#features-documentation)
   - [Quote System](#quote-system)
   - [Voice Chat Quotes](#voice-chat-quotes)
   - [Voice Audio Recording](#voice-audio-recording)
   - [Gaming Integration](#gaming-integration)
   - [Economy & Betting](#economy--betting)
   - [Squad Assembly (LFG)](#squad-assembly-lfg)
   - [Utilities & Mini-Games](#utilities--mini-games)
7. [Commands Reference](#commands-reference)
8. [Database Schema](#database-schema)
9. [API Integration](#api-integration)
10. [Troubleshooting](#troubleshooting)
11. [Security & Privacy](#security--privacy)
12. [Future Enhancements](#future-enhancements)

---

# Project Overview

**VagaBot** is a custom Discord bot designed for small gaming communities. The bot enhances the social atmosphere by automating scheduling, tracking memorable moments ("inside jokes"), providing gaming statistics, and offering an integrated economy and betting system.

## Key Features

- **Quote System** - Save and share memorable text and voice chat moments
- **Voice Audio Recording** - Automatically capture the last 30 seconds of audio
- **Gaming Stats** - Track player performance across multiple games
- **Economy & Betting** - Coin system with match outcome predictions
- **Squad Assembly** - Smart LFG (Looking For Group) system
- **Arc Raiders Integration** - Extraction tracking with rewards
- **German Localization** - All user-facing text in German

## Tech Stack

- **Runtime:** Node.js
- **Framework:** discord.js v14
- **Database:** SQLite (better-sqlite3)
- **Voice:** @discordjs/voice, FFmpeg
- **External APIs:** Steam API, Tracker.gg API, Arc Raiders API

---

# Project Roadmap

## PHASE 1: CORE SETUP ✅
- [x] Choose Language: JavaScript (discord.js)
- [x] Developer Portal: Bot created and configured
- [x] Permissions: Invite link generated
- [x] Code Base: Main file and config setup
- [x] Database: SQLite implementation

## PHASE 2: INSIDE JOKE DATABASE ✅
- [x] Database Schema: `quotes` table
- [x] Command `/merken` - Save quotes with tags and images
- [x] Command `/zitat` - Display random quotes
- [x] Command `/fail` - Fetch fail moments
- [x] Reaction Saving (💾 emoji)
- [x] Leaderboards (`/ranking`)
- [x] Search (`/suche`)
- [x] Tag Management (`/tags`)

## PHASE 3: SQUAD ASSEMBLER (LFG) ✅
- [x] Role Setup for games
- [x] Command `/assemble` - Smart squad matching
- [x] Button Logic for joining/leaving
- [x] Game subscriptions (`/abo`)

## PHASE 4: STATS & SHAME ✅
- [x] API Keys obtained
- [x] Link Accounts (`/link`)
- [x] Command `/stats` - Display gaming stats
- [x] Auto-Post monitoring system

## PHASE 5: UTILITY & MINI-GAMES ✅
- [x] Command `/schedule` - Event polls
- [x] Timezone logic with Discord timestamps
- [x] Mini-Game: Russian Roulette (`/roulette`)

## PHASE 6: DEPLOYMENT ✅
- [x] Hosting: PM2 process manager
- [x] Logging: Discord + file logs
- [x] Status: "Passt auf!"
- [x] Auto-restart configuration
- [x] Boot persistence

## PHASE 7: ADVANCED FEATURES (In Progress)

### News & Alerts
- [ ] Patch News Feed (`/patchnews`)
- [ ] Free Games Alert (`/freegames`)

### Economy & Betting System ✅
- [x] Currency System (`/balance`, `/daily`)
- [x] Betting System (`/wette`)
- [x] Coin rewards and leaderboards

### Enhanced Quote System ✅
- [x] **Voice Chat Quote Book** (`/voice-zitat`) - COMPLETED
- [x] **Voice Audio Recording** - COMPLETED
- [x] Automatic 30-second audio capture
- [x] Separate voice quote leaderboards

### Server Monitoring
- [ ] Game Server Status (`/serverstatus`)

### Video Clip Recording
- [ ] Voice/Text Command Video Clip (`/clip`)

### Additional Mini-Games
- [ ] Coin Flip (`/coinflip`)
- [ ] Dice Roll (`/roll`)

---

# Technical Architecture

## Project Structure

```
VagaBot/
├── src/
│   ├── index.js                     # Main bot entry point
│   ├── database.js                  # SQLite database layer
│   ├── deploy-commands.js           # Command deployment
│   ├── commands/                    # 22 slash command modules
│   │   ├── ping.js
│   │   ├── merken.js               # Quote saving
│   │   ├── zitat.js                # Random quote
│   │   ├── fail.js                 # Fail moments
│   │   ├── ranking.js              # Leaderboards
│   │   ├── suche.js                # Search quotes
│   │   ├── tags.js                 # Tag management
│   │   ├── manage_quote.js         # Quote CRUD
│   │   ├── voice-zitat.js          # Voice quotes ✨NEW
│   │   ├── voice-recording.js      # Audio recording ✨NEW
│   │   ├── assemble.js             # Squad assembly
│   │   ├── abo.js                  # Game subscriptions
│   │   ├── config.js               # Admin config
│   │   ├── link.js                 # Account linking
│   │   ├── stats.js                # Gaming stats
│   │   ├── arcraiders.js           # Arc Raiders ✨NEW
│   │   ├── balance.js              # Economy
│   │   ├── daily.js                # Daily rewards
│   │   ├── wette.js                # Betting system
│   │   ├── schedule.js             # Event scheduling
│   │   ├── roulette.js             # Mini-game
│   │   └── info.js                 # Help system
│   └── utils/
│       ├── monitor.js              # Match monitoring
│       ├── tracker.js              # Tracker.gg API
│       ├── steam.js                # Steam API
│       ├── arcraiders.js           # Arc Raiders API
│       └── voiceRecorder.js        # Voice recording ✨NEW
├── data/
│   ├── database.db                 # SQLite database
│   └── voice-quotes/               # Audio files ✨NEW
├── logs/
│   ├── out.log                     # PM2 output logs
│   └── error.log                   # PM2 error logs
├── .env                            # Environment config
├── package.json
├── ecosystem.config.js             # PM2 config
└── DOCUMENTATION.md                # This file
```

## Database Architecture

VagaBot uses SQLite with the following tables:

- `quotes` - Text chat quotes
- `voice_quotes` - Voice chat quotes with audio ✨NEW
- `allowed_tags` - Tag whitelist
- `config` - Bot configuration
- `games` - LFG game list
- `subscriptions` - User game subscriptions
- `user_links` - Gaming account links
- `last_matches` - Match tracking
- `user_coins` - Economy balances
- `coin_transactions` - Transaction history
- `bets` - Betting system
- `bet_placements` - User bet entries
- `arc_extractions` - Arc Raiders data

---

# Setup & Installation

## Prerequisites

- Node.js (v16 or higher)
- Discord Bot Token with intents enabled:
  - **Message Content Intent** ✅
  - **Presence Intent** ✅
  - **Server Members Intent** ✅
- API Keys (optional):
  - Steam API Key
  - Tracker.gg API Key
  - Arc Raiders API Key

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `discord.js` - Discord bot framework
- `better-sqlite3` - Database
- `axios` - HTTP requests
- `dotenv` - Environment variables
- `@discordjs/voice` - Voice support ✨NEW
- `ffmpeg-static` - Audio conversion ✨NEW
- `opusscript` - Opus codec ✨NEW
- `prism-media` - Audio streaming ✨NEW

**Note:** Use `--legacy-peer-deps` if you encounter dependency conflicts:
```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment

Create a `.env` file with:

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here

# API Keys (Optional)
STEAM_API_KEY=your_steam_api_key_here
TRN_API_KEY=your_tracker_gg_api_key_here

# Arc Raiders API (Optional)
ARC_RAIDERS_API_KEY=your_arc_raiders_api_key_here
ARC_RAIDERS_API_URL=https://api.arcraiders.com/v1
```

### 3. Deploy Commands

Register slash commands with Discord:

```bash
npm run deploy
```

Expected output:
```
Starte Aktualisierung von 22 Applikations-Befehlen (/).
Erfolgreich neu geladen: 22 Applikations-Befehle (/).
```

### 4. Run the Bot

**Development:**
```bash
npm start
```

**Production (PM2):**
```bash
npm run pm2:start
```

---

# Deployment Guide

## PM2 Process Manager

VagaBot uses PM2 for 24/7 operation with automatic restarts and monitoring.

### Quick Start

```bash
# Deploy commands
npm run deploy

# Start bot with PM2
npm run pm2:start

# Check status
npm run pm2:status
```

### PM2 Configuration

The bot is configured in `ecosystem.config.js`:

```javascript
{
  name: 'VagaBot',
  script: './src/index.js',
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: '500M',
  max_restarts: 10,
  min_uptime: '10s',
  restart_delay: 4000,
  error_file: './logs/error.log',
  out_file: './logs/out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
}
```

### PM2 Commands

```bash
# Start the bot
npm run pm2:start

# Stop the bot
npm run pm2:stop

# Restart the bot
npm run pm2:restart

# View logs in real-time
npm run pm2:logs

# Check status
npm run pm2:status

# Monitor resources
npm run pm2:monit
```

### Auto-Start on Boot

**Windows:**
```bash
pm2 startup
pm2 save
npm install -g pm2-windows-startup
pm2-startup install
```

**Linux/Raspberry Pi:**
```bash
pm2 startup
pm2 save
```

### Monitoring & Logs

**Real-Time Logs:**
```bash
pm2 logs VagaBot --lines 50
```

**Log Files:**
- Output: `logs/out.log`
- Errors: `logs/error.log`

**Discord Logging:**
Configure a log channel:
```
/config log_channel #bot-logs
```

---

# Features Documentation

## Quote System

### Text Chat Quotes

Save memorable moments from text chats.

**Commands:**
- `/zitat hinzufuegen` - Save a quote
- `/zitat anzeigen` - Display random quote
- `/zitat suchen` - Search quotes
- `/zitat bearbeiten` - Edit quote
- `/zitat loeschen` - Delete quote
- `/fail hinzufuegen` - Save a fail
- `/fail anzeigen` - Display random fail

**Features:**
- Image attachments
- Custom tags
- Categories (General, Fail, Win)
- Reaction saving (💾 emoji)
- Search by keyword
- Permission-based tag creation

**Example:**
```
/zitat hinzufuegen nutzer:@Player text:"Das war episch!" kategorie:Win tags:#valorant
```

### Leaderboards

View quote statistics with `/ranking`:

- **Hall of Shame** - Most fails
- **Meist zitiert** - Most quoted users
- **Top Snitch** - Most quotes saved

Options:
- `/ranking typ:Zitate & Fails`
- `/ranking typ:Alle`

---

## Voice Chat Quotes

### Overview

Save memorable quotes from voice chats with automatic channel tracking.

**Commands:**
- `/voice-zitat speichern` - Save voice quote
- `/voice-zitat anzeigen` - Display random voice quote
- `/voice-zitat suchen` - Search voice quotes
- `/voice-zitat löschen` - Delete voice quote

**Features:**
- Voice channel name tracking
- Tag support
- Separate leaderboards
- **Audio recording integration** ✨NEW

**Example:**
```
/voice-zitat speichern nutzer:@Player text:"Das war ein Headshot!" tags:#rage
```

### Voice Quote Leaderboards

Access with `/ranking typ:Voice-Zitate`:

- **Meist in Voice zitiert** - Most voice quotes
- **Top Voice-Snitch** - Most voice quotes saved

---

## Voice Audio Recording

### Overview ✨NEW

Automatically capture the last 30 seconds of audio when saving voice quotes.

**How It Works:**
- Continuous recording with 30-second circular buffer
- Per-user audio stream management
- Automatic MP3 conversion
- Retroactive capture (save audio after it happens)

**Audio Quality:**
- Sample Rate: 48kHz (Discord quality)
- Channels: Stereo
- Format: MP3 (128kbps)
- Duration: 30 seconds per quote

### Commands

#### `/voice-recording start`
Start recording in your voice channel.

```
🎙️ Voice-Aufnahme gestartet in **Gaming-Channel**!

📝 Du kannst jetzt Voice-Zitate mit `/voice-zitat speichern` erstellen.
🔊 Die letzten 30 Sekunden Audio werden automatisch gespeichert.
```

#### `/voice-recording stop`
Stop recording in your voice channel.

```
⏹️ Voice-Aufnahme in **Gaming-Channel** wurde gestoppt.
```

#### `/voice-recording status`
Check active recordings.

```
🎙️ **Aktive Voice-Aufnahmen:**

📢 **Gaming-Channel** - 4 User werden aufgenommen
📢 **Chill-Zone** - 2 User werden aufgenommen
```

### Usage Workflow

1. **Start Recording**
   ```
   1. Join voice channel
   2. /voice-recording start
   3. Bot joins and starts recording
   ```

2. **Save Quotes**
   ```
   1. Someone says something funny
   2. /voice-zitat speichern nutzer:@User text:"Quote"
   3. Last 30 seconds saved as MP3
   ```

3. **Playback**
   ```
   1. /voice-zitat anzeigen
   2. Quote displays with audio attachment
   3. Download and listen
   ```

4. **Stop Recording**
   ```
   1. /voice-recording stop
   2. Bot leaves channel
   ```

### Performance

**Memory Usage:**
- Per User: ~11.5 MB for 30-second buffer
- Example: 10-user channel = ~115 MB

**Disk Usage:**
- Per Quote: ~500-700 KB (30-second MP3)
- 100 Quotes: ~50-70 MB
- 1000 Quotes: ~500-700 MB

**Audio Storage:**
- Location: `data/voice-quotes/`
- Format: `quote_{userId}_{timestamp}.mp3`

### Technical Details

**Voice Recorder Module:** `src/utils/voiceRecorder.js`

**Classes:**
- `VoiceRecorder` - Channel recording manager
- `CircularAudioBuffer` - 30-second buffer per user

**Audio Pipeline:**
1. Capture: Discord audio (Opus)
2. Decode: Opus → PCM
3. Buffer: Store last 30 seconds
4. Save: PCM → temporary file
5. Encode: FFmpeg → MP3
6. Cleanup: Remove temp files

---

## Gaming Integration

### Account Linking

Link your gaming accounts:

```
/link platform:steam id:YourSteamID
/arcraiders link player_id:YourPlayerID
```

**Supported Platforms:**
- Steam ✅
- Rainbow Six Siege (PC/PSN/Xbox)
- Battlefield 6 (PC/PSN/Xbox)
- For Honor (PC/PSN/Xbox)
- Destiny 2 (Steam/PSN/Xbox)
- Valorant
- Arc Raiders ✅

### Gaming Stats

Display player statistics:

```
/stats
/arcraiders stats
```

**Steam Stats:**
- Profile summary
- Recently played games
- Playtime statistics

**Arc Raiders Stats:**
- Total extractions
- Success rate
- Kills and damage
- Loot statistics
- Coins earned

### Arc Raiders Integration

**Features:**
- Automatic extraction tracking (every 10 minutes)
- Loot analysis by rarity
- Coin rewards based on performance
- Squad tracking
- Leaderboards

**Coin Rewards:**
- Base: 50 coins per extraction
- Kills: 5 coins each
- Rare loot: 10 coins
- Epic loot: 25 coins
- Legendary loot: 50 coins
- Survival: 1 coin per minute

**Example:**
```
✅ ERFOLGREICHE EXTRACTION!

@Player hat erfolgreich extrahiert in Arc Raiders!

💀 Kills: 7
⏱️ Überlebenszeit: 18m 30s
🎁 Loot: 23 Items

✨ Highlights
🟠 2 Legendär • 🟣 5 Episch • 🔵 8 Selten

👥 Squad
PlayerName, Teammate1, Teammate2

💰 Belohnung: +275 Coins
```

---

## Economy & Betting

### Currency System

**Earning Coins:**
- Starting balance: 100 coins
- Daily rewards: 50+ coins
- Streak bonus: +10-100 coins
- Extraction rewards: Variable
- Betting wins: Pool distribution

**Commands:**
- `/balance` - Check balance
- `/daily` - Claim daily reward

**Daily Rewards:**
```
💰 Tägliche Belohnung!

Du hast 150 Coins erhalten!
📊 Streak: 5 Tage
✨ Bonus: +100 Coins
```

### Betting System

Create and participate in bets:

**Commands:**
- `/wette erstellen` - Create bet
- `/wette platzieren` - Place bet
- `/wette liste` - Active bets
- `/wette info` - Bet details
- `/wette beenden` - Resolve bet

**Bet Types:**
- Match outcome
- K/D predictions
- Arc Raiders extractions
- Custom bets

**Example:**
```
/wette erstellen titel:"Match Outcome" typ:match_result dauer:60

/wette platzieren bet_id:1 choice:ja amount:100
```

**Automatic Resolution:**
- K/D bets resolve from match data
- Extraction bets resolve from Arc Raiders API
- Winners share pool proportionally

---

## Squad Assembly (LFG)

### Smart Squad Matching

Find players for your games:

```
/assemble game:Valorant
```

**Features:**
- Status-based prioritization
- Game subscription system
- Dynamic join/leave buttons
- Squad size limits

**Priority System:**
- Playing game: 20 points
- Online: 10 points
- Offline: 0 points

### Game Subscriptions

Manage game preferences:

```
/abo subscribe game:Valorant
/abo unsubscribe game:Valorant
/abo list
```

---

## Utilities & Mini-Games

### Event Scheduling

Create polls for gaming sessions:

```
/schedule titel:"Valorant Session" zeit:20:00 datum:2026-01-20
```

**Features:**
- Discord timestamp formatting
- Yes/No reactions (✅/❌)
- Automatic timezone handling

### Russian Roulette

Try your luck:

```
/roulette
```

**Mechanics:**
- 1/6 chance of timeout
- 60-second timeout on loss
- Harmless fun

---

# Commands Reference

## Complete Command List (22 Commands)

### Quote System
- `/merken` - Save text quote
- `/zitat` - Display/search/edit text quotes
- `/fail` - Display/save fail moments
- `/ranking` - View leaderboards
- `/suche` - Search quotes
- `/tags` - Manage tags
- `/manage_quote` - Quote CRUD operations

### Voice Quotes ✨NEW
- `/voice-zitat` - Manage voice quotes
  - `speichern` - Save voice quote
  - `anzeigen` - Display voice quote
  - `suchen` - Search voice quotes
  - `löschen` - Delete voice quote
- `/voice-recording` - Audio recording ✨NEW
  - `start` - Start recording
  - `stop` - Stop recording
  - `status` - Check status

### Gaming
- `/link` - Link gaming accounts
- `/stats` - Display gaming stats
- `/arcraiders` - Arc Raiders integration
  - `link` - Link account
  - `stats` - View stats
  - `leaderboard` - Top players

### Economy
- `/balance` - Check coin balance
- `/daily` - Claim daily reward
- `/wette` - Betting system
  - `erstellen` - Create bet
  - `platzieren` - Place bet
  - `liste` - Active bets
  - `info` - Bet details
  - `beenden` - Resolve bet

### Squad & Utility
- `/assemble` - Squad assembly (LFG)
- `/abo` - Game subscriptions
- `/schedule` - Event scheduling
- `/roulette` - Russian Roulette

### Admin
- `/config` - Bot configuration
- `/info` - Help system
- `/ping` - Check latency

---

# Database Schema

## Tables Overview

### quotes
Text chat quotes.

```sql
CREATE TABLE quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    quote_text TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    added_by TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    image_url TEXT,
    tags TEXT
);
```

### voice_quotes ✨NEW
Voice chat quotes with audio.

```sql
CREATE TABLE voice_quotes (
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
);
```

### user_coins
Economy system balances.

```sql
CREATE TABLE user_coins (
    user_id TEXT PRIMARY KEY,
    coins INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    last_daily DATETIME,
    daily_streak INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### bets
Betting system.

```sql
CREATE TABLE bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    bet_type TEXT NOT NULL,
    target_user_id TEXT,
    target_value REAL,
    closes_at DATETIME,
    resolved BOOLEAN DEFAULT 0,
    winning_option TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### arc_extractions
Arc Raiders tracking.

```sql
CREATE TABLE arc_extractions (
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
);
```

---

# API Integration

## Discord API
- **Status:** ✅ Active
- **Version:** discord.js v14
- **Intents:** Guilds, Messages, Reactions, MessageContent, Presences

## Steam API
- **Status:** ✅ Active
- **Endpoint:** `https://api.steampowered.com`
- **Features:** Player summaries, recent games

## Tracker.gg API
- **Status:** ⏳ Pending Approval
- **Endpoint:** `https://api.tracker.gg`
- **Features:** Valorant, R6, BF6, For Honor, D2 stats

## Arc Raiders API
- **Status:** 🔄 Placeholder Implementation
- **Endpoint:** Configurable in `.env`
- **Features:** Extraction tracking, loot analysis

---

# Troubleshooting

## Common Issues

### Bot Won't Start

**Symptoms:**
- Bot doesn't come online
- PM2 shows "errored" status

**Solutions:**
```bash
# Check logs
pm2 logs VagaBot --err

# Verify dependencies
npm install

# Check .env file
cat .env

# Redeploy commands
npm run deploy
```

### Voice Recording Issues

**Problem:** Audio not saving

**Solutions:**
1. Start recording: `/voice-recording start`
2. Check bot in voice channel
3. Verify permissions (Connect, Speak, Use Voice Activity)
4. Check `data/voice-quotes/` directory exists

**Problem:** FFmpeg errors

**Solutions:**
```bash
# Verify ffmpeg-static installed
npm list ffmpeg-static

# Reinstall if needed
npm install ffmpeg-static --legacy-peer-deps
```

### Database Issues

**Problem:** Quotes not saving

**Solutions:**
```bash
# Check database file
ls -l data/database.db

# Backup and recreate
cp data/database.db data/database-backup.db
rm data/database.db
npm start  # Will recreate tables
```

### High Memory Usage

**Problem:** Bot using too much RAM

**Solutions:**
```bash
# Check memory
pm2 status

# Stop unused recordings
/voice-recording stop

# Increase PM2 limit
# Edit ecosystem.config.js:
max_memory_restart: '1G'

# Restart
pm2 restart VagaBot --update-env
```

### Commands Not Showing

**Problem:** Slash commands not visible in Discord

**Solutions:**
```bash
# Redeploy commands
npm run deploy

# Wait 5-10 minutes for Discord cache
# Or restart Discord client
```

---

# Security & Privacy

## Best Practices

### Environment Security
- Never commit `.env` to git
- Use strong bot token
- Rotate API keys regularly
- Restrict bot permissions to minimum required

### Data Protection
- Regular database backups
- Secure audio file storage
- GDPR compliance for EU users
- User data deletion on request

### Voice Recording Privacy

**Important Considerations:**
1. **User Consent** - Announce when recording is active
2. **Data Storage** - Audio files contain voice recordings
3. **Access Control** - Only admins can start/stop recording
4. **Retention** - Implement automatic deletion policies
5. **Transparency** - Make users aware of recording

**Recommended Policies:**
- Display recording status in channel topic
- Provide opt-out mechanism
- Auto-delete audio after 30 days
- Secure file permissions (owner-only read)
- Comply with regional privacy laws

### Backups

```bash
# Daily database backup
cp data/database.db data/database-backup-$(date +%Y%m%d).db

# Weekly full backup
tar -czf vagabot-backup-$(date +%Y%m%d).tar.gz data/ .env

# Backup audio files
rsync -av data/voice-quotes/ backup/voice-quotes/
```

---

# Future Enhancements

## Planned Features

### Phase 7 Remaining
- [ ] **Patch News Feed** - Automatic game update notifications
- [ ] **Free Games Alert** - Epic/Steam/Xbox free game tracking
- [ ] **Game Server Status** - Live server monitoring (Ark, Minecraft, Rust)
- [ ] **Video Clip Recording** - Save gameplay clips via voice/text command
- [ ] **Coin Flip** - Simple betting mini-game
- [ ] **Dice Roll** - Dice betting game

### Voice Recording Enhancements
- [ ] Configurable recording duration (15s, 30s, 60s)
- [ ] Automatic cleanup of old audio files
- [ ] Audio quality settings (bitrate selection)
- [ ] Voice activity detection (only record when speaking)
- [ ] Multi-user audio mixing (combine multiple users)
- [ ] Audio waveform visualization
- [ ] Direct playback in voice channel
- [ ] Replay command to play quotes in voice
- [ ] Audio editing (trim, adjust volume)

### Long-Term Ideas
- Discord Activity API integration
- Voice channel activity rewards
- Tournament bracket system
- Custom role rewards for achievements
- Seasonal events
- Limited-time challenges
- Machine learning quote suggestions
- Voice-to-text transcription for quotes

---

# Appendix

## File Locations

- **Main Bot:** `src/index.js`
- **Database:** `src/database.js`
- **Commands:** `src/commands/*.js`
- **Utilities:** `src/utils/*.js`
- **SQLite DB:** `data/database.db`
- **Audio Files:** `data/voice-quotes/` ✨NEW
- **Logs:** `logs/out.log`, `logs/error.log`
- **Config:** `.env`, `ecosystem.config.js`

## Support Resources

- **Discord.js Guide:** https://discordjs.guide
- **Discord.js Docs:** https://discord.js.org
- **Steam API Docs:** https://steamcommunity.com/dev
- **Tracker.gg Developers:** https://tracker.gg/developers
- **PM2 Documentation:** https://pm2.keymetrics.io
- **FFmpeg Documentation:** https://ffmpeg.org/documentation.html

## Version History

- **v2.0.0** (2026-01-18) - Voice audio recording, enhanced voice quotes
- **v1.0.0** (2026-01-18) - Voice Chat Quote Book
- **v0.9.0** (2026-01-16) - Economy & betting system, Arc Raiders integration
- **v0.8.0** - Deployment (PM2), 24/7 operation
- **v0.7.0** - Utilities & mini-games
- **v0.6.0** - Gaming stats & API integration
- **v0.5.0** - Squad assembly (LFG)
- **v0.4.0** - Quote system enhancements
- **v0.3.0** - Basic quote system
- **v0.2.0** - Discord bot framework
- **v0.1.0** - Initial setup

---

**Made with ❤️ for the VagaBot Gaming Community**

**Contributors:** VagaBot Development Team
**License:** ISC
**Repository:** https://github.com/Stavian/VagaBot (if applicable)

---

*This documentation consolidates all VagaBot markdown files into a single comprehensive guide.*
*Last consolidated: 2026-01-18*
