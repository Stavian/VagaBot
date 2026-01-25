const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database');
const {
    createDeck,
    shuffleDeck,
    dealCards,
    isPlayable,
    getPlayableIndices,
    applyActionCard,
    checkWinCondition,
    triggerChaosCard,
    getColorEmoji,
    getCardDisplayName,
    getNextPlayerIndex,
    hasUNO,
    CARD_TYPES
} = require('../utils/unoGame');
const { renderHand, renderTableView, renderColorPicker } = require('../utils/unoRenderer');

// Store active games
const activeGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uno')
        .setDescription('Spiele VagaUNO mit Freunden!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starte ein neues UNO-Spiel')
                .addIntegerOption(option =>
                    option.setName('einsatz')
                        .setDescription('Einsatz pro Spieler (Winner takes all)')
                        .setRequired(true)
                        .setMinValue(10))
                .addIntegerOption(option =>
                    option.setName('max_spieler')
                        .setDescription('Maximum Spieler (2-6)')
                        .setRequired(false)
                        .setMinValue(2)
                        .setMaxValue(6)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rules')
                .setDescription('Zeige VagaUNO Spielregeln')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            return handleStart(interaction);
        } else if (subcommand === 'rules') {
            return handleRules(interaction);
        }
    }
};

/**
 * Handle /uno start - Create lobby
 */
