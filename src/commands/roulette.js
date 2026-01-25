const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');

// Store active games
const activeGames = new Map();
const soloGames = new Map(); // Store solo roulette games

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Russisches Roulette - Solo oder mit Freunden!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('solo')
                .setDescription('Überlebe das Magazin! 2 Kugeln, 6 Kammern - Verlust = 5x Einsatz + 60s Timeout!')
                .addIntegerOption(option =>
                    option.setName('einsatz')
                        .setDescription('Einsatz (Multiplikator +1.0x pro Schuss, Verlust = 5x Einsatz)')
                        .setRequired(true)
                        .setMinValue(10)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starte ein Roulette-Spiel mit Einsatz')
                .addIntegerOption(option =>
                    option.setName('einsatz')
                        .setDescription('Einsatz pro Spieler (winner takes all)')
                        .setRequired(true)
                        .setMinValue(10))
                .addIntegerOption(option =>
                    option.setName('max_spieler')
                        .setDescription('Maximum Spieler (2-6)')
                        .setRequired(false)
                        .setMinValue(2)
                        .setMaxValue(6))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'solo') {
            return handleSolo(interaction);
        } else if (subcommand === 'start') {
            return handleStart(interaction);
        }
    }
};

async function handleSolo(interaction) {
    const betAmount = interaction.options.getInteger('einsatz');
    const userId = interaction.user.id;

    // Check if user already has an active solo game
    if (soloGames.has(userId)) {
        return interaction.reply({
            content: '❌ Du hast bereits ein aktives Solo-Roulette Spiel!',
            ephemeral: true
        });
    }

    // Check if the bot can actually timeout members
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Ich habe keine Berechtigung, Mitglieder stummzuschalten (Moderate Members).', ephemeral: true });
    }

    // Check if the target is moderateable (admins/owners usually aren't)
    if (!interaction.member.moderatable) {
        return interaction.reply({ content: '🛡️ Du bist zu mächtig für dieses Spiel (kann nicht gemuted werden).', ephemeral: true });
    }

    // Check if user has enough coins (need 5x for potential loss)
    const userData = db.getUserCoins(userId);
    const requiredCoins = betAmount * 5; // Need 5x for bet + potential penalty
    if (userData.coins < requiredCoins) {
        return interaction.reply({
            content: `❌ Du hast nicht genug Coins! Du brauchst mindestens ${requiredCoins.toLocaleString('de-DE')} Coins (5x Einsatz für möglichen Verlust).\n💳 Dein Kontostand: ${userData.coins.toLocaleString('de-DE')} Coins`,
            ephemeral: true
        });
    }

    // Check daily betting limit
    const betCheck = db.canBet(userId, betAmount, 500);
    if (!betCheck.canBet) {
        return interaction.reply({
            content: `❌ Tägliches Wettlimit erreicht!\n💰 Bereits gesetzt heute: ${betCheck.currentAmount} Coins\n📊 Tägliches Limit: ${betCheck.dailyLimit} Coins\n✅ Verbleibend: ${betCheck.remainingAmount} Coins`,
            ephemeral: true
        });
    }

    // Create magazine with bullets
    const chambers = 6;
    const bullets = 2; // 2 bullets in 6 chambers
    const magazine = Array(chambers).fill('empty');

    // Place bullets randomly
    const bulletPositions = [];
    while (bulletPositions.length < bullets) {
        const pos = Math.floor(Math.random() * chambers);
        if (!bulletPositions.includes(pos)) {
            bulletPositions.push(pos);
            magazine[pos] = 'bullet';
        }
    }

    // Deduct bet and add to daily limit
    db.addCoins(userId, -betAmount, 'roulette_solo_bet', 'Solo Roulette Einsatz');
    db.addToBetLimit(userId, betAmount);

    // Create game state
    const gameData = {
        userId,
        betAmount,
        magazine,
        bullets,
        currentChamber: 0,
        chambersRemaining: chambers,
        multiplier: 0.5, // Start at 0.5x
        chambersCleared: 0
    };

    soloGames.set(userId, gameData);

    // Show starting state
    await showSoloGameState(interaction, gameData);
}

