const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');

// Store active games
const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Russisches Roulette - Solo oder mit Freunden!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('solo')
                .setDescription('Spiele solo (1/6 Chance auf 60s Timeout)'))
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
    // Check if the bot can actually timeout members
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ Ich habe keine Berechtigung, Mitglieder stummzuschalten (Moderate Members).', ephemeral: true });
    }

    // Check if the target is moderateable (admins/owners usually aren't)
    if (!interaction.member.moderatable) {
        return interaction.reply({ content: '🛡️ Du bist zu mächtig für dieses Spiel (kann nicht gemuted werden).', ephemeral: true });
    }

    const chance = Math.floor(Math.random() * 6); // 0 to 5

    if (chance === 0) {
        try {
            await interaction.member.timeout(60 * 1000, 'Verloren beim Russischen Roulette');
            await interaction.reply('💥 **PENG!** Das war die Kugel. Bis in 60 Sekunden!');
        } catch (error) {
            console.error('Roulette error:', error);
            await interaction.reply({ content: 'Fehler beim Ausführen des Timeouts.', ephemeral: true });
        }
    } else {
        await interaction.reply('🔫 *Klick*... Glück gehabt! Die Kammer war leer.');
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

    // Deduct coins from all players
    for (const player of gameData.players) {
        db.addCoins(player.id, -gameData.betAmount, 'roulette_game', 'Russisches Roulette Einsatz');
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
