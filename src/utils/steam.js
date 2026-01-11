const axios = require('axios');

const BASE_URL = 'http://api.steampowered.com';

module.exports = {
    /**
     * Resolve a Steam Vanity URL to a 64-bit Steam ID.
     * @param {string} vanityName - The custom URL part (e.g., 'gabelogannewell')
     * @returns {Promise<string|null>} - The Steam ID or null if not found.
     */
    resolveVanityUrl: async (vanityName) => {
        if (!process.env.STEAM_API_KEY) return null;
        try {
            const response = await axios.get(`${BASE_URL}/ISteamUser/ResolveVanityURL/v0001/`, {
                params: {
                    key: process.env.STEAM_API_KEY,
                    vanityurl: vanityName
                }
            });
            if (response.data.response.success === 1) {
                return response.data.response.steamid;
            }
            return null;
        } catch (error) {
            console.error('[Steam API] ResolveVanityURL Error:', error.message);
            return null;
        }
    },

    /**
     * Get basic profile info (avatar, name, status).
     * @param {string} steamId 
     */
    getPlayerSummary: async (steamId) => {
        if (!process.env.STEAM_API_KEY) return null;
        try {
            const response = await axios.get(`${BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/`, {
                params: {
                    key: process.env.STEAM_API_KEY,
                    steamids: steamId
                }
            });
            const players = response.data.response.players;
            return players.length > 0 ? players[0] : null;
        } catch (error) {
            console.error('[Steam API] GetPlayerSummaries Error:', error.message);
            return null;
        }
    },

    /**
     * Get recently played games (last 2 weeks).
     * @param {string} steamId 
     */
    getRecentlyPlayed: async (steamId) => {
        if (!process.env.STEAM_API_KEY) return null;
        try {
            const response = await axios.get(`${BASE_URL}/IPlayerService/GetRecentlyPlayedGames/v0001/`, {
                params: {
                    key: process.env.STEAM_API_KEY,
                    steamid: steamId,
                    count: 3,
                    format: 'json'
                }
            });
            return response.data.response.games || [];
        } catch (error) {
            console.error('[Steam API] GetRecentlyPlayedGames Error:', error.message);
            return [];
        }
    },
    
    /**
     * Check if input is likely a Vanity URL (not a 17-digit ID).
     */
    isVanityUrl: (input) => {
        return !/^\d{17}$/.test(input);
    }
};
