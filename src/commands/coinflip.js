const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const finnHandler = require('../utils/finnHandler');

// Store active duels
const activeDuels = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Wirf eine Münze und setze Coins darauf')
        .addStringOption(option =>
            option.setName('seite')
                .setDescription('Wähle Kopf oder Zahl')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 Kopf', value: 'kopf' },
                    { name: '🎲 Zahl', value: 'zahl' }
                ))
        .addIntegerOption(option =>
            option.setName('einsatz')
                .setDescription('Wie viele Coins möchtest du setzen?')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('gegner')
                .setDescription('Fordere einen Spieler heraus (leer = gegen Bot)')
                .setRequired(false)),

    async execute(interaction) {
        const choice = interaction.options.getString('seite');
        const betAmount = interaction.options.getInteger('einsatz');
        const opponent = interaction.options.getUser('gegner');
        const userId = interaction.user.id;

        // Check if user has enough coins
        const userData = db.getUserCoins(userId);
        if (userData.coins < betAmount) {
            return interaction.reply({
                content: `❌ Du hast nicht genug Coins! Du hast nur ${userData.coins} Coins.`,
                ephemeral: true
            });
        }

        // PvP Mode
        if (opponent) {
            // Can't challenge yourself
            if (opponent.id === userId) {
                return interaction.reply({
                    content: '❌ Du kannst nicht gegen dich selbst spielen!',
                    ephemeral: true
                });
            }

            // Can't challenge bots (except Finn Wegbier)
            if (opponent.bot && !finnHandler.isFinn(opponent.id)) {
                return interaction.reply({
                    content: '❌ Du kannst keine Bots herausfordern!',
                    ephemeral: true
                });
            }

            // Check if opponent has enough coins
            const opponentData = db.getUserCoins(opponent.id);
            if (opponentData.coins < betAmount) {
                return interaction.reply({
                    content: `❌ ${opponent.username} hat nicht genug Coins! (${opponentData.coins} Coins verfügbar)`,
                    ephemeral: true
                });
            }

            // Create duel challenge
            const duelId = `${userId}_${opponent.id}_${Date.now()}`;
            const opponentChoice = choice === 'kopf' ? 'zahl' : 'kopf'; // Opponent gets opposite side

            activeDuels.set(duelId, {
                challengerId: userId,
                challengerName: interaction.user.username,
                challengerChoice: choice,
                opponentId: opponent.id,
                opponentName: opponent.username,
                opponentChoice: opponentChoice,
                betAmount: betAmount,
                timestamp: Date.now()
            });

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚔️ Coinflip Duell!')
                .setDescription(`${interaction.user} fordert ${opponent} zu einem Coinflip-Duell heraus!`)
                .addFields(
                    { name: '💰 Einsatz', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
                    { name: `🎯 ${interaction.user.username}`, value: choice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                    { name: `🎯 ${opponent.username}`, value: opponentChoice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                    { name: '⏰ Verfällt in', value: '60 Sekunden', inline: false }
                )
                .setFooter({ text: `${opponent.username}, akzeptiere oder lehne das Duell ab!` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`duel_accept_${duelId}`)
                        .setLabel('✅ Akzeptieren')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`duel_decline_${duelId}`)
                        .setLabel('❌ Ablehnen')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.reply({
                content: `${opponent}`,
                embeds: [embed],
                components: [row]
            });

            // Auto-expire after 60 seconds
            setTimeout(() => {
                if (activeDuels.has(duelId)) {
                    activeDuels.delete(duelId);
                }
            }, 60000);

            // If opponent is Finn Wegbier, auto-handle the duel
            if (finnHandler.isFinn(opponent.id)) {
                const delay = finnHandler.getFinnDelay();

                setTimeout(async () => {
                    const duelData = activeDuels.get(duelId);
                    if (!duelData) return; // Already expired or handled

                    const decision = await finnHandler.finnDecision(betAmount);

                    if (!decision.accept) {
                        // Finn declines
                        activeDuels.delete(duelId);

                        const declineEmbed = new EmbedBuilder()
                            .setColor('#FF6B6B')
                            .setTitle('🍺 Finn Wegbier lehnt ab')
                            .setDescription(decision.message)
                            .setTimestamp();

                        try {
                            await interaction.editReply({
                                content: '',
                                embeds: [declineEmbed],
                                components: []
                            });
                        } catch (err) {
                            console.error('Error updating Finn decline:', err);
                        }
                        return;
                    }

                    // Finn accepts - execute the duel
                    await executeFinnCoinflipDuel(interaction, duelId, duelData);
                }, delay);
            }

        } else {
            // Solo mode vs Bot
            // Check if user has 2x bet for potential loss
            const userData = db.getUserCoins(userId);
            const requiredCoins = betAmount * 2;
            if (userData.coins < requiredCoins) {
                return interaction.reply({
                    content: `❌ Du brauchst mindestens ${requiredCoins.toLocaleString('de-DE')} Coins (2x Einsatz für möglichen Verlust)!\n💳 Dein Kontostand: ${userData.coins.toLocaleString('de-DE')} Coins`,
                    ephemeral: true
                });
            }

            // Deduct coins
            db.addCoins(userId, -betAmount, 'coinflip', 'Coinflip Einsatz');

            // Flip the coin
            const result = Math.random() < 0.5 ? 'kopf' : 'zahl';
            const won = result === choice;

            const embed = new EmbedBuilder()
                .setColor(won ? '#00FF00' : '#FF0000')
                .setTitle('🪙 Coinflip!')
                .setDescription(`Die Münze wird geworfen...`)
                .addFields(
                    { name: '🎯 Deine Wahl', value: choice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                    { name: '🎲 Ergebnis', value: result === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                    { name: '💰 Einsatz', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true }
                )
                .setTimestamp();

            if (won) {
                const winnings = Math.floor(betAmount * 1.8);
                db.addCoins(userId, winnings, 'coinflip_win', 'Coinflip Gewinn');
                const newBalance = db.getUserCoins(userId).coins;
                const netProfit = winnings - betAmount;

                embed.addFields(
                    { name: '🎉 Ergebnis', value: `**GEWONNEN!**\n+${netProfit.toLocaleString('de-DE')} Coins (1.8x Multiplikator)`, inline: false },
                    { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: false }
                );
            } else {
                // Additional penalty on loss
                const penalty = betAmount;
                db.addCoins(userId, -penalty, 'coinflip_penalty', 'Coinflip Strafverlust');
                const totalLoss = betAmount + penalty;
                const newBalance = db.getUserCoins(userId).coins;

                embed.addFields(
                    { name: '💔 Ergebnis', value: `**VERLOREN!**\n-${totalLoss.toLocaleString('de-DE')} Coins (1x Einsatz + 1x Strafe = 2x Gesamt)`, inline: false },
                    { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: false }
                );
            }

            await interaction.reply({ embeds: [embed] });
        }
    }
};

// Handle duel button interactions
async function handleDuelButton(interaction, duelId, action) {
    const duelData = activeDuels.get(duelId);

    if (!duelData) {
        return interaction.update({
            content: '⚠️ Dieses Duell ist abgelaufen oder wurde bereits beendet.',
            embeds: [],
            components: []
        });
    }

    // Only opponent can accept/decline
    if (interaction.user.id !== duelData.opponentId) {
        return interaction.reply({
            content: '❌ Du bist nicht der herausgeforderte Spieler!',
            ephemeral: true
        });
    }

    if (action === 'decline') {
        activeDuels.delete(duelId);

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Duell abgelehnt')
            .setDescription(`${duelData.opponentName} hat das Duell abgelehnt.`)
            .setTimestamp();

        return interaction.update({
            content: '',
            embeds: [embed],
            components: []
        });
    }

    if (action === 'accept') {
        // Check if both players still have enough coins
        const challengerData = db.getUserCoins(duelData.challengerId);
        const opponentData = db.getUserCoins(duelData.opponentId);

        if (challengerData.coins < duelData.betAmount || opponentData.coins < duelData.betAmount) {
            activeDuels.delete(duelId);
            return interaction.update({
                content: '❌ Ein Spieler hat nicht mehr genug Coins für dieses Duell!',
                embeds: [],
                components: []
            });
        }

        // Deduct coins from both players
        db.addCoins(duelData.challengerId, -duelData.betAmount, 'coinflip_duel', 'Coinflip Duell Einsatz');
        db.addCoins(duelData.opponentId, -duelData.betAmount, 'coinflip_duel', 'Coinflip Duell Einsatz');

        // Flip the coin
        const result = Math.random() < 0.5 ? 'kopf' : 'zahl';
        const challengerWon = result === duelData.challengerChoice;
        const winnerId = challengerWon ? duelData.challengerId : duelData.opponentId;
        const winnerName = challengerWon ? duelData.challengerName : duelData.opponentName;
        const loserId = challengerWon ? duelData.opponentId : duelData.challengerId;
        const loserName = challengerWon ? duelData.opponentName : duelData.challengerName;

        // Award winnings to winner (takes both bets)
        const totalPot = duelData.betAmount * 2;
        db.addCoins(winnerId, totalPot, 'coinflip_duel_win', 'Coinflip Duell Gewinn');

        const winnerBalance = db.getUserCoins(winnerId).coins;
        const loserBalance = db.getUserCoins(loserId).coins;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('⚔️ Coinflip Duell - Ergebnis!')
            .setDescription(`Die Münze wurde geworfen...`)
            .addFields(
                { name: `🎯 ${duelData.challengerName}`, value: duelData.challengerChoice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                { name: `🎯 ${duelData.opponentName}`, value: duelData.opponentChoice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                { name: '🎲 Ergebnis', value: result === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
                { name: '🏆 Gewinner', value: `**${winnerName}**\n+${totalPot.toLocaleString('de-DE')} Coins\n💳 ${winnerBalance.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '💔 Verlierer', value: `${loserName}\n-${duelData.betAmount.toLocaleString('de-DE')} Coins\n💳 ${loserBalance.toLocaleString('de-DE')} Coins`, inline: true }
            )
            .setFooter({ text: `Pot: ${totalPot.toLocaleString('de-DE')} Coins` })
            .setTimestamp();

        activeDuels.delete(duelId);

        await interaction.update({
            content: `🎉 ${challengerWon ? `<@${duelData.challengerId}>` : `<@${duelData.opponentId}>`} hat gewonnen!`,
            embeds: [embed],
            components: []
        });
    }
}

// Execute a coinflip duel when Finn auto-accepts
async function executeFinnCoinflipDuel(interaction, duelId, duelData) {
    // Check if both players still have enough coins
    const challengerData = db.getUserCoins(duelData.challengerId);
    const finnData = db.getUserCoins(duelData.opponentId);

    if (challengerData.coins < duelData.betAmount || finnData.coins < duelData.betAmount) {
        activeDuels.delete(duelId);
        try {
            await interaction.editReply({
                content: '❌ Ein Spieler hat nicht mehr genug Coins für dieses Duell!',
                embeds: [],
                components: []
            });
        } catch (err) {
            console.error('Error updating Finn duel (insufficient coins):', err);
        }
        return;
    }

    // Deduct coins from both players
    db.addCoins(duelData.challengerId, -duelData.betAmount, 'coinflip_duel', 'Coinflip Duell Einsatz');
    db.addCoins(duelData.opponentId, -duelData.betAmount, 'coinflip_duel', 'Coinflip Duell Einsatz');

    // Flip the coin
    const result = Math.random() < 0.5 ? 'kopf' : 'zahl';
    const challengerWon = result === duelData.challengerChoice;
    const winnerId = challengerWon ? duelData.challengerId : duelData.opponentId;
    const winnerName = challengerWon ? duelData.challengerName : 'Finn Wegbier 🍺';
    const loserId = challengerWon ? duelData.opponentId : duelData.challengerId;
    const loserName = challengerWon ? 'Finn Wegbier 🍺' : duelData.challengerName;
    const finnWon = !challengerWon;

    // Award winnings to winner (takes both bets)
    const totalPot = duelData.betAmount * 2;
    db.addCoins(winnerId, totalPot, 'coinflip_duel_win', 'Coinflip Duell Gewinn');

    const winnerBalance = db.getUserCoins(winnerId).coins;
    const loserBalance = db.getUserCoins(loserId).coins;

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⚔️ Coinflip Duell - Ergebnis!')
        .setDescription(`Die Münze wurde geworfen...`)
        .addFields(
            { name: `🎯 ${duelData.challengerName}`, value: duelData.challengerChoice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
            { name: `🎯 Finn Wegbier 🍺`, value: duelData.opponentChoice === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
            { name: '🎲 Ergebnis', value: result === 'kopf' ? '🪙 Kopf' : '🎲 Zahl', inline: true },
            { name: '🏆 Gewinner', value: `**${winnerName}**\n+${totalPot.toLocaleString('de-DE')} Coins\n💳 ${winnerBalance.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '💔 Verlierer', value: `${loserName}\n-${duelData.betAmount.toLocaleString('de-DE')} Coins\n💳 ${loserBalance.toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setFooter({ text: `Pot: ${totalPot.toLocaleString('de-DE')} Coins` })
        .setTimestamp();

    activeDuels.delete(duelId);

    try {
        // Update the original message with the result
        // Finn Wegbier bot will detect this and send his own reaction message
        await interaction.editReply({
            content: `🎉 ${challengerWon ? `<@${duelData.challengerId}>` : 'Finn Wegbier 🍺'} hat gewonnen!`,
            embeds: [embed],
            components: []
        });
    } catch (err) {
        console.error('Error updating Finn duel result:', err);
    }
}

module.exports.handleDuelButton = handleDuelButton;
