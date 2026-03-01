const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Zeigt die Hall of Shame und andere Statistiken.')
        .addStringOption(option =>
            option.setName('typ')
                .setDescription('Welche Bestenliste soll angezeigt werden?')
                .setRequired(false)
                .addChoices(
                    { name: 'Zitate & Fails', value: 'quotes' },
                    { name: 'Voice-Zitate', value: 'voice' },
                    { name: 'Coins', value: 'coins' },
                    { name: 'Alle', value: 'all' }
                )),
    async execute(interaction) {
        await interaction.deferReply();
        const type = interaction.options.getString('typ') || 'all';

        const topFails = db.getTopFailures();
        const mostQuoted = db.getMostQuoted();
        const topSnitch = db.getTopSnitch();
        const mostVoiceQuoted = db.getMostVoiceQuoted();
        const topVoiceSnitch = db.getTopVoiceSnitch();
        const topCoins = db.getTopCoinHolders();
        const topEarners = db.getTopCoinEarners();

        const formatList = (list, emoji) => {
            if (list.length === 0) return 'Noch keine Daten.';
            return list.map((entry, index) => {
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                else medal = `${index + 1}.`;
                return `${medal} **${entry.username}** - ${entry.count} ${emoji}`;
            }).join('\n');
        };

        const formatCoinList = async (list, field) => {
            if (list.length === 0) return 'Noch keine Daten.';
            const formatted = await Promise.all(list.map(async (entry, index) => {
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                else medal = `${index + 1}.`;

                // Try to get username from Discord
                let username = entry.user_id;
                try {
                    const user = await interaction.client.users.fetch(entry.user_id);
                    username = user.username;
                } catch (err) {
                    // Keep user_id if fetch fails
                }

                const amount = field === 'coins' ? entry.coins : entry.total_earned;
                return `${medal} **${username}** - ${amount.toLocaleString('de-DE')} Coins`;
            }));
            return formatted.join('\n');
        };

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTimestamp();

        if (type === 'quotes' || type === 'all') {
            embed.setTitle('🏆 VagaBot Bestenlisten - Zitate & Fails')
                .setDescription('Hier ist die ungeschminkte Wahrheit.')
                .addFields(
                    { name: '🔥 Hall of Shame (Meiste Fails)', value: formatList(topFails, 'Fails'), inline: true },
                    { name: '📢 Meist zitiert', value: formatList(mostQuoted, 'Zitate'), inline: true },
                    { name: '🕵️ Top Snitch (Meiste Beiträge)', value: formatList(topSnitch, 'Einträge'), inline: false }
                );
        }

        if (type === 'voice' || type === 'all') {
            if (type === 'all') {
                embed.addFields({ name: '\u200B', value: '─────────────────────────', inline: false });
            }

            embed.setTitle(type === 'voice' ? '🎤 VagaBot Bestenlisten - Voice-Zitate' : embed.data.title)
                .addFields(
                    { name: '🎤 Meist in Voice zitiert', value: formatList(mostVoiceQuoted, 'Voice-Zitate'), inline: true },
                    { name: '👂 Top Voice-Snitch', value: formatList(topVoiceSnitch, 'Voice-Einträge'), inline: true }
                );
        }

        if (type === 'coins' || type === 'all') {
            if (type === 'all') {
                // Add separator
                embed.addFields({ name: '\u200B', value: '─────────────────────────', inline: false });
            }

            embed.setTitle(type === 'coins' ? '💰 VagaBot Bestenlisten - Coins' : embed.data.title)
                .addFields(
                    { name: '💰 Reichste User', value: await formatCoinList(topCoins, 'coins'), inline: true },
                    { name: '📊 Meiste Coins verdient', value: await formatCoinList(topEarners, 'total_earned'), inline: true }
                );
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
