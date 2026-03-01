const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Hol dir deine tägliche Belohnung ab'),

    async execute(interaction) {
        await interaction.deferReply();

        const result = db.claimDaily(interaction.user.id);

        if (!result.success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏰ Noch nicht verfügbar')
                .setDescription(`Du hast deine tägliche Belohnung bereits abgeholt!\n\n**Nächste Belohnung in:** ${result.hoursLeft} Stunden`)
                .setFooter({ text: 'Komm morgen wieder!' });

            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎁 Tägliche Belohnung!')
            .setDescription(`Du hast **${result.amount.toLocaleString('de-DE')} Coins** erhalten!`)
            .addFields(
                { name: '🔥 Streak', value: `${result.streak} Tag${result.streak !== 1 ? 'e' : ''} in Folge`, inline: true },
                { name: '💎 Bonus', value: `+${result.bonus} Coins`, inline: true }
            )
            .setFooter({ text: `Halte deinen Streak aufrecht für mehr Bonus! (Max: +100 Coins)` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Check new balance
        const userData = db.getUserCoins(interaction.user.id);

        if (result.streak % 7 === 0 && result.streak > 0) {
            // Weekly milestone
            const weekBonus = 100;
            db.addCoins(interaction.user.id, weekBonus, 'streak_bonus', `Wöchentlicher Streak-Bonus (${result.streak} Tage)`);

            const bonusEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Streak-Meilenstein!')
                .setDescription(`Du hast **${result.streak} Tage** in Folge abgeholt!\n\n**Bonus:** +${weekBonus} Coins`)
                .setFooter({ text: `Neuer Kontostand: ${(userData.coins + weekBonus).toLocaleString('de-DE')} Coins` });

            await interaction.followUp({ embeds: [bonusEmbed] });
        }
    }
};