async function handleStart(interaction) {
    const betAmount = interaction.options.getInteger('einsatz');
    const maxPlayers = interaction.options.getInteger('max_spieler') || 4;
    const userId = interaction.user.id;

    // Check if user has enough coins
    const userData = db.getUserCoins(userId);
    if (userData.coins < betAmount) {
        return interaction.reply({
            content: `❌ Du hast nicht genug Coins! Du hast nur ${userData.coins.toLocaleString('de-DE')} Coins.`,
            ephemeral: true
        });
    }

    // Create game
    const gameId = `${userId}_${Date.now()}`;
    const gameData = {
        gameId,
        hostId: userId,
        hostName: interaction.user.username,
        betAmount,
        maxPlayers,
        players: [{ id: userId, username: interaction.user.username, hand: [], hasCalledUno: false }],
        deck: [],
        discardPile: [],
        currentCard: null,
        currentPlayerIndex: 0,
        direction: 1,
        status: 'waiting',
        originalChannelId: interaction.channelId,
        channelId: interaction.channelId,
        messageId: null,
        gameMessageId: null,
        tempChannelId: null,
        colorPickerMessageId: null,
        turnTimeout: null,
        chaosEvents: [],
        turnsTaken: 0,
        createdAt: Date.now()
    };

    activeGames.set(gameId, gameData);

    const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🎴 VagaUNO - Lobby')
        .setDescription(`${interaction.user.username} hat ein VagaUNO-Spiel gestartet!\n\n**Wie es funktioniert:**\nJeder Spieler zahlt ${betAmount.toLocaleString('de-DE')} Coins. Spiele passende Karten und entleere deine Hand als Erster. Der Gewinner bekommt den gesamten Pot!\n\n⚡ **Mystery Twist:** 4 Chaos-Karten sind im Deck versteckt!`)
        .addFields(
            { name: '💰 Einsatz', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '👥 Spieler', value: `1/${maxPlayers}`, inline: true },
            { name: '🎰 Pot', value: `${betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎮 Dabei', value: `• ${interaction.user.username}`, inline: false }
        )
        .setFooter({ text: 'Klicke auf "Beitreten" um mitzuspielen!' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`uno_join_${gameId}`)
                .setLabel('🎲 Beitreten')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`uno_start_${gameId}`)
                .setLabel('▶️ Jetzt starten')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`uno_cancel_${gameId}`)
                .setLabel('❌ Abbrechen')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.reply({ embeds: [embed], components: [row] });

    // Auto-start after 60 seconds if at least 2 players
    setTimeout(async () => {
        const game = activeGames.get(gameId);
        if (game && game.status === 'waiting' && game.players.length >= 2) {
            await startGameLogic(interaction, gameId);
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

/**
 * Handle /uno rules - Show rules
 */
async function handleRules(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🎴 VagaUNO - Spielregeln')
        .setDescription('Klassisches UNO mit einem chaotischen Twist!')
        .addFields(
            { name: '🎯 Ziel', value: 'Spiele alle deine Karten als Erster und gewinne den Pot!', inline: false },
            { name: '🃏 Spielen', value: 'Spiele Karten die zur Farbe ODER Zahl der aktuellen Karte passen.', inline: false },
            { name: '📥 Ziehen', value: 'Wenn du keine passende Karte hast, ziehe 1 Karte vom Stapel.', inline: false },
            { name: '⊘ Skip', value: 'Überspringt den nächsten Spieler.', inline: true },
            { name: '⟲ Reverse', value: 'Kehrt die Spielrichtung um.', inline: true },
            { name: '+2', value: 'Nächster Spieler zieht 2 Karten.', inline: true },
            { name: '🌈 Wild', value: 'Wähle eine neue Farbe.', inline: true },
            { name: '+4 Wild', value: 'Wähle Farbe, nächster zieht 4.', inline: true },
            { name: '❗ UNO', value: 'Rufe "UNO" wenn du nur 1 Karte hast!', inline: true },
            { name: '⚡ CHAOS KARTEN', value: '**Coin Heist** - Stehle Coins!\n**Card Swap** - Tausche deine Hand!\n**Everyone Draws** - Alle ziehen 2!\n**Color Chaos** - Alle Farben ändern sich!', inline: false }
        )
        .setFooter({ text: 'Viel Glück!' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Start the game (deal cards, begin first turn)
 */
async function startGameLogic(interaction, gameId) {
    const gameData = activeGames.get(gameId);
    if (!gameData || gameData.status !== 'waiting') return;

    // Deduct coins from all players
    for (const player of gameData.players) {
        db.addCoins(player.id, -gameData.betAmount, 'uno_bet', 'VagaUNO Einsatz');
    }

    // Create and shuffle deck
    let deck = createDeck(true);
    deck = shuffleDeck(deck);

    // Deal cards
    const { hands, remainingDeck } = dealCards(deck, gameData.players.length, 7);
    gameData.players.forEach((player, idx) => {
        player.hand = hands[idx];
    });
    gameData.deck = remainingDeck;

    // Draw first card (skip wilds)
    let firstCard;
    do {
        firstCard = gameData.deck.pop();
    } while (firstCard.type === CARD_TYPES.WILD || firstCard.type === CARD_TYPES.WILD_DRAW_FOUR);

    gameData.discardPile.push(firstCard);
    gameData.currentCard = firstCard;
    gameData.status = 'playing';

    // Update lobby message
    const totalPot = gameData.betAmount * gameData.players.length;
    const startEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🎴 VagaUNO - Spiel gestartet!')
        .setDescription(`Das Spiel hat begonnen! ${gameData.players.length} Spieler kämpfen um ${totalPot.toLocaleString('de-DE')} Coins.\n\n🎮 Ein temporärer Kanal wird erstellt...`)
        .setTimestamp();

    await interaction.editReply({ embeds: [startEmbed], components: [] });

    // Create temporary game channel
    try {
        const guild = interaction.guild;
        const tempChannel = await guild.channels.create({
            name: `uno-${gameData.players.map(p => p.username).join('-').substring(0, 30)}`,
            type: ChannelType.GuildText,
            parent: '1287496684443537488', // Category ID for UNO games
            reason: `VagaUNO Spiel von ${gameData.hostName}`
        });

        // Set permissions after creation
        await tempChannel.permissionOverwrites.set([
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            ...gameData.players.map(player => ({
                id: player.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            })),
            {
                id: interaction.client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
            }
        ]);

        gameData.tempChannelId = tempChannel.id;
        gameData.channelId = tempChannel.id;

        // Send welcome message to temp channel
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🎴 VagaUNO - Willkommen!')
            .setDescription(`**Spieler:** ${gameData.players.map(p => `<@${p.id}>`).join(', ')}\n**Pot:** ${totalPot.toLocaleString('de-DE')} Coins\n\n✨ Viel Glück! ✨`)
            .addFields(
                { name: '📋 Regeln', value: 'Spiele passende Farbe oder Zahl. Nutze die Buttons zum Spielen!', inline: false },
                { name: '👁️ Hand ansehen', value: 'Klicke auf "👁️ Hand ansehen" um deine Karten zu sehen', inline: false },
                { name: '💡 Tipp', value: 'Grün markiert = Gegner kann diese Farbe/Zahl spielen', inline: false }
            )
            .setTimestamp();

        await tempChannel.send({ embeds: [welcomeEmbed] });

        // Create main game message
        const gameMessage = await tempChannel.send({ content: '⏳ Spiel wird vorbereitet...' });
        gameData.gameMessageId = gameMessage.id;

        // Update lobby message with channel link
        const finalEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🎴 VagaUNO - Kanal erstellt!')
            .setDescription(`Das Spiel läuft jetzt in <#${tempChannel.id}>!\n\nDer Kanal wird nach dem Spiel automatisch gelöscht.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [finalEmbed], components: [] });

        // Start first turn
        await processTurn(interaction, gameId);
    } catch (error) {
        console.error('Error creating temp channel:', error);
        await interaction.followUp({
            content: '❌ Fehler beim Erstellen des Spielkanals. Bitte versuche es erneut.',
            ephemeral: true
        });
        activeGames.delete(gameId);
    }
}

/**
 * Show player's hand ephemerally (called from button interaction)
 */
async function showHandEphemeral(interaction, gameId) {
    const gameData = activeGames.get(gameId);
    if (!gameData) {
        return interaction.reply({
            content: '⚠️ Dieses Spiel existiert nicht mehr.',
            ephemeral: true
        });
    }

    const player = gameData.players.find(p => p.id === interaction.user.id);
    if (!player) {
        return interaction.reply({
            content: '❌ Du bist nicht in diesem Spiel!',
            ephemeral: true
        });
    }

    const playableIndices = getPlayableIndices(player.hand, gameData.currentCard);

    try {
        const handImage = await renderHand(player.hand, player.username, playableIndices);
        const attachment = new AttachmentBuilder(handImage, { name: 'hand.png' });

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`🃏 Deine Hand (${player.hand.length} Karten)`)
            .setDescription(`**Aktuelle Karte:** ${getCardDisplayName(gameData.currentCard)}\n**Status:** ${gameData.players[gameData.currentPlayerIndex].id === interaction.user.id ? '✅ Du bist am Zug!' : '⏳ Warte auf deinen Zug'}`)
            .setImage('attachment://hand.png')
            .addFields(
                { name: '✅ Spielbare Karten', value: playableIndices.length > 0 ? playableIndices.map(i => `#${i}`).join(', ') : 'Keine - Du musst ziehen!', inline: false }
            );

        await interaction.reply({
            embeds: [embed],
            files: [attachment],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error rendering hand:', error);
        await interaction.reply({
            content: '❌ Fehler beim Anzeigen deiner Hand.',
            ephemeral: true
        });
    }
}

/**
 * Process current player's turn
 */
async function processTurn(interaction, gameId) {
    const gameData = activeGames.get(gameId);
    if (!gameData || gameData.status !== 'playing') return;

    // Clean up old messages (keep only welcome message and game board)
    try {
        const channel = await interaction.client.channels.fetch(gameData.channelId);
        const messages = await channel.messages.fetch({ limit: 100 });
        const messagesToDelete = messages.filter(msg =>
            msg.id !== gameData.gameMessageId && // Keep game board
            !msg.embeds.some(e => e.title === '🎴 VagaUNO - Willkommen!') && // Keep welcome message
            msg.createdTimestamp > Date.now() - 14 * 24 * 60 * 60 * 1000 // Only messages newer than 14 days can be bulk deleted
        );

        if (messagesToDelete.size > 0) {
            await channel.bulkDelete(messagesToDelete, true).catch(() => {
                // Fallback: delete individually if bulk delete fails
                messagesToDelete.forEach(msg => msg.delete().catch(() => {}));
            });
        }
    } catch (error) {
        console.error('Error cleaning messages:', error);
    }

    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    const playableIndices = getPlayableIndices(currentPlayer.hand, gameData.currentCard);

    // Build player status list
    let playerStatus = '';
    for (let i = 0; i < gameData.players.length; i++) {
        const p = gameData.players[i];
        const isCurrent = i === gameData.currentPlayerIndex;
        const indicator = isCurrent ? '➤' : '  ';
        const cardIcon = p.hand.length === 1 ? '❗' : '🃏';

        // Show if player has playable cards (but not which ones)
        const playableCount = getPlayableIndices(p.hand, gameData.currentCard).length;
        const playableIndicator = playableCount > 0 ? ' 🟢' : '';

        playerStatus += `${indicator} ${cardIcon} **${p.username}** - ${p.hand.length} Karten${playableIndicator}${p.hasCalledUno && p.hand.length === 1 ? ' (UNO!)' : ''}\n`;
    }

    // Build embed with game state
    const embed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('🎴 VagaUNO - Spieltisch')
        .setDescription(`**Aktuelle Karte:** ${getCardDisplayName(gameData.currentCard)}\n\n**Am Zug:** <@${currentPlayer.id}>\n**Zeit:** 60 Sekunden\n**Richtung:** ${gameData.direction === 1 ? '↻ Im Uhrzeigersinn' : '↺ Gegen den Uhrzeigersinn'}`)
        .addFields(
            { name: '👥 Spieler', value: playerStatus, inline: false },
            { name: '💡 Hinweise', value: '• 👁️ **Hand ansehen** = Deine Karten anzeigen\n• 🟢 = Spieler hat passende Karten', inline: false }
        )
        .setFooter({ text: `Zug ${gameData.turnsTaken + 1} • ${gameData.deck.length} Karten im Stapel` })
        .setTimestamp();

    const row = new ActionRowBuilder();

    // Add play buttons for playable cards (max 5 per row, need multiple rows if more)
    if (playableIndices.length > 0) {
        const maxButtons = Math.min(playableIndices.length, 5); // First 5 playable cards
        for (let i = 0; i < maxButtons; i++) {
            const cardIdx = playableIndices[i];
            const card = currentPlayer.hand[cardIdx];
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`uno_play_${cardIdx}_${gameId}`)
                    .setLabel(`${getColorEmoji(card.color)} #${cardIdx}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
    }

    // Always add draw button
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`uno_draw_${gameId}`)
                .setLabel('📥 Ziehen')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`uno_viewhand_${gameId}`)
                .setLabel('👁️ Hand ansehen')
                .setStyle(ButtonStyle.Primary)
        );

    // Add UNO button if player has 2 cards (will have 1 after playing)
    if (currentPlayer.hand.length === 2 && !currentPlayer.hasCalledUno) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`uno_calluno_${gameId}`)
                .setLabel('❗ UNO!')
                .setStyle(ButtonStyle.Danger)
        );
    }

    const components = playableIndices.length > 0 ? [row, row2] : [row2];

    // Update the game message
    try {
        const channel = await interaction.client.channels.fetch(gameData.channelId);
        const gameMessage = await channel.messages.fetch(gameData.gameMessageId);
        await gameMessage.edit({
            content: `<@${currentPlayer.id}> **du bist dran!**`,
            embeds: [embed],
            components
        });
    } catch (error) {
        console.error('Error updating game message:', error);
    }

    // Set turn timeout (60 seconds)
    if (gameData.turnTimeout) clearTimeout(gameData.turnTimeout);
    gameData.turnTimeout = setTimeout(async () => {
        // Auto-draw and skip turn
        await autoDrawCard(interaction, gameId);
    }, 60000);
}

/**
 * Auto-draw card (timeout)
 */
async function autoDrawCard(interaction, gameId) {
    const gameData = activeGames.get(gameId);
    if (!gameData || gameData.status !== 'playing') return;

    const currentPlayer = gameData.players[gameData.currentPlayerIndex];

    // Draw card
    if (gameData.deck.length === 0) {
        // Reshuffle discard pile
        gameData.deck = shuffleDeck([...gameData.discardPile.slice(0, -1)]);
        gameData.discardPile = [gameData.discardPile[gameData.discardPile.length - 1]];
    }

    const drawnCard = gameData.deck.pop();
    currentPlayer.hand.push(drawnCard);

    await interaction.channel.send(`⏰ ${currentPlayer.username} hat zu lange gewartet und zieht automatisch eine Karte!`);

    // Next turn
    nextTurn(interaction, gameId);
}

/**
 * Move to next turn
 */
function nextTurn(interaction, gameId, skip = false) {
    const gameData = activeGames.get(gameId);
    if (!gameData) return;

    // Clear timeout
    if (gameData.turnTimeout) {
        clearTimeout(gameData.turnTimeout);
        gameData.turnTimeout = null;
    }

    // Move to next player
    if (skip) {
        gameData.currentPlayerIndex = getNextPlayerIndex(
            gameData.currentPlayerIndex,
            gameData.direction * 2, // Skip means move 2 positions
            gameData.players.length
        );
    } else {
        gameData.currentPlayerIndex = getNextPlayerIndex(
            gameData.currentPlayerIndex,
            gameData.direction,
            gameData.players.length
        );
    }

    gameData.turnsTaken++;

    // Reset UNO call for new turn
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (currentPlayer.hand.length > 1) {
        currentPlayer.hasCalledUno = false;
    }

    // Process next turn
    processTurn(interaction, gameId);
}

// Export button handler
module.exports.handleUnoButton = async function(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[1];

    // Reconstruct gameId (it's everything after action, or parts[2] onwards joined by _)
    // For play/pickcolor, we need to handle the extra parameter
    let gameId;
    let extraParam = null;

    if (action === 'play') {
        // Format: uno_play_cardIndex_userId_timestamp
        extraParam = parseInt(parts[2]); // cardIndex
        gameId = parts.slice(3).join('_'); // userId_timestamp
    } else if (action === 'pickcolor') {
        // Format: uno_pickcolor_color_userId_timestamp
        extraParam = parts[2]; // color
        gameId = parts.slice(3).join('_'); // userId_timestamp
    } else {
        // Format: uno_action_userId_timestamp
        gameId = parts.slice(2).join('_'); // userId_timestamp
    }

    const gameData = activeGames.get(gameId);
    if (!gameData) {
        return interaction.reply({
            content: '⚠️ Dieses Spiel ist abgelaufen oder wurde bereits beendet.',
            ephemeral: true
        });
    }

    // Route to appropriate handler
    switch(action) {
        case 'join':
            await handleJoin(interaction, gameId);
            break;
        case 'start':
            await handleManualStart(interaction, gameId);
            break;
        case 'cancel':
            await handleCancel(interaction, gameId);
            break;
        case 'play':
            await handlePlayCard(interaction, gameId, extraParam);
            break;
        case 'draw':
            await handleDrawCard(interaction, gameId);
            break;
        case 'calluno':
            await handleCallUNO(interaction, gameId);
            break;
        case 'pickcolor':
            await handlePickColor(interaction, gameId, extraParam);
            break;
        case 'viewhand':
            await showHandEphemeral(interaction, gameId);
            break;
        default:
            await interaction.reply({ content: 'Unbekannte Aktion.', ephemeral: true });
    }
};

/**
 * Handle join button
 */
async function handleJoin(interaction, gameId) {
    const gameData = activeGames.get(gameId);

    // Check if already joined
    if (gameData.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: '❌ Du bist bereits dabei!', ephemeral: true });
    }

    // Check if full
    if (gameData.players.length >= gameData.maxPlayers) {
        return interaction.reply({ content: '❌ Das Spiel ist bereits voll!', ephemeral: true });
    }

    // Check coins
    const userData = db.getUserCoins(interaction.user.id);
    if (userData.coins < gameData.betAmount) {
        return interaction.reply({
            content: `❌ Du hast nicht genug Coins! Du brauchst ${gameData.betAmount.toLocaleString('de-DE')} Coins.`,
            ephemeral: true
        });
    }

    // Add player
    gameData.players.push({
        id: interaction.user.id,
        username: interaction.user.username,
        hand: [],
        hasCalledUno: false
    });

    const totalPot = gameData.betAmount * gameData.players.length;
    const playerList = gameData.players.map(p => `• ${p.username}`).join('\n');

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFields(
            { name: '💰 Einsatz', value: `${gameData.betAmount.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '👥 Spieler', value: `${gameData.players.length}/${gameData.maxPlayers}`, inline: true },
            { name: '🎰 Pot', value: `${totalPot.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎮 Dabei', value: playerList, inline: false }
        );

    await interaction.update({ embeds: [embed] });

    // Auto-start if full
    if (gameData.players.length === gameData.maxPlayers) {
        setTimeout(() => startGameLogic(interaction, gameId), 2000);
    }
}

/**
 * Handle manual start
 */
async function handleManualStart(interaction, gameId) {
    const gameData = activeGames.get(gameId);

    if (interaction.user.id !== gameData.hostId) {
        return interaction.reply({ content: '❌ Nur der Host kann das Spiel starten!', ephemeral: true });
    }

    if (gameData.players.length < 2) {
        return interaction.reply({ content: '❌ Mindestens 2 Spieler werden benötigt!', ephemeral: true });
    }

    await interaction.deferUpdate();
    await startGameLogic(interaction, gameId);
}

/**
 * Handle cancel
 */
async function handleCancel(interaction, gameId) {
    const gameData = activeGames.get(gameId);

    if (interaction.user.id !== gameData.hostId) {
        return interaction.reply({ content: '❌ Nur der Host kann das Spiel abbrechen!', ephemeral: true });
    }

    activeGames.delete(gameId);

    const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Spiel abgebrochen')
        .setDescription(`${gameData.hostName} hat das Spiel abgebrochen.`)
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

/**
 * Handle play card
 */
async function handlePlayCard(interaction, gameId, cardIndex) {
    const gameData = activeGames.get(gameId);

    // Validate turn
    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (interaction.user.id !== currentPlayer.id) {
        return interaction.reply({ content: '❌ Du bist nicht am Zug!', ephemeral: true });
    }

    // Validate card exists
    if (cardIndex >= currentPlayer.hand.length) {
        return interaction.reply({ content: '❌ Diese Karte existiert nicht in deiner Hand!', ephemeral: true });
    }

    const card = currentPlayer.hand[cardIndex];

    // Validate playable
    if (!isPlayable(card, gameData.currentCard)) {
        return interaction.reply({ content: '❌ Diese Karte kann nicht gespielt werden!', ephemeral: true });
    }

    await interaction.deferUpdate();

    // Remove card from hand
    currentPlayer.hand.splice(cardIndex, 1);

    // Add to discard pile
    gameData.discardPile.push(card);
    gameData.currentCard = card;

    // Check win condition
    if (checkWinCondition(currentPlayer.hand)) {
        return endGame(interaction, gameId, currentPlayer.id);
    }

    // Check if UNO (1 card left) and hasn't called it
    if (hasUNO(currentPlayer.hand) && !currentPlayer.hasCalledUno) {
        // Penalty: draw 2 cards
        for (let i = 0; i < 2; i++) {
            if (gameData.deck.length === 0) {
                gameData.deck = shuffleDeck([...gameData.discardPile.slice(0, -1)]);
                gameData.discardPile = [gameData.discardPile[gameData.discardPile.length - 1]];
            }
            const drawnCard = gameData.deck.pop();
            currentPlayer.hand.push(drawnCard);
        }
        await interaction.channel.send(`❌ ${currentPlayer.username} hat vergessen UNO zu rufen und muss 2 Karten ziehen!`);
    }

    // Handle chaos cards
    if (card.color === 'chaos') {
        const chaosResult = triggerChaosCard(card, gameData, gameData.currentPlayerIndex);
        gameData.chaosEvents.push(chaosResult);

        await interaction.channel.send(chaosResult.message);

        // Execute chaos effects
        if (card.type === CARD_TYPES.CHAOS_HEIST && chaosResult.coinsStolen > 0) {
            db.addCoins(currentPlayer.id, chaosResult.coinsStolen, 'uno_chaos_heist', 'Coin Heist Chaos Card');
            db.addCoins(chaosResult.targets[0], -chaosResult.coinsStolen, 'uno_chaos_heist_stolen', 'Von Coin Heist bestohlen');
        } else if (card.type === CARD_TYPES.CHAOS_SWAP && chaosResult.cardsSwapped) {
            const targetIdx = chaosResult.targets[0];
            [gameData.players[gameData.currentPlayerIndex].hand, gameData.players[targetIdx].hand] =
                [gameData.players[targetIdx].hand, gameData.players[gameData.currentPlayerIndex].hand];
        } else if (card.type === CARD_TYPES.CHAOS_DRAW_ALL) {
            for (let i = 0; i < gameData.players.length; i++) {
                for (let j = 0; j < 2; j++) {
                    if (gameData.deck.length === 0) {
                        gameData.deck = shuffleDeck([...gameData.discardPile.slice(0, -1)]);
                        gameData.discardPile = [gameData.discardPile[gameData.discardPile.length - 1]];
                    }
                    const drawnCard = gameData.deck.pop();
                    gameData.players[i].hand.push(drawnCard);
                }
            }
        } else if (card.type === CARD_TYPES.CHAOS_COLOR && chaosResult.colorChanged) {
            gameData.currentCard.color = chaosResult.colorChanged;
        }
    }

    // Handle action cards
    const actionResult = applyActionCard(card, gameData);
    if (actionResult.message) {
        await interaction.channel.send(actionResult.message);
    }

    // Apply direction change
    if (actionResult.direction !== undefined) {
        gameData.direction = actionResult.direction;
    }

    // Handle draw cards
    if (actionResult.drawCards) {
        const nextPlayerIdx = getNextPlayerIndex(gameData.currentPlayerIndex, gameData.direction, gameData.players.length);
        const nextPlayer = gameData.players[nextPlayerIdx];
        for (let i = 0; i < actionResult.drawCards; i++) {
            if (gameData.deck.length === 0) {
                gameData.deck = shuffleDeck([...gameData.discardPile.slice(0, -1)]);
                gameData.discardPile = [gameData.discardPile[gameData.discardPile.length - 1]];
            }
            const drawnCard = gameData.deck.pop();
            nextPlayer.hand.push(drawnCard);
        }
    }

    // Handle wild color selection
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
        // Send color picker
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`uno_pickcolor_red_${gameId}`)
                    .setLabel('🔴 Rot')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`uno_pickcolor_blue_${gameId}`)
                    .setLabel('🔵 Blau')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`uno_pickcolor_green_${gameId}`)
                    .setLabel('🟢 Grün')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`uno_pickcolor_yellow_${gameId}`)
                    .setLabel('🟡 Gelb')
                    .setStyle(ButtonStyle.Secondary)
            );

        const colorPickerMsg = await interaction.channel.send({
            content: `<@${currentPlayer.id}>, wähle eine Farbe:`,
            components: [row]
        });

        // Store message ID so we can disable buttons after selection
        gameData.colorPickerMessageId = colorPickerMsg.id;

        return; // Wait for color selection before next turn
    }

    // Next turn
    nextTurn(interaction, gameId, actionResult.skipNext);
}

/**
 * Handle draw card
 */
async function handleDrawCard(interaction, gameId) {
    const gameData = activeGames.get(gameId);

    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (interaction.user.id !== currentPlayer.id) {
        return interaction.reply({ content: '❌ Du bist nicht am Zug!', ephemeral: true });
    }

    await interaction.deferUpdate();

    // Draw card
    if (gameData.deck.length === 0) {
        gameData.deck = shuffleDeck([...gameData.discardPile.slice(0, -1)]);
        gameData.discardPile = [gameData.discardPile[gameData.discardPile.length - 1]];
    }

    const drawnCard = gameData.deck.pop();
    currentPlayer.hand.push(drawnCard);

    // Check if drawn card is playable
    if (isPlayable(drawnCard, gameData.currentCard)) {
        await interaction.channel.send(`📥 ${currentPlayer.username} hat eine Karte gezogen. Die Karte ist spielbar!`);
        // Update the game board to show the new playable options
        await processTurn(interaction, gameId);
    } else {
        await interaction.channel.send(`📥 ${currentPlayer.username} hat eine Karte gezogen. Die Karte ist nicht spielbar.`);
        // Next turn
        nextTurn(interaction, gameId);
    }
}

/**
 * Handle call UNO
 */
async function handleCallUNO(interaction, gameId) {
    const gameData = activeGames.get(gameId);

    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (interaction.user.id !== currentPlayer.id) {
        return interaction.reply({ content: '❌ Du bist nicht am Zug!', ephemeral: true });
    }

    currentPlayer.hasCalledUno = true;
    await interaction.reply({ content: `❗ ${currentPlayer.username} hat **UNO** gerufen!`, ephemeral: false });
}

/**
 * Handle pick color (after wild)
 */
async function handlePickColor(interaction, gameId, color) {
    const gameData = activeGames.get(gameId);

    const currentPlayer = gameData.players[gameData.currentPlayerIndex];
    if (interaction.user.id !== currentPlayer.id) {
        return interaction.reply({ content: '❌ Du bist nicht am Zug!', ephemeral: true });
    }

    // Check if color already picked
    if (gameData.currentCard.color !== 'wild' && gameData.currentCard.color !== 'chaos') {
        return interaction.reply({ content: '⚠️ Farbe wurde bereits gewählt!', ephemeral: true });
    }

    await interaction.deferUpdate();

    // Set color
    gameData.currentCard.color = color;

    // Disable color picker buttons by editing the message
    if (gameData.colorPickerMessageId) {
        try {
            const colorPickerMsg = await interaction.channel.messages.fetch(gameData.colorPickerMessageId);

            // Create disabled buttons
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('disabled_red')
                        .setLabel('🔴 Rot')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('disabled_blue')
                        .setLabel('🔵 Blau')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('disabled_green')
                        .setLabel('🟢 Grün')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('disabled_yellow')
                        .setLabel('🟡 Gelb')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

            await colorPickerMsg.edit({
                content: `✅ ${currentPlayer.username} wählt ${getColorEmoji(color)} ${color}!`,
                components: [disabledRow]
            });

            gameData.colorPickerMessageId = null;
        } catch (error) {
            console.error('Error disabling color picker:', error);
        }
    }

    await interaction.channel.send(`🌈 ${currentPlayer.username} hat ${getColorEmoji(color)} ${color} gewählt!`);

    // Check if it was a +4, handle skip
    const lastCard = gameData.discardPile[gameData.discardPile.length - 1];
    const skipNext = lastCard.type === CARD_TYPES.WILD_DRAW_FOUR;

    // Next turn
    nextTurn(interaction, gameId, skipNext);
}

/**
 * End game and award winner
 */
async function endGame(interaction, gameId, winnerId) {
    const gameData = activeGames.get(gameId);
    if (!gameData) return;

    // Clear timeout
    if (gameData.turnTimeout) {
        clearTimeout(gameData.turnTimeout);
    }

    const winner = gameData.players.find(p => p.id === winnerId);
    const totalPot = gameData.betAmount * gameData.players.length;
    const durationSeconds = Math.floor((Date.now() - gameData.createdAt) / 1000);

    // Award coins
    db.addCoins(winnerId, totalPot, 'uno_win', 'VagaUNO Gewinn');

    // Save to database
    db.saveUnoGame({
        gameId: gameData.gameId,
        hostId: gameData.hostId,
        players: gameData.players,
        winnerId,
        betAmount: gameData.betAmount,
        totalPot,
        chaosEvents: gameData.chaosEvents,
        turnsTaken: gameData.turnsTaken,
        durationSeconds
    });

    const winnerBalance = db.getUserCoins(winnerId).coins;

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 VagaUNO - GEWINNER!')
        .setDescription(`**${winner.username}** hat das Spiel gewonnen!`)
        .addFields(
            { name: '💰 Gewinn', value: `+${totalPot.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '💳 Kontostand', value: `${winnerBalance.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎮 Züge', value: `${gameData.turnsTaken}`, inline: true },
            { name: '⚡ Chaos Events', value: `${gameData.chaosEvents.length}`, inline: true },
            { name: '⏱️ Dauer', value: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`, inline: true }
        )
        .setFooter({ text: `Spieler: ${gameData.players.map(p => p.username).join(', ')}` })
        .setTimestamp();

    // Send winner announcement to ORIGINAL channel
    try {
        const originalChannel = await interaction.client.channels.fetch(gameData.originalChannelId);
        await originalChannel.send({
            content: `🎉 <@${winnerId}> hat gewonnen!`,
            embeds: [embed]
        });
    } catch (error) {
        console.error('Error sending winner message to original channel:', error);
    }

    // Send simple game over message to temp channel
    if (gameData.tempChannelId) {
        try {
            await interaction.channel.send({
                content: '🏁 **Spiel beendet!**',
                embeds: [embed]
            });
            await interaction.channel.send('⏳ Dieser Kanal wird in 30 Sekunden gelöscht...');
        } catch (error) {
            console.error('Error sending to temp channel:', error);
        }

        // Delete temporary channel after 30 seconds
        setTimeout(async () => {
            try {
                const tempChannel = await interaction.client.channels.fetch(gameData.tempChannelId);
                await tempChannel.delete('VagaUNO Spiel beendet');
            } catch (error) {
                console.error('Error deleting temp channel:', error);
            }
        }, 30000);
    }

    // Clean up
    activeGames.delete(gameId);
}
