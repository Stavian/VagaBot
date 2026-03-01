const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tags')
        .setDescription('Zeigt alle verfügbaren Tags an.'),
    async execute(interaction) {
        await interaction.deferReply();
        const tags = db.getAllTags();

        if (tags.length === 0) {
            return interaction.editReply({ content: 'Es gibt noch keine Tags.' });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🏷️ Verfügbare Tags')
            .setDescription(tags.join(', '))
            .setFooter({ text: 'Neue Tags können nur von Mods erstellt werden.' });

        await interaction.editReply({ embeds: [embed] });
    },
};
