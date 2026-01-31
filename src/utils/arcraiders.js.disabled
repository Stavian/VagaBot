const axios = require('axios');

/**
 * Arc Raiders API Utility
 * Handles fetching extraction data from Arc Raiders API
 *
 * NOTE: This is a placeholder implementation. Replace with actual Arc Raiders API endpoints
 * when available. You may need to adjust based on official API documentation.
 */

const ARC_RAIDERS_API_BASE = process.env.ARC_RAIDERS_API_URL || 'https://api.arcraiders.com/v1';
const ARC_RAIDERS_API_KEY = process.env.ARC_RAIDERS_API_KEY;

/**
 * Fetch recent extractions for a player
 * @param {string} playerId - Arc Raiders player ID or username
 * @returns {Promise<Array>} Array of recent extraction sessions
 */
async function getRecentExtractions(playerId) {
    if (!ARC_RAIDERS_API_KEY) {
        console.log('[Arc Raiders] API key not configured');
        return [];
    }

    try {
        const response = await axios.get(`${ARC_RAIDERS_API_BASE}/players/${playerId}/extractions`, {
            headers: {
                'Authorization': `Bearer ${ARC_RAIDERS_API_KEY}`,
                'Content-Type': 'application/json'
            },
            params: {
                limit: 10,
                sort: 'desc'
            },
            timeout: 10000
        });

        return response.data.extractions || [];
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('[Arc Raiders] API authentication failed');
        } else if (error.response?.status === 404) {
            console.log(`[Arc Raiders] Player not found: ${playerId}`);
        } else {
            console.log(`[Arc Raiders] Error fetching extractions: ${error.message}`);
        }
        return [];
    }
}

/**
 * Fetch player profile and stats
 * @param {string} playerId - Arc Raiders player ID or username
 * @returns {Promise<Object|null>} Player profile data
 */
async function getPlayerProfile(playerId) {
    if (!ARC_RAIDERS_API_KEY) {
        console.log('[Arc Raiders] API key not configured');
        return null;
    }

    try {
        const response = await axios.get(`${ARC_RAIDERS_API_BASE}/players/${playerId}`, {
            headers: {
                'Authorization': `Bearer ${ARC_RAIDERS_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.log(`[Arc Raiders] Error fetching player profile: ${error.message}`);
        return null;
    }
}

/**
 * Parse extraction data and calculate rewards
 * @param {Object} extraction - Raw extraction data from API
 * @returns {Object} Parsed extraction with calculated values
 */
function parseExtraction(extraction) {
    // Example extraction structure - adjust based on actual API response
    const {
        id,
        player_id,
        player_name,
        timestamp,
        success,
        survival_time,
        kills,
        damage_dealt,
        loot = [],
        squad = []
    } = extraction;

    // Calculate rarity counts
    const rarityCount = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0
    };

    loot.forEach(item => {
        const rarity = (item.rarity || 'common').toLowerCase();
        if (rarityCount.hasOwnProperty(rarity)) {
            rarityCount[rarity]++;
        }
    });

    // Calculate coin reward based on performance
    let coinReward = 0;
    if (success) {
        coinReward += 50; // Base extraction reward
        coinReward += kills * 5; // 5 coins per kill
        coinReward += rarityCount.rare * 10;
        coinReward += rarityCount.epic * 25;
        coinReward += rarityCount.legendary * 50;

        // Survival time bonus (1 coin per minute)
        if (survival_time) {
            coinReward += Math.floor(survival_time / 60);
        }
    }

    return {
        id,
        player_id,
        player_name,
        timestamp: new Date(timestamp),
        success,
        survival_time,
        kills: kills || 0,
        damage_dealt: damage_dealt || 0,
        loot_count: loot.length,
        rarity_count: rarityCount,
        squad_size: squad.length,
        squad_members: squad.map(s => s.player_name || s.player_id),
        coin_reward: coinReward
    };
}

/**
 * Format survival time in human-readable format
 * @param {number} seconds - Survival time in seconds
 * @returns {string} Formatted time string
 */
function formatSurvivalTime(seconds) {
    if (!seconds) return '0m 0s';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get rarity emoji and color
 * @param {string} rarity - Rarity level
 * @returns {Object} Emoji and color code
 */
function getRarityDisplay(rarity) {
    const displays = {
        common: { emoji: '⚪', color: '#999999', name: 'Gewöhnlich' },
        uncommon: { emoji: '🟢', color: '#00ff00', name: 'Ungewöhnlich' },
        rare: { emoji: '🔵', color: '#0099ff', name: 'Selten' },
        epic: { emoji: '🟣', color: '#a335ee', name: 'Episch' },
        legendary: { emoji: '🟠', color: '#ff8000', name: 'Legendär' }
    };

    return displays[rarity?.toLowerCase()] || displays.common;
}

module.exports = {
    getRecentExtractions,
    getPlayerProfile,
    parseExtraction,
    formatSurvivalTime,
    getRarityDisplay
};
