const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const trackerUtils = require('./tracker');

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 Minutes

async function startMonitoring(client) {
    console.log('[Monitor] Gaming-Monitor gestartet.');

    // Check if Tracker.gg API is available
    if (!process.env.TRN_API_KEY) {
        console.log('[Monitor] ⚠️ Tracker.gg API-Schlüssel fehlt. Match-Monitoring deaktiviert.');
        return;
    }

    console.log('[Monitor] Tracker.gg API-Schlüssel gefunden. Match-Überwachung wird alle 10 Minuten ausgeführt.');

    setInterval(async () => {
        const wettChannelId = db.getConfig('wett_channel_id');
        if (!wettChannelId) {
            console.log('[Monitor] Kein wett_channel_id konfiguriert. Nutze /config wett_channel.');
            return;
        }

        const channel = await client.channels.fetch(wettChannelId).catch(() => null);
        if (!channel) {
            console.log('[Monitor] Wett-Channel nicht gefunden.');
            return;
        }

        console.log('[Monitor] Starte Match-Check...');

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
        try {
            const matches = await trackerUtils.getRecentMatches(game, platform, link.external_id);

            // If API returns empty or null (e.g., 401 Unauthorized), skip silently
            if (!matches || matches.length === 0) continue;

            const latestMatch = matches[0];
            const lastSeenMatchId = db.getLastMatch(link.user_id, link.platform);

            if (latestMatch.attributes.id !== lastSeenMatchId) {
                db.setLastMatch(link.user_id, link.platform, latestMatch.attributes.id);

                const stats = latestMatch.segments[0].stats;
                const kd = stats.kdRatio?.value || 0;
                const kills = stats.kills?.value || 0;
                const deaths = stats.deaths?.value || 0;

                // Check for K/D bets
                await checkAndResolveBets(channel, link.user_id, kd, game);

                if (kd < 0.5 && deaths > 5) {
                    await postMeme(channel, link.user_id, 'trash', kd, kills, deaths, game);
                } else if (kd > 3.0 && kills > 10) {
                    await postMeme(channel, link.user_id, 'mvp', kd, kills, deaths, game);
                }
            }
        } catch (error) {
            // Silently skip errors (API pending approval will cause 401s)
            console.log(`[Monitor] Überspringe ${game}/${platform} für ${link.external_id} (API möglicherweise nicht verfügbar)`);
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
            .setTitle('🗑️ SCHROTT ERKANNT')
            .setDescription(`${user} hat gerade absolut reingeschissen in **${gameDisplay}**.\n\n**K/D:** ${kd.toFixed(2)} (${kills}/${deaths})\n\n"Geh doch lieber Farm Simulator spielen..."`)
            .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z6eXN6eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/2w6IDqKQbakM0/giphy.gif');
    } else {
        embed.setColor('#00ff00')
            .setTitle('🔥 MVP-ALARM')
            .setDescription(`${user} hat gerade rasiert in **${gameDisplay}**!\n\n**K/D:** ${kd.toFixed(2)} (${kills}/${deaths})\n\n"Der Junge hat Aim-Bot an!"`)
            .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z6eXN6eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4eHpwZHg4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l41lTjJp9N6z6z5G8/giphy.gif');
    }

    await channel.send({ content: user, embeds: [embed] });
}

async function checkAndResolveBets(channel, userId, kd, game) {
    // Get all active K/D prediction bets for this user
    const activeBets = db.getActiveBets();
    const userBets = activeBets.filter(bet =>
        bet.bet_type === 'kd_prediction' &&
        bet.target_user_id === userId &&
        !bet.resolved
    );

    for (const bet of userBets) {
        // Check if bet has a closing time and if it's passed
        if (bet.closes_at) {
            const now = new Date();
            const closesAt = new Date(bet.closes_at);
            if (now < closesAt) continue; // Bet not closed yet
        }

        // Resolve bet based on K/D
        const targetValue = bet.target_value;
        let winningOption = null;

        if (kd >= targetValue) {
            winningOption = 'yes'; // Over
        } else {
            winningOption = 'no'; // Under
        }

        const result = db.resolveBet(bet.id, winningOption);

        if (result.success) {
            const gameDisplay = game === 'siege' ? 'Rainbow Six' :
                                game === 'bf6' ? 'Battlefield 6' :
                                game === 'for-honor' ? 'For Honor' :
                                game === 'destiny-2' ? 'Destiny 2' : game;

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎲 Wette automatisch aufgelöst!')
                .setDescription(`**${bet.title}**\n\nDie Wette wurde basierend auf dem neuesten Match von <@${userId}> aufgelöst.`)
                .addFields(
                    { name: '🎮 Spiel', value: gameDisplay, inline: true },
                    { name: '📊 K/D erreicht', value: `${kd.toFixed(2)}`, inline: true },
                    { name: '🎯 Zielwert', value: `${targetValue}`, inline: true },
                    { name: '🏆 Gewinner-Option', value: winningOption === 'yes' ? '✅ Über' : '❌ Unter', inline: true },
                    { name: '👥 Gewinner', value: `${result.winners}`, inline: true },
                    { name: '💰 Ausgezahlter Pool', value: `${result.pool.toLocaleString('de-DE')} Coins`, inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    }
}

module.exports = { startMonitoring };