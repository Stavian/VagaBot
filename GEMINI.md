# Project: VagaBot

**VagaBot** is a custom Discord bot designed for a small gaming group. It focuses on enhancing the social atmosphere ("hangout vibe"), automating scheduling, and tracking "inside jokes" via a quote database. The bot is fully localized in **German**.

## 🛠 Tech Stack & Architecture

*   **Runtime:** Node.js
*   **Framework:** `discord.js` (v14+)
*   **Database:** SQLite (via `better-sqlite3`) for local, persistent data storage.
*   **Architecture:**
    *   **Entry Point:** `src/index.js` - Initializes the client, loads slash commands dynamically, and handles interactions.
    *   **Commands:** `src/commands/*.js` - Individual command logic (Slash Commands).
    *   **Data Layer:** `src/database.js` - Abstraction layer for SQLite operations (creating tables, inserting/fetching quotes).
    *   **Storage:** `data/database.db` - The actual SQLite database file.

## 🚀 Building and Running

### Prerequisites
*   Node.js installed.
*   A Discord Bot Token (from Developer Portal).

### Setup
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configuration:**
    *   Rename `.env.example` to `.env`.
    *   Fill in `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`.
3.  **Register Commands:**
    *   Must be run whenever new commands are added or changed.
    ```bash
    npm run deploy
    ```
4.  **Run the Bot:**
    ```bash
    npm start
    ```

## 📂 Project Structure

*   `src/`
    *   `commands/` - Contains command modules (e.g., `ping.js`, `merken.js`, `zitat.js`, `fail.js`).
    *   `database.js` - Handles database connections and queries.
    *   `deploy-commands.js` - Script to register slash commands with Discord API.
    *   `index.js` - Main bot application.
*   `data/` - Directory for storing the SQLite database (`database.db`).
*   `.env` - Secrets and configuration (Not committed).

## 📝 Development Conventions

*   **Language:** The bot's output text is in **German**.
*   **Commands:** All commands are Slash Commands (`/command`).
*   **Permissions:** The bot operates with minimal required permissions (Principle of Least Privilege). It specifically avoids the "Administrator" permission.
    *   *Required Intents:* `Guilds`, `GuildMessages`. (Note: `MessageContent` is currently disabled as it is a privileged intent not yet needed).

## 📅 Status & Roadmap

Refer to `README.md` for the detailed multi-phase roadmap.
*   **Current Status:** Phase 2 Complete (Core Setup + "Inside Joke" Database).
*   **Next Phase:** Phase 3 (The Squad Assembler / LFG Features).
