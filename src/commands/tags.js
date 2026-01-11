const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tags')
        .setDescription('Zeigt alle verfügbaren Tags an.'),
    async execute(interaction) {
        const tags = db.getAllTags();

        if (tags.length === 0) {
            return interaction.reply({ content: 'Es gibt noch keine Tags.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🏷️ Verfügbare Tags')
            .setDescription(tags.join(', '))
            .setFooter({ text: 'Neue Tags können nur von Mods erstellt werden.' });

        await interaction.reply({ embeds: [embed] });
    },
};
