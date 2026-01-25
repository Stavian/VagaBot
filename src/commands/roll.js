const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');

// Store active duels
const activeDuels = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Würfle und gewinne basierend auf deinem Wurf!')
        .addIntegerOption(option =>
            option.setName('einsatz')
                .setDescription('Wie viele Coins möchtest du setzen?')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('modus')
                .setDescription('Wähle den Spielmodus')
                .setRequired(false)
                .addChoices(
                    { name: '🎲 Standard (2 Würfel)', value: 'standard' },
                    { name: '🎯 High Roll (1 Würfel, 5+ gewinnt 1.5x)', value: 'high' },
                    { name: '🎰 Jackpot (3 Würfel, alle gleich = 10x)', value: 'jackpot' }
                ))
        .addUserOption(option =>
            option.setName('gegner')
                .setDescription('Fordere einen Spieler heraus (leer = gegen Bot)')
                .setRequired(false)),

    async execute(interaction) {
        const betAmount = interaction.options.getInteger('einsatz');
        const mode = interaction.options.getString('modus') || 'standard';
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

            // Can't challenge bots
            if (opponent.bot) {
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

            let modeDescription;
            switch (mode) {
                case 'high':
                    modeDescription = '🎯 High Roll (5+ gewinnt)';
                    break;
                case 'jackpot':
                    modeDescription = '🎰 Jackpot (3 gleiche Würfel)';
                    break;
                case 'standard':
                default:
                    modeDescription = '🎲 Standard (Höhere Summe gewinnt)';
                    break;
            }

            activeDuels.set(duelId, {
                challengerId: userId,
                challengerName: interaction.user.username,
                opponentId: opponent.id,
                opponentName: opponent.username,
                betAmount: betAmount,
                mode: mode,
                timestamp: Date.now()
            });

            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚔️ Würfel Duell!')
                .setDescription(`${interaction.user} fordert ${opponent} zu einem Würfel-Duell heraus!`)
                .addFields(
                    { name: '💰 Einsatz', value: `${betAmount.toLocaleString('de-DE')} Coins pro Spieler`, inline: true },
                    { name: '🎮 Modus', value: modeDescription, inline: true },
                    { name: '⏰ Verfällt in', value: '60 Sekunden', inline: false }
                )
                .setFooter({ text: `${opponent.username}, akzeptiere oder lehne das Duell ab!` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`duel_roll_accept_${duelId}`)
                        .setLabel('✅ Akzeptieren')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`duel_roll_decline_${duelId}`)
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

        } else {
            // Solo mode vs Bot
            db.addCoins(userId, -betAmount, 'dice_roll', 'Dice Roll Einsatz');

            let result, won, multiplier, description;

            switch (mode) {
                case 'high':
                    result = Math.floor(Math.random() * 6) + 1;
                    won = result > 4;
                    multiplier = won ? 1.5 : 0;
                    description = `🎯 **High Roll Modus**\n\nDu würfelst: **${result}**\n${won ? '5 oder 6! Du gewinnst!' : 'Unter 5... Verloren!'}`;
                    break;

                case 'jackpot':
                    const dice1 = Math.floor(Math.random() * 6) + 1;
                    const dice2 = Math.floor(Math.random() * 6) + 1;
                    const dice3 = Math.floor(Math.random() * 6) + 1;
                    result = [dice1, dice2, dice3];
                    won = dice1 === dice2 && dice2 === dice3;
                    multiplier = won ? 10 : 0;
                    description = `🎰 **Jackpot Modus**\n\nDeine Würfel: **${dice1}** | **${dice2}** | **${dice3}**\n${won ? '🎉 JACKPOT! Alle drei gleich!' : 'Nicht alle gleich... Versuch es nochmal!'}`;
                    break;

                case 'standard':
                default:
                    const userRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
                    const botRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
                    result = { user: userRoll, bot: botRoll };
                    won = userRoll > botRoll;
                    const tie = userRoll === botRoll;
                    multiplier = won ? 2 : (tie ? 1 : 0);
                    description = `🎲 **Standard Modus**\n\n🎯 Dein Wurf: **${userRoll}**\n🤖 Bot Wurf: **${botRoll}**\n\n${won ? '🎉 Du gewinnst!' : (tie ? '🤝 Unentschieden!' : '💔 Du verlierst!')}`;
                    break;
            }

            const embed = new EmbedBuilder()
                .setColor(won ? '#00FF00' : (multiplier === 1 ? '#FFD700' : '#FF0000'))
                .setTitle('🎲 Dice Roll!')
                .setDescription(description)
                .addFields(
                    { name: '💰 Einsatz', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true }
                )
                .setTimestamp();

            if (won || multiplier === 1) {
                const winnings = Math.floor(betAmount * multiplier);
                db.addCoins(userId, winnings, 'dice_roll_win', 'Dice Roll Gewinn');
                const newBalance = db.getUserCoins(userId).coins;

                embed.addFields(
                    { name: '✨ Multiplikator', value: `${multiplier}x`, inline: true },
                    { name: '🎁 Gewinn', value: `+${winnings.toLocaleString('de-DE')} Coins`, inline: true },
                    { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: false }
                );
            } else {
                const newBalance = db.getUserCoins(userId).coins;
                embed.addFields(
                    { name: '💔 Verloren', value: `-${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
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
        db.addCoins(duelData.challengerId, -duelData.betAmount, 'dice_roll_duel', 'Dice Roll Duell Einsatz');
        db.addCoins(duelData.opponentId, -duelData.betAmount, 'dice_roll_duel', 'Dice Roll Duell Einsatz');

        // Roll based on mode
        let challengerResult, opponentResult, winnerId, winnerName, loserId, loserName, resultDescription, tie = false;

        const mode = duelData.mode;

        switch (mode) {
            case 'high':
                challengerResult = Math.floor(Math.random() * 6) + 1;
                opponentResult = Math.floor(Math.random() * 6) + 1;

                if (challengerResult > opponentResult) {
                    winnerId = duelData.challengerId;
                    winnerName = duelData.challengerName;
                    loserId = duelData.opponentId;
                    loserName = duelData.opponentName;
                } else if (opponentResult > challengerResult) {
                    winnerId = duelData.opponentId;
                    winnerName = duelData.opponentName;
                    loserId = duelData.challengerId;
                    loserName = duelData.challengerName;
                } else {
                    tie = true;
                }

                resultDescription = `🎯 **High Roll Modus**\n\n${duelData.challengerName}: **${challengerResult}**\n${duelData.opponentName}: **${opponentResult}**`;
                break;

            case 'jackpot':
                const c1 = Math.floor(Math.random() * 6) + 1;
                const c2 = Math.floor(Math.random() * 6) + 1;
                const c3 = Math.floor(Math.random() * 6) + 1;
                const challengerJackpot = c1 === c2 && c2 === c3;

                const o1 = Math.floor(Math.random() * 6) + 1;
                const o2 = Math.floor(Math.random() * 6) + 1;
                const o3 = Math.floor(Math.random() * 6) + 1;
                const opponentJackpot = o1 === o2 && o2 === o3;

                challengerResult = { d1: c1, d2: c2, d3: c3, jackpot: challengerJackpot };
                opponentResult = { d1: o1, d2: o2, d3: o3, jackpot: opponentJackpot };

                if (challengerJackpot && !opponentJackpot) {
                    winnerId = duelData.challengerId;
                    winnerName = duelData.challengerName;
                    loserId = duelData.opponentId;
                    loserName = duelData.opponentName;
                } else if (opponentJackpot && !challengerJackpot) {
                    winnerId = duelData.opponentId;
                    winnerName = duelData.opponentName;
                    loserId = duelData.challengerId;
                    loserName = duelData.challengerName;
                } else {
                    tie = true;
                }

                resultDescription = `🎰 **Jackpot Modus**\n\n${duelData.challengerName}: **${c1}** | **${c2}** | **${c3}** ${challengerJackpot ? '🎉 JACKPOT!' : ''}\n${duelData.opponentName}: **${o1}** | **${o2}** | **${o3}** ${opponentJackpot ? '🎉 JACKPOT!' : ''}`;
                break;

            case 'standard':
            default:
                challengerResult = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
                opponentResult = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;

                if (challengerResult > opponentResult) {
                    winnerId = duelData.challengerId;
                    winnerName = duelData.challengerName;
                    loserId = duelData.opponentId;
                    loserName = duelData.opponentName;
                } else if (opponentResult > challengerResult) {
                    winnerId = duelData.opponentId;
                    winnerName = duelData.opponentName;
                    loserId = duelData.challengerId;
                    loserName = duelData.challengerName;
                } else {
                    tie = true;
                }

                resultDescription = `🎲 **Standard Modus**\n\n${duelData.challengerName}: **${challengerResult}**\n${duelData.opponentName}: **${opponentResult}**`;
                break;
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Würfel Duell - Ergebnis!')
            .setDescription(resultDescription)
            .setTimestamp();

        if (tie) {
            // Refund both players
            db.addCoins(duelData.challengerId, duelData.betAmount, 'dice_roll_duel_tie', 'Dice Roll Duell Unentschieden');
            db.addCoins(duelData.opponentId, duelData.betAmount, 'dice_roll_duel_tie', 'Dice Roll Duell Unentschieden');

            embed.setColor('#FFD700')
                .addFields(
                    { name: '🤝 Unentschieden!', value: `Beide Spieler erhalten ihre ${duelData.betAmount.toLocaleString('de-DE')} Coins zurück.`, inline: false }
                );

            activeDuels.delete(duelId);

            return interaction.update({
                content: '🤝 Unentschieden!',
                embeds: [embed],
                components: []
            });
        }

        // Award winnings to winner (takes both bets)
        const totalPot = duelData.betAmount * 2;
        db.addCoins(winnerId, totalPot, 'dice_roll_duel_win', 'Dice Roll Duell Gewinn');

        const winnerBalance = db.getUserCoins(winnerId).coins;
        const loserBalance = db.getUserCoins(loserId).coins;

        embed.setColor('#FFD700')
            .addFields(
                { name: '🏆 Gewinner', value: `**${winnerName}**\n+${totalPot.toLocaleString('de-DE')} Coins\n💳 ${winnerBalance.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '💔 Verlierer', value: `${loserName}\n-${duelData.betAmount.toLocaleString('de-DE')} Coins\n💳 ${loserBalance.toLocaleString('de-DE')} Coins`, inline: true }
            )
            .setFooter({ text: `Pot: ${totalPot.toLocaleString('de-DE')} Coins` });

        activeDuels.delete(duelId);

        await interaction.update({
            content: `🎉 <@${winnerId}> hat gewonnen!`,
            embeds: [embed],
            components: []
        });
    }
}

module.exports.handleDuelButton = handleDuelButton;
