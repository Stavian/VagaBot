const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const steamUtils = require('../utils/steam');
const trackerUtils = require('../utils/tracker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Zeige Gaming-Statistiken für einen Nutzer.')
        .addUserOption(option =>
            option.setName('nutzer')
                .setDescription('Der Nutzer (Standard: Du selbst)'))
        .addStringOption(option =>
            option.setName('plattform')
                .setDescription('Spezifische Plattform')
                .addChoices(
                    { name: 'Rainbow Six Siege', value: 'r6' },
                    { name: 'Battlefield 6', value: 'bf6' },
                    { name: 'For Honor', value: 'fh' },
                    { name: 'Destiny 2', value: 'd2' },
                    { name: 'Steam', value: 'steam' },
                    { name: 'Valorant', value: 'valorant' }
                )),
    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('nutzer') || interaction.user;
        const requestedPlatform = interaction.options.getString('plattform');
        
        // Mapping for group lookups
        const platformGroups = {
            'r6': ['r6_uplay', 'r6_psn', 'r6_xbl'],
            'bf6': ['bf6_origin', 'bf6_psn', 'bf6_xbl'],
            'fh': ['fh_uplay', 'fh_psn', 'fh_xbl'],
            'd2': ['d2_steam', 'd2_psn', 'd2_xbl']
        };

        // Find links
        let links = [];
        if (requestedPlatform) {
            const variants = platformGroups[requestedPlatform] || [requestedPlatform];
            for (const v of variants) {
                const link = db.getLinkedUser(targetUser.id, v);
                if (link) links.push(link);
            }
        } else {
            const allPossiblePlatforms = [
                'steam', 'valorant',
                'r6_uplay', 'r6_psn', 'r6_xbl',
                'bf6_origin', 'bf6_psn', 'bf6_xbl',
                'fh_uplay', 'fh_psn', 'fh_xbl',
                'd2_steam', 'd2_psn', 'd2_xbl'
            ];
            for (const p of allPossiblePlatforms) {
                const l = db.getLinkedUser(targetUser.id, p);
                if (l) links.push(l);
            }
        }

        if (links.length === 0) {
            return interaction.editReply({
                content: `⚠️ **${targetUser.username}** hat keine passenden Accounts verknüpft.\nNutze \`/link\`, um deine IDs zu hinterlegen.`
            });
        }

        const embeds = [];

        for (const link of links) {
            if (link.platform === 'steam') {
                const embed = await getSteamEmbed(link);
                if (embed) embeds.push(embed);
            } else if (link.platform === 'valorant') {
                const embed = await getTrackerEmbed(link, 'valorant', 'riot', '#fa4454');
                if (embed) embeds.push(embed);
            } else if (link.platform.startsWith('r6')) {
                const plat = link.platform.split('_')[1];
                const embed = await getTrackerEmbed(link, 'siege', plat, '#ffffff');
                if (embed) embeds.push(embed);
            } else if (link.platform.startsWith('bf6')) {
                const plat = link.platform.split('_')[1];
                const embed = await getTrackerEmbed(link, 'bf6', plat, '#00ffff');
                if (embed) embeds.push(embed);
            } else if (link.platform.startsWith('fh')) {
                const plat = link.platform.split('_')[1];
                const embed = await getTrackerEmbed(link, 'for-honor', plat, '#e5be01');
                if (embed) embeds.push(embed);
            } else if (link.platform.startsWith('d2')) {
                const plat = link.platform.split('_')[1];
                const embed = await getTrackerEmbed(link, 'destiny-2', plat, '#f5f5f5');
                if (embed) embeds.push(embed);
            }
        }

        if (embeds.length === 0) {
            return interaction.editReply({ content: '❌ Fehler beim Abrufen der Daten. Profile öffentlich?' });
        }

        await interaction.editReply({ embeds });
    },
};

