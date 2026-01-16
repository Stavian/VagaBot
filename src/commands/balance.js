const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Zeige deinen Coin-Kontostand an')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Zeige den Kontostand eines anderen Users')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = db.getUserCoins(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`💰 ${targetUser.username}'s Kontostand`)
            .addFields(
                { name: '🪙 Coins', value: `**${userData.coins.toLocaleString('de-DE')}** Coins`, inline: true },
                { name: '📊 Gesamt verdient', value: `${userData.total_earned.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '🔥 Daily Streak', value: `${userData.daily_streak} Tag${userData.daily_streak !== 1 ? 'e' : ''}`, inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL())
            .setFooter({ text: 'Nutze /daily für tägliche Belohnungen' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
