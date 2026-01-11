const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Erhalte ein zufälliges Zitat.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Nach Nutzer filtern (optional)')),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        
        let quote;
        if (user) {
            quote = db.getRandomQuote(user.id);
        } else {
            quote = db.getRandomQuote();
        }

        if (!quote) {
            return interaction.reply({ content: 'Keine Zitate gefunden!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Zitat von ${quote.username}`)
            .setDescription(`"${quote.quote_text}"`)
            .setFooter({ text: `Hinzugefügt von ${quote.added_by} | Kategorie: ${quote.category}` })
            .setTimestamp(new Date(quote.timestamp));

        await interaction.reply({ embeds: [embed] });
    },
};