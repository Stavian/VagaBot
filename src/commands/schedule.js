const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Erstelle eine Abstimmung für einen Spieltermin.')
        .addStringOption(option =>
            option.setName('was')
                .setDescription('Was soll gespielt werden?')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('wann')
                .setDescription('Wann (Datum/Uhrzeit)?')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('notiz')
                .setDescription('Zusätzliche Infos')),
    async execute(interaction) {
        const title = interaction.options.getString('was');
        const when = interaction.options.getString('wann');
        const note = interaction.options.getString('notiz');

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📅 Spieltermin: ${title}`)
            .setDescription(`**Wann:** ${when}${note ? `\n**Notiz:** ${note}` : ''}\n\nReagiere mit ✅ wenn du dabei bist oder ❌ wenn nicht.`)
            .setFooter({ text: `Geplant von ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        
        try {
            await message.react('✅');
            await message.react('❌');
        } catch (error) {
            console.error('Error adding reactions to schedule:', error);
        }
    },
};
