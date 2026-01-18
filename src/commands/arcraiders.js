const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const arcUtils = require('../utils/arcraiders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arcraiders')
        .setDescription('Arc Raiders Account-Verwaltung und Stats')
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Verknüpfe deinen Arc Raiders Account')
                .addStringOption(option =>
                    option.setName('player_id')
                        .setDescription('Deine Arc Raiders Spieler-ID oder Username')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setDescription('Entferne die Verknüpfung zu deinem Arc Raiders Account'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Zeige deine Arc Raiders Extraction-Statistiken')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User, dessen Stats du sehen möchtest')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Zeige die besten Arc Raiders Extraktoren')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'link') {
            await handleLink(interaction);
        } else if (subcommand === 'unlink') {
            await handleUnlink(interaction);
        } else if (subcommand === 'stats') {
            await handleStats(interaction);
        } else if (subcommand === 'leaderboard') {
            await handleLeaderboard(interaction);
        }
    }
};

async function handleLink(interaction) {
    const playerId = interaction.options.getString('player_id');
    await interaction.deferReply();

    // Verify player exists
    const profile = await arcUtils.getPlayerProfile(playerId);
    if (!profile) {
        return interaction.editReply({
            content: '❌ Spieler nicht gefunden. Überprüfe deine Spieler-ID und versuche es erneut.',
            ephemeral: true
        });
    }

    // Link the account
    db.linkUser(interaction.user.id, 'arc_raiders', playerId, JSON.stringify(profile));

    const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('✅ Arc Raiders Account verknüpft!')
        .setDescription(`Dein Discord-Account wurde erfolgreich mit **${profile.player_name || playerId}** verknüpft.`)
        .addFields(
            { name: '🎮 Spieler-ID', value: playerId, inline: true },
            { name: '📊 Automatische Überwachung', value: 'Aktiv', inline: true }
        )
        .setFooter({ text: 'Deine Extractions werden jetzt automatisch getrackt!' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleUnlink(interaction) {
    const link = db.getLinkedUser(interaction.user.id, 'arc_raiders');

    if (!link) {
        return interaction.reply({
            content: '❌ Du hast keinen Arc Raiders Account verknüpft.',
            ephemeral: true
        });
    }

    db.removeLink(interaction.user.id, 'arc_raiders');

    await interaction.reply({
        content: '✅ Dein Arc Raiders Account wurde entfernt.',
        ephemeral: true
    });
}

async function handleStats(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    await interaction.deferReply();

    // Check if user has linked account
    const link = db.getLinkedUser(targetUser.id, 'arc_raiders');
    if (!link) {
        return interaction.editReply({
            content: `${targetUser.id === interaction.user.id ? 'Du hast' : 'Dieser User hat'} keinen Arc Raiders Account verknüpft.`,
            ephemeral: true
        });
    }

    // Get extraction stats
    const stats = db.getExtractionStats(targetUser.id);

    if (!stats || stats.total_extractions === 0) {
        return interaction.editReply({
            content: `${targetUser.id === interaction.user.id ? 'Du hast' : 'Dieser User hat'} noch keine Extractions getrackt.`,
            ephemeral: true
        });
    }

    const successRate = ((stats.successful_extractions / stats.total_extractions) * 100).toFixed(1);
    const avgSurvival = arcUtils.formatSurvivalTime(Math.floor(stats.avg_survival_time || 0));

    const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle(`🎮 Arc Raiders Stats: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: '📦 Extractions', value: `${stats.total_extractions}`, inline: true },
            { name: '✅ Erfolgreich', value: `${stats.successful_extractions} (${successRate}%)`, inline: true },
            { name: '⏱️ Durchschn. Überlebenszeit', value: avgSurvival, inline: true },
            { name: '💀 Kills', value: `${stats.total_kills || 0}`, inline: true },
            { name: '💥 Schaden', value: `${(stats.total_damage || 0).toLocaleString('de-DE')}`, inline: true },
            { name: '🎁 Loot gefunden', value: `${stats.total_loot || 0}`, inline: true },
            { name: '💰 Coins verdient', value: `${(stats.total_coins_earned || 0).toLocaleString('de-DE')}`, inline: true }
        )
        .setFooter({ text: 'Arc Raiders Extraction Tracking' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
    await interaction.deferReply();

    const topExtractors = db.getTopExtractors();

    if (!topExtractors || topExtractors.length === 0) {
        return interaction.editReply({
            content: '📭 Noch keine Extraction-Daten vorhanden.',
            ephemeral: true
        });
    }

    const leaderboardText = topExtractors
        .map((extractor, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} <@${extractor.user_id}>\n   ${extractor.successful}/${extractor.extractions} erfolgreich • ${extractor.legendary_items} 🟠 Legendär`;
        })
        .join('\n\n');

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Arc Raiders Leaderboard')
        .setDescription(leaderboardText)
        .setFooter({ text: 'Basierend auf erfolgreichen Extractions und legendären Items' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
