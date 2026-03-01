const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');

// Store active games
const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('highlow')
        .setDescription('Rate, ob die nächste Zahl höher oder niedriger ist!')
        .addIntegerOption(option =>
            option.setName('einsatz')
                .setDescription('Wie viele Coins möchtest du setzen?')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply();

        const betAmount = interaction.options.getInteger('einsatz');
        const userId = interaction.user.id;

        // Check if user already has an active game
        if (activeGames.has(userId)) {
            return interaction.editReply({
                content: '❌ Du hast bereits ein aktives High-Low Spiel! Beende es zuerst.'
            });
        }

        // Check if user has enough coins
        const userData = db.getUserCoins(userId);
        if (userData.coins < betAmount) {
            return interaction.editReply({
                content: `❌ Du hast nicht genug Coins! Du hast nur ${userData.coins} Coins.`
            });
        }

        // Deduct coins
        db.addCoins(userId, -betAmount, 'highlow', 'High-Low Einsatz');

        // Initialize game
        const currentNumber = Math.floor(Math.random() * 100) + 1;
        const gameData = {
            userId,
            betAmount,
            currentNumber,
            round: 1,
            maxRounds: 5,
            winnings: 0,
            multiplier: 1
        };

        // Auto-expire abandoned game after 5 minutes and refund bet
        const expireTimeout = setTimeout(() => {
            if (activeGames.has(userId)) {
                db.addCoins(userId, gameData.betAmount, 'highlow_refund', 'High-Low Einsatz zurückerstattet (Timeout)');
                activeGames.delete(userId);
            }
        }, 5 * 60 * 1000);

        gameData.expireTimeout = expireTimeout;
        activeGames.set(userId, gameData);

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🎯 High-Low Spiel!')
            .setDescription(`Deine aktuelle Zahl: **${currentNumber}**\n\nWird die nächste Zahl höher oder niedriger sein?`)
            .addFields(
                { name: '💰 Einsatz', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '🎮 Runde', value: `${gameData.round}/${gameData.maxRounds}`, inline: true },
                { name: '✨ Aktueller Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true }
            )
            .setFooter({ text: 'Wähle Higher oder Lower! Du kannst auch jederzeit auszahlen.' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`highlow_higher_${userId}`)
                    .setLabel('⬆️ Höher')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`highlow_lower_${userId}`)
                    .setLabel('⬇️ Niedriger')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`highlow_cashout_${userId}`)
                    .setLabel('💰 Auszahlen')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(gameData.round === 1) // Can't cash out on first round
            );

        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};

// Handle button interactions
async function handleHighLowButton(interaction) {
    const [action, choice, targetUserId] = interaction.customId.split('_');

    if (interaction.user.id !== targetUserId) {
        return interaction.reply({
            content: '❌ Das ist nicht dein Spiel!',
            ephemeral: true
        });
    }

    const gameData = activeGames.get(targetUserId);
    if (!gameData) {
        return interaction.reply({
            content: '❌ Spiel nicht gefunden oder bereits beendet.',
            ephemeral: true
        });
    }

    // Handle cashout
    if (choice === 'cashout') {
        const winnings = Math.floor(gameData.betAmount * gameData.multiplier);
        db.addCoins(targetUserId, winnings, 'highlow_win', 'High-Low Gewinn (Cashout)');
        clearTimeout(gameData.expireTimeout);
        activeGames.delete(targetUserId);

        const newBalance = db.getUserCoins(targetUserId).coins;
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 Ausgezahlt!')
            .setDescription(`Du hast deine Gewinne erfolgreich ausgezahlt!`)
            .addFields(
                { name: '✨ Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true },
                { name: '🎁 Gewinn', value: `+${winnings.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: false }
            )
            .setTimestamp();

        return interaction.update({ embeds: [embed], components: [] });
    }

    // Generate next number
    const nextNumber = Math.floor(Math.random() * 100) + 1;
    const correct = (choice === 'higher' && nextNumber > gameData.currentNumber) ||
                   (choice === 'lower' && nextNumber < gameData.currentNumber) ||
                   (nextNumber === gameData.currentNumber); // Tie counts as correct

    if (!correct) {
        // Lost
        clearTimeout(gameData.expireTimeout);
        activeGames.delete(targetUserId);
        const newBalance = db.getUserCoins(targetUserId).coins;

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💔 Verloren!')
            .setDescription(`Deine Zahl: **${gameData.currentNumber}**\nNächste Zahl: **${nextNumber}**\n\nDu hast falsch geraten!`)
            .addFields(
                { name: '🎮 Runde erreicht', value: `${gameData.round}/${gameData.maxRounds}`, inline: true },
                { name: '💔 Verloren', value: `-${gameData.betAmount.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: false }
            )
            .setTimestamp();

        return interaction.update({ embeds: [embed], components: [] });
    }

    // Correct guess
    const previousNumber = gameData.currentNumber;
    gameData.round++;
    gameData.multiplier += 0.4;
    gameData.currentNumber = nextNumber;

    // Check if reached max rounds (automatic win)
    if (gameData.round > gameData.maxRounds) {
        const winnings = Math.floor(gameData.betAmount * gameData.multiplier);
        db.addCoins(targetUserId, winnings, 'highlow_win', 'High-Low Gewinn (Vollständig)');
        clearTimeout(gameData.expireTimeout);
        activeGames.delete(targetUserId);

        const newBalance = db.getUserCoins(targetUserId).coins;
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 PERFEKT! Alle Runden gewonnen!')
            .setDescription(`Du hast alle ${gameData.maxRounds} Runden gemeistert!`)
            .addFields(
                { name: '✨ Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true },
                { name: '🎁 Gewinn', value: `+${winnings.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: false }
            )
            .setTimestamp();

        return interaction.update({ embeds: [embed], components: [] });
    }

    // Continue game
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Richtig geraten!')
        .setDescription(`Vorherige Zahl: **${previousNumber}**\nDeine neue Zahl: **${nextNumber}**\n\nWird die nächste Zahl höher oder niedriger sein?`)
        .addFields(
            { name: '💰 Einsatz', value: `${gameData.betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎮 Runde', value: `${gameData.round}/${gameData.maxRounds}`, inline: true },
            { name: '✨ Aktueller Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true },
            { name: '💵 Möglicher Gewinn', value: `${Math.floor(gameData.betAmount * gameData.multiplier).toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setFooter({ text: 'Wähle Higher oder Lower! Du kannst auch auszahlen.' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`highlow_higher_${targetUserId}`)
                .setLabel('⬆️ Höher')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`highlow_lower_${targetUserId}`)
                .setLabel('⬇️ Niedriger')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`highlow_cashout_${targetUserId}`)
                .setLabel('💰 Auszahlen')
                .setStyle(ButtonStyle.Primary)
        );

    activeGames.set(targetUserId, gameData);
    await interaction.update({ embeds: [embed], components: [row] });
}

// Export the button handler
module.exports.handleHighLowButton = handleHighLowButton;