async function showSoloGameState(interaction, gameData) {
    const chamberDisplay = '🔫 ' + Array(6).fill('⚪').map((c, i) =>
        i < gameData.chambersCleared ? '✅' : '⚪'
    ).join(' ');

    const potentialWin = Math.floor(gameData.betAmount * gameData.multiplier);
    const potentialLoss = gameData.betAmount * 5; // Total loss if shot

    const embed = new EmbedBuilder()
        .setColor('#FF4444')
        .setTitle('🔫 Russisches Roulette - Solo')
        .setDescription(`**Magazin:** ${chamberDisplay}\n**Kammern übrig:** ${gameData.chambersRemaining}/6\n**Kugeln im Magazin:** 2\n\n${gameData.chambersCleared === 0 ? '**Drücke ab oder nimm dein Geld!**' : '**Glück gehabt! Weiter oder auszahlen?**'}`)
        .addFields(
            { name: '💰 Einsatz', value: `${gameData.betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '✨ Aktueller Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true },
            { name: '💵 Möglicher Gewinn', value: `${potentialWin.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '💀 Verlust bei Kugel', value: `-${potentialLoss.toLocaleString('de-DE')} Coins (5x)`, inline: true }
        )
        .setFooter({ text: 'Jeder überlebte Schuss erhöht den Multiplikator um +1.0x! Kugel = 5x Verlust + 60s Timeout' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`roulette_solo_pull_${gameData.userId}`)
                .setLabel('🔫 Abdrücken')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`roulette_solo_cashout_${gameData.userId}`)
                .setLabel('💰 Auszahlen')
                .setStyle(ButtonStyle.Success)
                .setDisabled(gameData.chambersCleared === 0) // Can't cash out on first round
        );

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row] });
    }
}

async function handleStart(interaction) {
    const betAmount = interaction.options.getInteger('einsatz');
    const maxPlayers = interaction.options.getInteger('max_spieler') || 4;
    const userId = interaction.user.id;

    // Check bot permissions
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Ich habe keine Berechtigung, Mitglieder stummzuschalten (Moderate Members).', ephemeral: true });
    }

    // Check if user has enough coins
    const userData = db.getUserCoins(userId);
    if (userData.coins < betAmount) {
        return interaction.reply({
            content: `❌ Du hast nicht genug Coins! Du hast nur ${userData.coins} Coins.`,
            ephemeral: true
        });
    }

    // Check daily betting limit
    const betCheck = db.canBet(userId, betAmount, 1000);
    if (!betCheck.canBet) {
        return interaction.reply({
            content: `❌ Tägliches Wettlimit erreicht!\n💰 Bereits gesetzt heute: ${betCheck.currentAmount} Coins\n📊 Tägliches Limit: ${betCheck.dailyLimit} Coins\n✅ Verbleibend: ${betCheck.remainingAmount} Coins`,
            ephemeral: true
        });
    }

    // Create game
    const gameId = `${userId}_${Date.now()}`;
    const gameData = {
        hostId: userId,
        hostName: interaction.user.username,
        betAmount: betAmount,
        maxPlayers: maxPlayers,
        players: [{ id: userId, name: interaction.user.username }],
        status: 'waiting',
        channelId: interaction.channelId,
        timestamp: Date.now()
    };

    activeGames.set(gameId, gameData);

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔫 Russisches Roulette!')
        .setDescription(`${interaction.user.username} hat ein Roulette-Spiel gestartet!\n\n**Wie es funktioniert:**\nJeder Spieler zahlt ${betAmount.toLocaleString('de-DE')} Coins. Dann ziehen alle nacheinander. Wer die Kugel zieht, bekommt einen 60s Timeout UND verliert seinen Einsatz. Der **letzte Überlebende** gewinnt den gesamten Pot!`)
        .addFields(
            { name: '💰 Einsatz pro Spieler', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '👥 Spieler', value: `1/${maxPlayers}`, inline: true },
            { name: '🎰 Aktueller Pot', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎮 Spieler dabei', value: `• ${interaction.user.username}`, inline: false },
            { name: '⏰ Start', value: 'Wenn alle beigetreten sind oder nach 60 Sekunden', inline: false }
        )
        .setFooter({ text: 'Klicke auf "Beitreten" um mitzuspielen!' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`roulette_join_${gameId}`)
                .setLabel('🎲 Beitreten')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`roulette_start_${gameId}`)
                .setLabel('▶️ Jetzt starten')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`roulette_cancel_${gameId}`)
                .setLabel('❌ Abbrechen')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.reply({
        embeds: [embed],
        components: [row]
    });

    // Auto-start after 60 seconds if at least 2 players
    setTimeout(async () => {
        const game = activeGames.get(gameId);
        if (game && game.status === 'waiting' && game.players.length >= 2) {
            await startGame(interaction, gameId);
        } else if (game && game.status === 'waiting') {
            // Cancel if only 1 player
            activeGames.delete(gameId);
            await interaction.editReply({
                content: '⚠️ Spiel abgebrochen - nicht genug Spieler.',
                embeds: [],
                components: []
            });
        }
    }, 60000);
}

