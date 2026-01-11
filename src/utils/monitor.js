const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const trackerUtils = require('./tracker');

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 Minutes

async function startMonitoring(client) {
    console.log('[Monitor] Gaming-Monitor gestartet.');
    
    setInterval(async () => {
        const logChannelId = db.getConfig('bot_log_channel_id');
        if (!logChannelId) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        // Check each game and platform combination
        const checkList = [
            { game: 'siege', plat: 'uplay', dbKey: 'r6_uplay' },
            { game: 'siege', plat: 'psn', dbKey: 'r6_psn' },
            { game: 'siege', plat: 'xbl', dbKey: 'r6_xbl' },
            { game: 'bf6', plat: 'origin', dbKey: 'bf6_origin' },
            { game: 'bf6', plat: 'psn', dbKey: 'bf6_psn' },
            { game: 'bf6', plat: 'xbl', dbKey: 'bf6_xbl' },
            { game: 'for-honor', plat: 'uplay', dbKey: 'fh_uplay' },
            { game: 'for-honor', plat: 'psn', dbKey: 'fh_psn' },
            { game: 'for-honor', plat: 'xbl', dbKey: 'fh_xbl' },
            { game: 'destiny-2', plat: 'steam', dbKey: 'd2_steam' },
            { game: 'destiny-2', plat: 'psn', dbKey: 'd2_psn' },
            { game: 'destiny-2', plat: 'xbl', dbKey: 'd2_xbl' },
            { game: 'valorant', plat: 'riot', dbKey: 'valorant' }
        ];

        for (const item of checkList) {
            await checkPlatform(channel, item.game, item.plat, item.dbKey);
        }
    }, CHECK_INTERVAL);
}

async function checkPlatform(channel, game, platform, dbKey) {
    const links = db.getAllLinksForPlatform(dbKey);

    for (const link of links) {
        const matches = await trackerUtils.getRecentMatches(game, platform, link.external_id);
        if (!matches || matches.length === 0) continue;

        const latestMatch = matches[0];
        const lastSeenMatchId = db.getLastMatch(link.user_id, link.platform);

        if (latestMatch.attributes.id !== lastSeenMatchId) {
            db.setLastMatch(link.user_id, link.platform, latestMatch.attributes.id);
            
            const stats = latestMatch.segments[0].stats;
            const kd = stats.kdRatio?.value || 0;
            const kills = stats.kills?.value || 0;
            const deaths = stats.deaths?.value || 0;

            if (kd < 0.5 && deaths > 5) {
                await postMeme(channel, link.user_id, 'trash', kd, kills, deaths, game);
            } else if (kd > 3.0 && kills > 10) {
                await postMeme(channel, link.user_id, 'mvp', kd, kills, deaths, game);
            }
        }
    }
}

async function postMeme(channel, userId, type, kd, kills, deaths, game) {
    const user = `<@${userId}>`;
    const embed = new EmbedBuilder();

    const gameDisplay = game === 'siege' ? 'Rainbow Six' : 
                        game === 'bf6' ? 'Battlefield 6' : 
                        game === 'for-honor' ? 'For Honor' : 
                        game === 'destiny-2' ? 'Destiny 2' : game;

    if (type === 'trash') {
        embed.setColor('#ff0000')
            .setTitle('🗑️ TRASH DETECTED')
            .setDescription(`${user} hat gerade absolut reingeschissen in **${gameDisplay}**.\n\n**K/D:** ${kd.toFixed(2)} (${kills}/${deaths})\n\n"Geh doch lieber Farm Simulator spielen..."`)
            .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z6eXN6eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/2w6IDqKQbakM0/giphy.gif');
    } else {
        embed.setColor('#00ff00')
            .setTitle('🔥 MVP ALERT')
            .setDescription(`${user} hat gerade rasiert in **${gameDisplay}**!\n\n**K/D:** ${kd.toFixed(2)} (${kills}/${deaths})\n\n"Der Junge hat Aim-Bot an!"`)
            .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z6eXN6eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l41lTjJp9N6z6z5G8/giphy.gif');
    }

    await channel.send({ content: user, embeds: [embed] });
}

module.exports = { startMonitoring };