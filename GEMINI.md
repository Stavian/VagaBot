# Project: VagaBot

**Last Updated:** 2026-01-16

**VagaBot** is a custom Discord bot designed for a small gaming group. It focuses on enhancing the social atmosphere ("hangout vibe"), automating scheduling, and tracking "inside jokes" via a quote database. The bot is fully localized in **German**.

---

## 🛠 Tech Stack & Architecture

*   **Runtime:** Node.js
*   **Framework:** `discord.js` (v14+)
*   **Database:** SQLite (via `better-sqlite3`) for local, persistent data storage
*   **External APIs:** Steam API, Tracker.gg API
*   **Architecture:**
    *   **Entry Point:** `src/index.js` - Initializes the client, loads slash commands dynamically, and handles interactions (commands, buttons, autocomplete)
    *   **Commands:** `src/commands/*.js` - Individual command logic (15 Slash Commands)
    *   **Data Layer:** `src/database.js` - Abstraction layer for SQLite operations (creating tables, inserting/fetching quotes, handling config/subs)
    *   **Utils:** `src/utils/` - API wrappers (Steam, Tracker.gg) and monitoring service
    *   **Storage:** `data/database.db` - The actual SQLite database file

---

## 📂 Project Structure

```
VagaBot/
├── src/
│   ├── index.js                    # Main bot entry point, event handlers
│   ├── database.js                 # SQLite database layer with all CRUD operations
│   ├── deploy-commands.js          # Discord slash command deployment tool
│   ├── commands/                   # 15 slash command modules
│   │   ├── ping.js
│   │   ├── merken.js              # Quote saving
│   │   ├── zitat.js               # Random quote
│   │   ├── fail.js                # Roast quotes
│   │   ├── ranking.js             # Leaderboards
│   │   ├── suche.js               # Search quotes
│   │   ├── tags.js                # Tag management
│   │   ├── assemble.js            # Smart squad assembly
│   │   ├── abo.js                 # Game subscriptions
│   │   ├── config.js              # Admin configuration
│   │   ├── link.js                # Account linking
│   │   ├── stats.js               # Gaming statistics display
│   │   ├── schedule.js            # Event scheduling polls
│   │   ├── roulette.js            # Mini-game
│   │   └── manage_quote.js
│   └── utils/
│       ├── monitor.js             # Background match monitoring service
│       ├── tracker.js             # Tracker.gg API wrapper
│       └── steam.js               # Steam API wrapper
├── data/
│   └── database.db                # SQLite database file
├── .env                           # Environment configuration (not committed)
├── package.json
├── README.md                      # Multi-phase roadmap
└── GEMINI.md                      # This file
```

---

## 🚀 Building and Running

### Prerequisites
*   Node.js installed
*   A Discord Bot Token (from Developer Portal)
    *   **IMPORTANT:** The **Message Content Intent** AND **Presence Intent** must be enabled in the Discord Developer Portal

### Setup
1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configuration:**
    *   The `.env` file has been created and configured with:
        - ✅ `DISCORD_TOKEN` - Bot authentication
        - ✅ `CLIENT_ID` - Application ID
        - ✅ `GUILD_ID` - Discord server ID
        - ✅ `STEAM_API_KEY` - Steam API access
        - ⏳ `TRN_API_KEY` - Tracker.gg API (pending approval)

3.  **Register Commands:**
    *   Must be run whenever new commands are added or changed
    ```bash
    node src/deploy-commands.js
    ```

4.  **Run the Bot:**
    ```bash
    node src/index.js
    ```

---

## ✅ Current Status (Phase 5 Complete)

### Fully Functional Features

#### **Phase 1 & 2: Core Setup & Inside Joke Database**
- **Quote System:**
  - `/merken` - Save quotes with user, text, category (General/Fail/Win), images, and tags
  - `/zitat` - Display random quotes (all or filtered by user)
  - `/fail` - Retrieve roast/fail moments with optional user targeting
  - `/suche` - Search quotes by keyword
  - Reaction saving via 💾 emoji

- **Leaderboards & Analytics:**
  - `/ranking` - Hall of Shame (most fails), most quoted users, top contributors (snitches)

