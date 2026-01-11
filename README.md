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