async function startGame(interaction, gameId) {
    const gameData = activeGames.get(gameId);
    if (!gameData || gameData.status !== 'waiting') return;

    // Deduct coins from all players and add to daily bet limit
    for (const player of gameData.players) {
        db.addCoins(player.id, -gameData.betAmount, 'roulette_game', 'Russisches Roulette Einsatz');
        db.addToBetLimit(player.id, gameData.betAmount);
    }

    gameData.status = 'playing';
    gameData.alive = [...gameData.players];
    gameData.round = 1;

    // Play rounds until one player remains
    let resultMessages = [];

    while (gameData.alive.length > 1) {
        const currentPlayer = gameData.alive[0];
        const shot = Math.floor(Math.random() * 6) === 0; // 1/6 chance

        if (shot) {
            // Player hit - remove from alive list and timeout
            resultMessages.push(`💥 **${currentPlayer.name}** - PENG! Ausgeschieden!`);
            gameData.alive.shift();

            // Try to timeout the player
            try {
                const member = await interaction.guild.members.fetch(currentPlayer.id);
                if (member.moderatable) {
                    await member.timeout(60 * 1000, 'Verloren beim Russischen Roulette');
                }
            } catch (error) {
                console.error('Timeout error:', error);
            }
        } else {
            // Player survived - move to back of queue
            resultMessages.push(`🔫 **${currentPlayer.name}** - *Klick*... überlebt!`);
            gameData.alive.push(gameData.alive.shift());
        }

        gameData.round++;
    }

    // Winner!
    const winner = gameData.alive[0];
    const totalPot = gameData.betAmount * gameData.players.length;
    db.addCoins(winner.id, totalPot, 'roulette_win', 'Russisches Roulette Gewinn');

    const winnerBalance = db.getUserCoins(winner.id).coins;

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🔫 Russisches Roulette - ERGEBNIS!')
        .setDescription(resultMessages.join('\n'))
        .addFields(
            { name: '🏆 Gewinner', value: `**${winner.name}**`, inline: true },
            { name: '💰 Gewinn', value: `+${totalPot.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '💳 Neuer Kontostand', value: `${winnerBalance.toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setFooter({ text: `${gameData.players.length} Spieler, ${gameData.round} Schüsse` })
        .setTimestamp();

    activeGames.delete(gameId);

    await interaction.editReply({
        content: `🎉 <@${winner.id}> hat überlebt und gewinnt!`,
        embeds: [embed],
        components: []
    });
}

// Handle solo game button actions
async function handleSoloPull(interaction) {
    const userId = interaction.user.id;
    const gameData = soloGames.get(userId);

    if (!gameData) {
        return interaction.update({
            content: '⚠️ Spiel nicht gefunden oder bereits beendet.',
            embeds: [],
            components: []
        });
    }

    // Check current chamber
    const currentChamber = gameData.magazine[gameData.currentChamber];

    if (currentChamber === 'bullet') {
        // Hit a bullet - player loses additional bet amount as penalty (total 5x loss)
        try {
            const penalty = gameData.betAmount * 4; // Additional 4x bet lost
            db.addCoins(userId, -penalty, 'roulette_solo_penalty', 'Solo Roulette Strafverlust');

            await interaction.member.timeout(60 * 1000, 'Verloren beim Russischen Roulette');
            const newBalance = db.getUserCoins(userId).coins;
            const totalLoss = gameData.betAmount + penalty;

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('💥 PENG!')
                .setDescription(`**Du hast eine Kugel erwischt!**\n\n🔫 Kammer ${gameData.currentChamber + 1}/6 hatte eine Kugel!\n⏱️ Bis in 60 Sekunden...`)
                .addFields(
                    { name: '💸 Verlust', value: `-${totalLoss.toLocaleString('de-DE')} Coins (1x Einsatz + 4x Strafe = 5x Gesamt)`, inline: false },
                    { name: '📊 Überlebte Schüsse', value: `${gameData.chambersCleared}`, inline: true },
                    { name: '💳 Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: true }
                )
                .setTimestamp();

            soloGames.delete(userId);
            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            console.error('Timeout error:', error);
            await interaction.update({ content: 'Fehler beim Timeout.', embeds: [], components: [] });
        }
    } else {
        // Survived - increase multiplier
        gameData.currentChamber++;
        gameData.chambersRemaining--;
        gameData.chambersCleared++;
        gameData.multiplier += 1.0; // Increase by 1.0x each round

        // Check if all chambers cleared (impossible to lose)
        if (gameData.chambersRemaining === gameData.bullets) {
            // Auto cash out - only bullets left
            const winAmount = Math.floor(gameData.betAmount * gameData.multiplier);
            db.addCoins(userId, winAmount, 'roulette_solo_win', 'Solo Roulette Gewinn (Vollständig)');
            const newBalance = db.getUserCoins(userId).coins;

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎉 PERFEKT! Alle sicheren Kammern überlebt!')
                .setDescription(`**Du hast ${gameData.chambersCleared} Kammern überlebt!**\n\nNur noch Kugeln übrig - automatische Auszahlung!`)
                .addFields(
                    { name: '✨ Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true },
                    { name: '🎁 Gewinn', value: `+${winAmount.toLocaleString('de-DE')} Coins`, inline: true },
                    { name: '💳 Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: true }
                )
                .setTimestamp();

            soloGames.delete(userId);
            await interaction.update({ embeds: [embed], components: [] });
        } else {
            // Continue game
            await interaction.deferUpdate();
            await showSoloGameState(interaction, gameData);
        }
    }
}

async function handleSoloCashout(interaction) {
    const userId = interaction.user.id;
    const gameData = soloGames.get(userId);

    if (!gameData) {
        return interaction.update({
            content: '⚠️ Spiel nicht gefunden oder bereits beendet.',
            embeds: [],
            components: []
        });
    }

    const winAmount = Math.floor(gameData.betAmount * gameData.multiplier);
    db.addCoins(userId, winAmount, 'roulette_solo_win', 'Solo Roulette Gewinn (Cashout)');
    const newBalance = db.getUserCoins(userId).coins;

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 Ausgezahlt!')
        .setDescription(`**Du hast rechtzeitig ausgestiegen!**\n\n🎯 ${gameData.chambersCleared} Kammern überlebt`)
        .addFields(
            { name: '✨ Multiplikator', value: `${gameData.multiplier.toFixed(1)}x`, inline: true },
            { name: '🎁 Gewinn', value: `+${winAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '💳 Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setTimestamp();

    soloGames.delete(userId);
    await interaction.update({ embeds: [embed], components: [] });
}

// Handle button interactions
async function handleRouletteButton(interaction, gameId, action) {
    const gameData = activeGames.get(gameId);

    if (!gameData) {
        return interaction.update({
            content: '⚠️ Dieses Spiel ist abgelaufen oder wurde bereits beendet.',
            embeds: [],
            components: []
        });
    }

    if (action === 'join') {
        // Check if already joined
        if (gameData.players.some(p => p.id === interaction.user.id)) {
            return interaction.reply({
                content: '❌ Du bist bereits dabei!',
                ephemeral: true
            });
        }

        // Check if game is full
        if (gameData.players.length >= gameData.maxPlayers) {
            return interaction.reply({
                content: '❌ Das Spiel ist bereits voll!',
                ephemeral: true
            });
        }

        // Check if user has enough coins
        const userData = db.getUserCoins(interaction.user.id);
        if (userData.coins < gameData.betAmount) {
            return interaction.reply({
                content: `❌ Du hast nicht genug Coins! Du brauchst ${gameData.betAmount.toLocaleString('de-DE')} Coins.`,
                ephemeral: true
            });
        }

        // Check daily betting limit
        const betCheck = db.canBet(interaction.user.id, gameData.betAmount, 500);
        if (!betCheck.canBet) {
            return interaction.reply({
                content: `❌ Tägliches Wettlimit erreicht!\n💰 Bereits gesetzt heute: ${betCheck.currentAmount} Coins\n📊 Tägliches Limit: ${betCheck.dailyLimit} Coins\n✅ Verbleibend: ${betCheck.remainingAmount} Coins`,
                ephemeral: true
            });
        }

        // Check if user is moderatable
        if (!interaction.member.moderatable) {
            return interaction.reply({
                content: '🛡️ Du bist zu mächtig für dieses Spiel (kann nicht gemuted werden).',
                ephemeral: true
            });
        }

        // Add player
        gameData.players.push({ id: interaction.user.id, name: interaction.user.username });

        const totalPot = gameData.betAmount * gameData.players.length;
        const playerList = gameData.players.map(p => `• ${p.name}`).join('\n');

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setFields(
                { name: '💰 Einsatz pro Spieler', value: `${gameData.betAmount.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '👥 Spieler', value: `${gameData.players.length}/${gameData.maxPlayers}`, inline: true },
                { name: '🎰 Aktueller Pot', value: `${totalPot.toLocaleString('de-DE')} Coins`, inline: true },
                { name: '🎮 Spieler dabei', value: playerList, inline: false },
                { name: '⏰ Start', value: 'Wenn alle beigetreten sind oder nach 60 Sekunden', inline: false }
            );

        await interaction.update({ embeds: [embed] });

        // Auto-start if full
        if (gameData.players.length === gameData.maxPlayers) {
            setTimeout(() => startGame(interaction, gameId), 2000);
        }

    } else if (action === 'start') {
        // Only host can start early
        if (interaction.user.id !== gameData.hostId) {
            return interaction.reply({
                content: '❌ Nur der Host kann das Spiel vorzeitig starten!',
                ephemeral: true
            });
        }

        // Need at least 2 players
        if (gameData.players.length < 2) {
            return interaction.reply({
                content: '❌ Mindestens 2 Spieler werden benötigt!',
                ephemeral: true
            });
        }

        await startGame(interaction, gameId);

    } else if (action === 'cancel') {
        // Only host can cancel
        if (interaction.user.id !== gameData.hostId) {
            return interaction.reply({
                content: '❌ Nur der Host kann das Spiel abbrechen!',
                ephemeral: true
            });
        }

        activeGames.delete(gameId);

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Spiel abgebrochen')
            .setDescription(`${gameData.hostName} hat das Spiel abgebrochen.`)
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: []
        });
    }
}

module.exports.handleRouletteButton = handleRouletteButton;
module.exports.handleSoloPull = handleSoloPull;
module.exports.handleSoloCashout = handleSoloCashout;