- **Tag Management:**
  - `/tags` - Permission-based tag creation and management

#### **Phase 3: Smart Squad Assembly (LFG)**
- `/assemble` - Smart player matching system for forming gaming squads
  - Fetches subscribed players for selected games
  - Prioritizes players by status: Playing game (20pts) > Online (10pts) > Offline (0pts)
  - Join/leave buttons for dynamic squad building

- `/abo` - Game subscription management (subscribe/unsubscribe/list)
- `/config` - Admin commands with role-based access control

#### **Phase 4: Gaming Stats (Steam Active)**
- **Account Linking:**
  - `/link` - Connect Discord account to gaming platforms (14 supported platform variants):
    - Steam (fully functional)
    - Rainbow Six Siege (PC/PSN/Xbox) - ⏳ pending API
    - Battlefield 6 (PC/PSN/Xbox) - ⏳ pending API
    - For Honor (PC/PSN/Xbox) - ⏳ pending API
    - Destiny 2 (Steam/PSN/Xbox) - ⏳ pending API
    - Valorant - ⏳ pending API

- **Gaming Statistics:**
  - `/stats` - Fetch and display player stats:
    - ✅ Steam API integration (profile summary, recently played games) - **WORKING**
    - ⏳ Tracker.gg API integration (K/D, ranks, winrates) - **PENDING APPROVAL**

- **Automated Monitoring:**
  - Background service configured (ready when Tracker.gg approves)
  - Will check match history every 10 minutes
  - Auto-posts "TRASH" meme if K/D < 0.5 and deaths > 5
  - Auto-posts "MVP" meme if K/D > 3.0 and kills > 10

#### **Phase 5: Utility & Mini-Games**
- `/schedule` - Create poll for gaming sessions with Yes/No reactions (✅/❌)
- `/roulette` - Russian Roulette minigame (1/6 chance of 60-second timeout)

---

## 🔧 Recent Code Updates (Steam-Only Fallback Implementation)

### Modified Files

#### **1. `src/commands/stats.js`**
**Changes:**
- Added graceful error handling for Tracker.gg API unavailability
- Shows informative message when API is pending approval
- Steam stats work immediately
- Competitive game stats display friendly "pending" message

**User Experience:**
```
Before (401 error):
❌ Fehler beim Abrufen der Daten. Profile öffentlich?

After (graceful fallback):
⏳ Valorant Stats
Account: Username#TAG

⚠️ Tracker.gg API-Zugriff steht noch aus.
Die Stats für Valorant sind verfügbar, sobald die API-Genehmigung erteilt wurde.

Aktuelle Funktionen:
✅ Steam Stats verfügbar
⏳ Competitive Stats (Tracker.gg) in Warteschlange
```

#### **2. `src/utils/monitor.js`**
**Changes:**
- Added startup check for Tracker.gg API key
- Enhanced logging to show monitoring status
- Added try-catch error handling in `checkPlatform()`
- Gracefully skips matches when API is unavailable
- Will automatically work once API is approved (no code changes needed)

**Console Output:**
```
[Monitor] Gaming-Monitor gestartet.
[Monitor] Tracker.gg API-Schlüssel gefunden. Match-Überwachung wird alle 10 Minuten ausgeführt.
[Monitor] Starte Match-Check...
[Monitor] Überspringe valorant/riot für Username#TAG (API möglicherweise nicht verfügbar)
```

---

## 📊 API Status Monitor

| Service | Status | Functionality |
|---------|--------|---------------|
| Discord API | ✅ Active | All bot commands |
| Steam API | ✅ Active | Player summaries, recent games |
| Tracker.gg API | ⏳ Pending Approval | Valorant, R6, BF6, For Honor, D2 stats |

### Tracker.gg API Status
- **Application Status:** Submitted and awaiting review
- **Expected Timeline:** 24-72 hours (can vary)
- **Impact:** Competitive game stats and automated monitoring unavailable until approved
- **When Approved:** Bot will automatically start working (no code changes required)

---

## 📝 Development Conventions

*   **Language:** The bot's output text is in **German**
*   **Commands:** All commands are Slash Commands (`/command`)
*   **Permissions:** The bot operates with minimal required permissions
    *   *Required Intents:* `Guilds`, `GuildMessages`, `GuildMessageReactions`, `MessageContent`, `GuildPresences`
