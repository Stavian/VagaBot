const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suche')
        .setDescription('Suche nach einem Zitat anhand eines Stichworts.')
        .addStringOption(option => 
            option.setName('stichwort')
                .setDescription('Das Wort, nach dem gesucht werden soll')
                .setRequired(true)),
    async execute(interaction) {
        const keyword = interaction.options.getString('stichwort');
        const results = db.searchQuotes(keyword);

        if (results.length === 0) {
            return interaction.reply({ content: `Keine Zitate mit "${keyword}" gefunden.`, ephemeral: true });
        }

        // Since the DB query orders by RANDOM(), the first result is a random match.
        const quote = results[0];
        const count = results.length;

        const categoryNames = {
            'general': 'Allgemein',
            'fail': 'Fail',
            'win': 'Win'
        };
        const displayCategory = categoryNames[quote.category] || quote.category;

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🔎 Fundstück: ${quote.username}`)
            .setDescription(`"${quote.quote_text}"`)
            .setFooter({ text: `ID: ${quote.id} | Treffer 1 von ${count} Treffern für "${keyword}" | Hinzugefügt von ${quote.added_by}` })
            .setTimestamp(new Date(quote.timestamp));

        if (quote.image_url) {
            embed.setImage(quote.image_url);
        }

        await interaction.reply({ embeds: [embed] });
    },
};
