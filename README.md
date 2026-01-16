# PROJECT: Custom Discord Bot for Small Gaming Group
# GOAL: Enhance the "hangout" vibe, automate scheduling, and track inside jokes.

---

## PHASE 1: CORE SETUP (Foundation)
Objective: Get the bot running and responding to basic inputs.
[x] Choose Language: Python (discord.py) OR JavaScript (discord.js).
[x] Developer Portal: Create App, Create Bot User, Copy Token.
[x] Permissions: Generate invite link (Scope: bot, applications.commands).
    - **Recommended Permissions:** View Channels, Send Messages, Embed Links, Read Message History, Manage Roles (for LFG features).
[x] Code Base: Set up main file (main.py/index.js) and config file (.env for Token).
[x] Database: specific a simple local database (SQLite) or JSON file to store data.

## PHASE 2: THE "INSIDE JOKE" DATABASE (Priority Feature)
Objective: A system to save and recall funny moments.
[x] Database Schema: Table `quotes` (id, user_id, quote_text, timestamp, added_by).
[x] Command `/merken` (Enhanced):
    - Inputs: @user, "text", tags, image attachment.
    - Action: Save to DB with strict permission checks.
[x] Command `/zitat`:
    - Logic: Pick a random row from DB and display in an Embed.
[x] Command `/fail`:
    - Logic: Fetch a quote specifically tagged as a "fail" or from a specific target user.
[x] **NEW:** Reaction Saving (💾): Save quotes by reacting to messages.
[x] **NEW:** Leaderboards (`/ranking`): See top fails, most quoted users, and top contributors.
[x] **NEW:** Search (`/suche`): Find quotes by keyword.
[x] **NEW:** Tag Management (`/tags`, Permission-locked creation).

## PHASE 3: THE SQUAD ASSEMBLER (LFG)
Objective: Gather players for specific games without spamming everyone.
[x] Role Setup: Ensure Discord roles exist for games (e.g., "Valorant", "Minecraft").
[x] Command `/assemble`:
    - Input: select list of games.
    - Action: Ping the specific Role.
    - Feature: Send an Embed with a "Join Party" button.
[x] Button Logic:
    - On Click: Add username to the Embed list (0/5 -> 1/5).
    - Limit: Prevent >5 players if the game doesn't support it.

## PHASE 4: STATS & SHAME (API Integration)
Objective: Connect to game data for banter.
[x] Accounts: Get API Keys (Riot Games, Steam, etc.).
[x] Link Accounts: Command `/link [riot_id]` to save user's game ID to their Discord ID.
[x] Command `/stats`: Fetch recent match KDA/Winrate.
[x] Auto-Post (Advanced):
    - Check match history every 10 mins.
    - Logic: If KDA < 0.5 -> Post "Trash" meme.
    - Logic: If KDA > 3.0 -> Post "MVP" meme.

## PHASE 5: UTILITY & MINI-GAMES
Objective: Tools for scheduling and queue-time fun.
[x] Command `/schedule`:
    - Input: Time/Day.
    - Action: Create a formatted Poll (React with ✅ for Yes, ❌ for No).
[x] Timezone logic: Use Discord timestamp formatting (<t:timestamp:R>) so it shows correct time for everyone.
[x] Mini-Game: "Russian Roulette"
    - Command: `/roulette`
    - Logic: 1/6 chance to timeout the user for 60 seconds.

## PHASE 6: DEPLOYMENT
Objective: Keep the bot online 24/7.
[ ] Hosting: Deploy to a VPS, Heroku, or a text Raspberry Pi.
[ ] Logging: Create a private channel `#bot-logs` for errors.
[ ] Status: Set Bot Status to "Watching the Squad".

## PHASE 7: ADVANCED FEATURES & COMMUNITY ENGAGEMENT
Objective: Add advanced automation, economy system, and enhanced community features.

### News & Alerts
[ ] **Patch News Feed** (`/patchnews`):
    - Automatic feed for game updates (nur relevante Spiele)
    - Fetches patch notes from official APIs/RSS feeds
    - Filters for subscribed games only
    - Posts to dedicated #patch-news channel
    - Supported games: Valorant, R6 Siege, Battlefield, Destiny 2, etc.

[ ] **Free Games Alert** (`/freegames`):
    - Automatic notifications when games become free
    - Monitors: Epic Games Store, Steam, Xbox Game Pass, PlayStation Plus
    - Posts alerts to #free-games channel with claim links
    - Optional: User subscriptions for specific platforms

### Economy & Betting System
[ ] **Currency System**:
    - Coins earned through activity (messages, voice time, game participation)
    - Daily rewards and streak bonuses
    - Command `/balance` - Check your coin balance
    - Command `/daily` - Claim daily reward
    - Command `/leaderboard coins` - Top coin holders

[ ] **Betting System** (`/wette`):
    - Place bets on match outcomes (squad vs. squad)
    - Bet on individual player performance (K/D predictions)
    - Command `/wette erstellen` - Create a bet (match outcome, K/D threshold)
    - Command `/wette platzieren` - Place coins on a bet
    - Command `/wette liste` - View active bets
    - Automatic payout based on `/stats` API data
    - Integration with automated monitoring system

### Enhanced Quote System
[ ] **Voice Chat Quote Book** (`/voice-zitat`):
    - Save quotes from voice chat conversations
    - Manual entry: `/voice-zitat @user "quote text"`
    - Timestamp and voice channel recorded
    - Separate leaderboard for voice quotes
    - Integration with existing quote ranking system

### Server Monitoring
[ ] **Game Server Status** (`/serverstatus`):
    - Live status display for community servers
    - Supported: Ark, Minecraft, Rust, etc.
    - Shows: Online/Offline, Player count, Server version
    - Command `/serverstatus ark` - Check Ark server
    - Command `/serverstatus minecraft` - Check Minecraft server
    - Auto-refresh embed with current status
    - Alerts when server goes online/offline

### Additional Mini-Games
[ ] **Coin Flip** (`/coinflip [bet]`):
    - Simple heads/tails betting game
    - Bet coins on outcome

[ ] **Dice Roll** (`/roll [sides] [bet]`):
    - Roll dice and bet on outcomes
    - Supports various dice types (d6, d20, etc.)

---

## FUTURE ENHANCEMENTS (Backlog)
- Integration with Discord Activity API
- Voice channel activity rewards
- Tournament bracket system
- Custom role rewards for achievements
- Seasonal events and limited-time challenges