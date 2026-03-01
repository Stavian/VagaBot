const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const finnHandler = require('../utils/finnHandler');

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
        await interaction.deferReply();

        const betAmount = interaction.options.getInteger('einsatz');
        const mode = interaction.options.getString('modus') || 'standard';
        const opponent = interaction.options.getUser('gegner');
        const userId = interaction.user.id;

        // Check if user has enough coins
        const userData = db.getUserCoins(userId);
        if (userData.coins < betAmount) {
            return interaction.editReply({
                content: `❌ Du hast nicht genug Coins! Du hast nur ${userData.coins} Coins.`
            });
        }

        // PvP Mode
        if (opponent) {
            // Can't challenge yourself
            if (opponent.id === userId) {
                return interaction.editReply({
                    content: '❌ Du kannst nicht gegen dich selbst spielen!'
                });
            }

            // Can't challenge bots (except Finn Wegbier)
            if (opponent.bot && !finnHandler.isFinn(opponent.id)) {
                return interaction.editReply({
                    content: '❌ Du kannst keine Bots herausfordern!'
                });
            }

            // Check if opponent has enough coins
            const opponentData = db.getUserCoins(opponent.id);
            if (opponentData.coins < betAmount) {
                return interaction.editReply({
                    content: `❌ ${opponent.username} hat nicht genug Coins! (${opponentData.coins} Coins verfügbar)`
                });
            }

            // Create duel challenge
            const duelId = `${userId}_${opponent.id}_${Date.now()}`;

            let modeDescription;
            switch (mode) {
                case 'high':
                    modeDescription = '🎯 High Roll (Höherer Wurf gewinnt)';
                    break;
                case 'jackpot':
                    modeDescription = '🎰 Jackpot (3 gleiche Würfel gewinnt, sonst Unentschieden)';
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
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`duel_roll_cancel_${duelId}`)
                        .setLabel('🚫 Abbrechen')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
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
                    await executeFinnRollDuel(interaction, duelId, duelData);
                }, delay);
            }

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

            await interaction.editReply({ embeds: [embed] });
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

    // Only challenger can cancel
    if (action === 'cancel') {
        if (interaction.user.id !== duelData.challengerId) {
            return interaction.reply({
                content: '❌ Nur der Herausforderer kann das Duell abbrechen!',
                ephemeral: true
            });
        }

        activeDuels.delete(duelId);

        const embed = new EmbedBuilder()
            .setColor('#888888')
            .setTitle('🚫 Duell abgebrochen')
            .setDescription(`${duelData.challengerName} hat das Duell abgebrochen.`)
            .setTimestamp();

        return interaction.update({
            content: '',
            embeds: [embed],
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

// Execute a roll duel when Finn auto-accepts
async function executeFinnRollDuel(interaction, duelId, duelData) {
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
            console.error('Error updating Finn roll duel (insufficient coins):', err);
        }
        return;
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
                loserName = 'Finn Wegbier 🍺';
            } else if (opponentResult > challengerResult) {
                winnerId = duelData.opponentId;
                winnerName = 'Finn Wegbier 🍺';
                loserId = duelData.challengerId;
                loserName = duelData.challengerName;
            } else {
                tie = true;
            }

            resultDescription = `🎯 **High Roll Modus**\n\n${duelData.challengerName}: **${challengerResult}**\nFinn Wegbier 🍺: **${opponentResult}**`;
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
                loserName = 'Finn Wegbier 🍺';
            } else if (opponentJackpot && !challengerJackpot) {
                winnerId = duelData.opponentId;
                winnerName = 'Finn Wegbier 🍺';
                loserId = duelData.challengerId;
                loserName = duelData.challengerName;
            } else {
                tie = true;
            }

            resultDescription = `🎰 **Jackpot Modus**\n\n${duelData.challengerName}: **${c1}** | **${c2}** | **${c3}** ${challengerJackpot ? '🎉 JACKPOT!' : ''}\nFinn Wegbier 🍺: **${o1}** | **${o2}** | **${o3}** ${opponentJackpot ? '🎉 JACKPOT!' : ''}`;
            break;

        case 'standard':
        default:
            challengerResult = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
            opponentResult = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;

            if (challengerResult > opponentResult) {
                winnerId = duelData.challengerId;
                winnerName = duelData.challengerName;
                loserId = duelData.opponentId;
                loserName = 'Finn Wegbier 🍺';
            } else if (opponentResult > challengerResult) {
                winnerId = duelData.opponentId;
                winnerName = 'Finn Wegbier 🍺';
                loserId = duelData.challengerId;
                loserName = duelData.challengerName;
            } else {
                tie = true;
            }

            resultDescription = `🎲 **Standard Modus**\n\n${duelData.challengerName}: **${challengerResult}**\nFinn Wegbier 🍺: **${opponentResult}**`;
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

        try {
            // Finn Wegbier bot will detect this and send his own reaction message
            await interaction.editReply({
                content: '🤝 Unentschieden!',
                embeds: [embed],
                components: []
            });
        } catch (err) {
            console.error('Error updating Finn roll tie:', err);
        }
        return;
    }

    // Determine if Finn won
    const finnWon = winnerId === duelData.opponentId;

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

    try {
        // Finn Wegbier bot will detect this and send his own reaction message
        await interaction.editReply({
            content: `🎉 ${finnWon ? 'Finn Wegbier 🍺' : `<@${duelData.challengerId}>`} hat gewonnen!`,
            embeds: [embed],
            components: []
        });
    } catch (err) {
        console.error('Error updating Finn roll result:', err);
    }
}

module.exports.handleDuelButton = handleDuelButton;
