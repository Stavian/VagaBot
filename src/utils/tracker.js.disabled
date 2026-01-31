const axios = require('axios');

const BASE_URL = 'https://public-api.tracker.gg/api/v1';

module.exports = {
    /**
     * Get profile data from Tracker Network
     * @param {string} game - The game slug (e.g., 'valorant', 'apex', 'fortnite')
     * @param {string} platform - The platform (e.g., 'riot', 'origin', 'psn', 'xbl')
     * @param {string} identifier - The user identifier (e.g., Name#TAG for Riot)
     */
    getProfile: async (game, platform, identifier) => {
        if (!process.env.TRN_API_KEY) return null;
        
        // Tracker Network encodes the identifier (crucial for Name#Tag)
        const encodedId = encodeURIComponent(identifier);
        const url = `${BASE_URL}/${game}/standard/profile/${platform}/${encodedId}`;

        try {
            const response = await axios.get(url, {
                            headers: {
                                'TRN-Api-Key': process.env.TRN_API_KEY.trim(),
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }            });
            return response.data.data;
        } catch (error) {
            console.error(`[TRN API] Error fetching ${game} stats:`, error.response?.status || error.message);
            return null;
        }
    },

    /**
     * Get recent matches for a user
     */
    getRecentMatches: async (game, platform, identifier) => {
        if (!process.env.TRN_API_KEY) return [];
        
        const encodedId = encodeURIComponent(identifier);
        const url = `${BASE_URL}/${game}/standard/matches/${platform}/${encodedId}`;

        try {
            const response = await axios.get(url, {
                            headers: {
                                'TRN-Api-Key': process.env.TRN_API_KEY.trim(),
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }            });
            return response.data.data.matches || [];
        } catch (error) {
            console.error(`[TRN API] Error fetching ${game} matches:`, error.response?.status || error.message);
            return [];
        }
    }
};
