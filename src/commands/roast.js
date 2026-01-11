const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Hole einen Fail-Moment aus dem Archiv.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Spezifischen Nutzer roasten (optional)')),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        
        let quote;
        if (target) {
            quote = db.getRoast(target.id);
        } else {
            quote = db.getRoast();
        }

        if (!quote) {
            const msg = target ? `Keine Fail-Momente für ${target.username} gefunden... noch nicht.` : 'Keine Fail-Momente gefunden!';
            return interaction.reply({ content: msg, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`🔥 ROAST: ${quote.username}`)
            .setDescription(`"${quote.quote_text}"`)
            .setFooter({ text: `Erinnert von ${quote.added_by}` })
            .setTimestamp(new Date(quote.timestamp));

        await interaction.reply({ embeds: [embed] });
    },
};