*   **Security:**
    *   **Self-Save Prevention:** Users cannot save their own quotes
    *   **Tag Management:** Only designated roles (configured via `/config tag_role`) or Mods/Admins can create *new* tags
    *   **Config Management:** `/config` is restricted to Server Administrators OR roles explicitly added via `/config admin_role add`

---

## 🧪 Testing & Verification

### Current Test Results
```
✅ Bot Started Successfully
✅ Logged in as: VagaBot#7543
✅ 15 Slash Commands Deployed
✅ Gaming Monitor Active (will work when Tracker.gg approves)
```

### Test Commands
- ✅ `/ping` - Verify bot responds
- ✅ `/link steam YOUR_STEAM_ID` - Link Steam account
- ✅ `/stats` - Test Steam stats display (fully working)
- ⏳ `/stats` (with Valorant/R6) - Shows friendly "pending" message

---

## 🐛 Troubleshooting

### Bot Won't Start
```bash
# Check if all dependencies are installed
npm install

# Verify .env file exists and has no syntax errors
cat .env  # (or "type .env" on Windows)
```

### Commands Not Showing in Discord
```bash
# Re-register commands
node src/deploy-commands.js
```

### Steam Stats Not Working
- Verify `STEAM_API_KEY` is correct in `.env`
- Check Steam profile is public
- Ensure Steam ID format is correct (SteamID64 or vanity URL)

### Tracker.gg Stats Show "Pending"
- This is expected! API approval is still pending
- Once approved, stats will automatically work
- Monitor your email for Tracker.gg approval notification

---

## 🎯 Next Steps

### Immediate (Ready Now)
1. **Test Current Features:**
   - Use all quote commands (`/merken`, `/zitat`, `/fail`, `/ranking`)
   - Test squad assembly (`/assemble`, `/abo`)
   - Link and view Steam stats (`/link steam`, `/stats`)
   - Try utilities (`/schedule`, `/roulette`)

2. **Configure Bot-Logs Channel (Optional):**
   ```
   /config log_channel #bot-logs
   ```
   This enables automated monitoring when Tracker.gg API is approved

### After Tracker.gg Approval
- [ ] Test `/stats` with Valorant account
- [ ] Test `/stats` with R6 Siege account
- [ ] Test `/stats` with Battlefield 6 account
- [ ] Verify automated monitoring posts memes
- [ ] Check K/D detection triggers (trash-talk/MVP)

### Phase 6: Deployment (Next Major Phase)
- [ ] Choose hosting platform (Heroku, Railway, VPS, Raspberry Pi)
- [ ] Set up 24/7 hosting
- [ ] Configure bot status: "Watching the Squad"
- [ ] Set up error logging to bot-logs channel
- [ ] Implement automated backups for SQLite database
- [ ] Add monitoring/alerting for downtime

---

## 📞 Support Resources

- **Discord.js Guide:** https://discordjs.guide
- **Steam API Docs:** https://steamcommunity.com/dev
- **Tracker.gg Developers:** https://tracker.gg/developers
- **VagaBot Issues:** Check console logs for detailed error messages

---

## 📅 Development Roadmap

Refer to `README.md` for the complete multi-phase roadmap.

**Current Status:** Phase 5 Complete, Phase 4 Partially Complete (API pending)
- ✅ **Phases 1-3:** Fully complete
- ✅ **Phase 4:** Steam integration working, Tracker.gg pending approval
- ✅ **Phase 5:** All utility features complete
- ⏳ **Phase 6:** Deployment (ready to begin)

---

## 🎉 Success Criteria

The bot is considered **production-ready** when:
- ✅ All slash commands deploy successfully
- ✅ Quote system functions correctly
- ✅ Squad assembly works with online status detection
- ✅ Steam stats display properly
- ⏳ Tracker.gg stats display (pending API approval)
- ⏳ Automated monitoring posts memes (pending API approval)
- ⏳ Bot runs 24/7 on hosted infrastructure (Phase 6)

**Current Achievement:** 5 out of 7 criteria met (71% production-ready)
