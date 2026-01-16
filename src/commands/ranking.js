const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Zeigt die Hall of Shame und andere Statistiken.'),
    async execute(interaction) {
        const topFails = db.getTopFailures();
        const mostQuoted = db.getMostQuoted();
        const topSnitch = db.getTopSnitch();

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

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 VagaBot Bestenlisten')
            .setDescription('Hier ist die ungeschminkte Wahrheit.')
            .addFields(
                { name: '🔥 Hall of Shame (Meiste Fails)', value: formatList(topFails, 'Fails'), inline: true },
                { name: '📢 Meist zitiert', value: formatList(mostQuoted, 'Zitate'), inline: true },
                { name: '🕵️ Top Snitch (Meiste Beiträge)', value: formatList(topSnitch, 'Einträge'), inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