async function getSteamEmbed(link) {
    let steamId = link.external_id;
    if (steamUtils.isVanityUrl(steamId)) {
        const resolvedId = await steamUtils.resolveVanityUrl(steamId);
        if (resolvedId) steamId = resolvedId;
        else return null;
    }

    const summary = await steamUtils.getPlayerSummary(steamId);
    const recentGames = await steamUtils.getRecentlyPlayed(steamId);
    if (!summary) return null;

    const embed = new EmbedBuilder()
        .setColor('#1b2838')
        .setTitle(`Steam: ${summary.personaname}`)
        .setURL(summary.profileurl)
        .setThumbnail(summary.avatarfull);

    if (summary.gameextrainfo) {
        embed.addFields({ name: 'Spielt gerade', value: `🎮 **${summary.gameextrainfo}**` });
    }

    if (recentGames && recentGames.length > 0) {
        const gamesList = recentGames.map(g => `**${g.name}**: ${(g.playtime_2weeks / 60).toFixed(1)} Std.`).join('\n');
        embed.addFields({ name: 'Letzte 2 Wochen', value: gamesList });
    }
    return embed;
}

async function getTrackerEmbed(link, game, platform, color) {
    const data = await trackerUtils.getProfile(game, platform, link.external_id);

    // Check if Tracker.gg API is unavailable (pending approval or error)
    if (!data) {
        const displayGame = game === 'bf6' ? 'Battlefield 6' :
                           game === 'siege' ? 'Rainbow Six Siege' :
                           game === 'for-honor' ? 'For Honor' :
                           game === 'destiny-2' ? 'Destiny 2' :
                           game === 'valorant' ? 'Valorant' : game.toUpperCase();

        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle(`⏳ ${displayGame} Stats`)
            .setDescription(`**Account:** ${link.external_id}\n\n⚠️ **Tracker.gg API-Zugriff steht noch aus.**\n\nDie Stats für ${displayGame} sind verfügbar, sobald die API-Genehmigung erteilt wurde.\n\n*Aktuelle Funktionen:*\n✅ Steam Stats verfügbar\n⏳ Competitive Stats (Tracker.gg) in Warteschlange`)
            .setFooter({ text: 'Die API-Anfrage ist eingereicht und wird geprüft.' });

        return embed;
    }

    const displayGame = game === 'bf6' ? 'Battlefield 6' : game.toUpperCase();

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${displayGame}: ${data.platformInfo.platformUserHandle}`)
        .setThumbnail(data.platformInfo.avatarUrl);

    // Dynamic segments (varies by game)
    const stats = data.segments[0].stats;
    
    if (game === 'valorant') {
        const rank = stats.rank?.displayValue || 'Unranked';
        const kd = stats.kDRatio?.displayValue || '0.00';
        embed.addFields(
            { name: 'Rank', value: rank, inline: true },
            { name: 'K/D', value: kd, inline: true }
        );
    } else if (game === 'siege') {
        const level = stats.level?.displayValue || '0';
        const kd = stats.kdRatio?.displayValue || '0.00';
        const wl = stats.wlPercentage?.displayValue || '0%';
        embed.addFields(
            { name: 'Level', value: level, inline: true },
            { name: 'K/D', value: kd, inline: true },
            { name: 'Winrate', value: wl, inline: true }
        );
    } else if (game === 'bf6') {
        const kills = stats.kills?.displayValue || '0';
        const kd = stats.kdRatio?.displayValue || '0.00';
        embed.addFields(
            { name: 'Kills', value: kills, inline: true },
            { name: 'K/D', value: kd, inline: true }
        );
    } else if (game === 'for-honor') {
        const level = stats.reputation?.displayValue || '0';
        const winrate = stats.winRate?.displayValue || '0%';
        const kd = stats.kdRatio?.displayValue || '0.00';
        embed.addFields(
            { name: 'Reputation', value: level, inline: true },
            { name: 'Winrate', value: winrate, inline: true },
            { name: 'K/D', value: kd, inline: true }
        );
    } else if (game === 'destiny-2') {
        const power = stats.light?.displayValue || '0';
        const kd = stats.kdRatio?.displayValue || '0.00';
        embed.addFields(
            { name: 'Power Level', value: power, inline: true },
            { name: 'K/D (Crucible)', value: kd, inline: true }
        );
    }

    return embed;
}