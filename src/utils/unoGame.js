// UNO Game Logic Module
// Pure game logic with no Discord dependencies

const CARD_TYPES = {
    NUMBER: 'number',
    SKIP: 'skip',
    REVERSE: 'reverse',
    DRAW_TWO: 'draw2',
    WILD: 'wild',
    WILD_DRAW_FOUR: 'wild_draw4',
    CHAOS_HEIST: 'chaos_heist',
    CHAOS_SWAP: 'chaos_swap',
    CHAOS_DRAW_ALL: 'chaos_draw_all',
    CHAOS_COLOR: 'chaos_color'
};

const COLORS = ['red', 'blue', 'green', 'yellow'];

/**
 * Create a standard UNO deck with optional chaos cards
 * @param {boolean} includeChaos - Whether to include chaos cards
 * @returns {Array} Array of card objects
 */
function createDeck(includeChaos = true) {
    const deck = [];

    // Number cards (0-9) for each color
    for (const color of COLORS) {
        // One 0 card per color
        deck.push({ color, value: '0', type: CARD_TYPES.NUMBER });

        // Two of each 1-9
        for (let i = 1; i <= 9; i++) {
            deck.push({ color, value: String(i), type: CARD_TYPES.NUMBER });
            deck.push({ color, value: String(i), type: CARD_TYPES.NUMBER });
        }

        // Action cards (2 of each per color)
        deck.push({ color, value: 'Skip', type: CARD_TYPES.SKIP });
        deck.push({ color, value: 'Skip', type: CARD_TYPES.SKIP });

        deck.push({ color, value: 'Reverse', type: CARD_TYPES.REVERSE });
        deck.push({ color, value: 'Reverse', type: CARD_TYPES.REVERSE });

        deck.push({ color, value: '+2', type: CARD_TYPES.DRAW_TWO });
        deck.push({ color, value: '+2', type: CARD_TYPES.DRAW_TWO });
    }

    // Wild cards (4 of each)
    for (let i = 0; i < 4; i++) {
        deck.push({ color: 'wild', value: 'Wild', type: CARD_TYPES.WILD });
        deck.push({ color: 'wild', value: '+4', type: CARD_TYPES.WILD_DRAW_FOUR });
    }

    // Chaos cards (1 of each)
    if (includeChaos) {
        deck.push({ color: 'chaos', value: 'Heist', type: CARD_TYPES.CHAOS_HEIST });
        deck.push({ color: 'chaos', value: 'Swap', type: CARD_TYPES.CHAOS_SWAP });
        deck.push({ color: 'chaos', value: 'Draw All', type: CARD_TYPES.CHAOS_DRAW_ALL });
        deck.push({ color: 'chaos', value: 'Color Chaos', type: CARD_TYPES.CHAOS_COLOR });
    }

    return deck;
}

/**
 * Shuffle deck using Fisher-Yates algorithm
 * @param {Array} deck - Deck to shuffle
 * @returns {Array} Shuffled deck
 */
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Deal cards to players
 * @param {Array} deck - Deck to deal from
 * @param {number} playerCount - Number of players
 * @param {number} cardsPerPlayer - Cards to deal per player (default 7)
 * @returns {Object} { hands: [[cards]], remainingDeck: [cards] }
 */
function dealCards(deck, playerCount, cardsPerPlayer = 7) {
    const hands = [];
    const deckCopy = [...deck];

    for (let i = 0; i < playerCount; i++) {
        hands.push(deckCopy.splice(0, cardsPerPlayer));
    }

    return { hands, remainingDeck: deckCopy };
}

/**
 * Check if a card can be played on the current card
 * @param {Object} card - Card to play
 * @param {Object} currentCard - Current card on discard pile
 * @returns {boolean} True if playable
 */
function isPlayable(card, currentCard) {
    // Wild cards can always be played
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
        return true;
    }

    // Chaos cards can always be played
    if (card.color === 'chaos') {
        return true;
    }

    // Match color or value
    if (card.color === currentCard.color || card.value === currentCard.value) {
        return true;
    }

    return false;
}

/**
 * Get array of playable card indices from a hand
 * @param {Array} hand - Player's hand
 * @param {Object} currentCard - Current card on discard pile
 * @returns {Array} Array of playable card indices
 */
function getPlayableIndices(hand, currentCard) {
    const indices = [];
    hand.forEach((card, index) => {
        if (isPlayable(card, currentCard)) {
            indices.push(index);
        }
    });
    return indices;
}

/**
 * Apply action card effects to game state
 * @param {Object} card - Action card played
 * @param {Object} gameState - Current game state
 * @returns {Object} Updated game state
 */
function applyActionCard(card, gameState) {
    const updates = {};

    switch (card.type) {
        case CARD_TYPES.SKIP:
            // Skip next player
            updates.message = `⊘ ${gameState.players[(gameState.currentPlayerIndex + gameState.direction + gameState.players.length) % gameState.players.length].username} wurde übersprungen!`;
            updates.skipNext = true;
            break;

        case CARD_TYPES.REVERSE:
            // Reverse direction
            updates.direction = -gameState.direction;
            if (gameState.players.length === 2) {
                // In 2-player, reverse acts like skip
                updates.message = `⟲ Richtung umgedreht! ${gameState.players[(gameState.currentPlayerIndex + updates.direction + gameState.players.length) % gameState.players.length].username} wurde übersprungen!`;
                updates.skipNext = true;
            } else {
                updates.message = `⟲ Richtung umgedreht! Spielrichtung ist jetzt ${updates.direction === 1 ? 'im Uhrzeigersinn' : 'gegen den Uhrzeigersinn'}.`;
            }
            break;

        case CARD_TYPES.DRAW_TWO:
            // Next player draws 2
            updates.message = `+2 Der nächste Spieler muss 2 Karten ziehen!`;
            updates.drawCards = 2;
            updates.skipNext = true;
            break;

        case CARD_TYPES.WILD_DRAW_FOUR:
            // Next player draws 4 (color already chosen)
            updates.message = `+4 Der nächste Spieler muss 4 Karten ziehen!`;
            updates.drawCards = 4;
            updates.skipNext = true;
            break;

        case CARD_TYPES.WILD:
            // Just color change, no other effect
            updates.message = `🌈 Farbe gewechselt!`;
            break;

        default:
            // Number cards or other
            updates.message = null;
    }

    return updates;
}

/**
 * Check win condition (empty hand)
 * @param {Array} hand - Player's hand
 * @returns {boolean} True if player won
 */
function checkWinCondition(hand) {
    return hand.length === 0;
}

/**
 * Trigger chaos card effect
 * @param {Object} card - Chaos card
 * @param {Object} gameState - Current game state
 * @param {number} playerId - Index of player who played the card
 * @returns {Object} { effect, message, targets, coinsStolen }
 */
function triggerChaosCard(card, gameState, playerId) {
    const result = {
        effect: card.type,
        message: '',
        targets: [],
        coinsStolen: 0,
        cardsSwapped: false,
        colorChanged: null
    };

    switch (card.type) {
        case CARD_TYPES.CHAOS_HEIST:
            // Steal 10-50 coins from random opponent
            const validTargets = gameState.players.filter((_, idx) => idx !== playerId);
            if (validTargets.length > 0) {
                const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                const stolen = Math.floor(Math.random() * 41) + 10; // 10-50
                result.coinsStolen = stolen;
                result.targets = [target.id];
                result.message = `💰⚡ **Coin Heist!** ${gameState.players[playerId].username} stiehlt ${stolen} Coins von ${target.username}!`;
            } else {
                result.message = `💰⚡ **Coin Heist!** Niemand zum Bestehlen da!`;
            }
            break;

        case CARD_TYPES.CHAOS_SWAP:
            // Swap entire hand with random player
            const swapTargets = gameState.players.filter((_, idx) => idx !== playerId);
            if (swapTargets.length > 0) {
                const swapIdx = Math.floor(Math.random() * swapTargets.length);
                const swapTarget = swapTargets[swapIdx];
                const swapTargetIdx = gameState.players.findIndex(p => p.id === swapTarget.id);

                result.targets = [swapTargetIdx];
                result.cardsSwapped = true;
                result.message = `🔄⚡ **Card Swap!** ${gameState.players[playerId].username} tauscht Karten mit ${swapTarget.username}!`;
            } else {
                result.message = `🔄⚡ **Card Swap!** Niemand zum Tauschen da!`;
            }
            break;

        case CARD_TYPES.CHAOS_DRAW_ALL:
            // All players draw 2 cards
            result.targets = gameState.players.map((_, idx) => idx);
            result.message = `📥⚡ **Everyone Draws!** Alle Spieler ziehen 2 Karten!`;
            break;

        case CARD_TYPES.CHAOS_COLOR:
            // Change all cards in discard to random color
            const newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
            result.colorChanged = newColor;
            result.message = `🎨⚡ **Color Chaos!** Alle Karten im Stapel werden ${getColorEmoji(newColor)} ${newColor}!`;
            break;

        default:
            result.message = '⚡ Chaos card triggered!';
    }

    return result;
}

/**
 * Get color emoji for display
 * @param {string} color - Color name
 * @returns {string} Emoji
 */
function getColorEmoji(color) {
    const emojis = {
        red: '🔴',
        blue: '🔵',
        green: '🟢',
        yellow: '🟡',
        wild: '🌈',
        chaos: '⚡'
    };
    return emojis[color] || '';
}

/**
 * Get card display name with emoji
 * @param {Object} card - Card object
 * @returns {string} Display name
 */
function getCardDisplayName(card) {
    const colorEmoji = getColorEmoji(card.color);
    return `${colorEmoji} ${card.value}`;
}

/**
 * Get next player index
 * @param {number} currentIndex - Current player index
 * @param {number} direction - Direction (1 or -1)
 * @param {number} playerCount - Total players
 * @returns {number} Next player index
 */
function getNextPlayerIndex(currentIndex, direction, playerCount) {
    return (currentIndex + direction + playerCount) % playerCount;
}

/**
 * Check if hand has UNO (1 card left)
 * @param {Array} hand - Player's hand
 * @returns {boolean} True if UNO
 */
function hasUNO(hand) {
    return hand.length === 1;
}

module.exports = {
    CARD_TYPES,
    COLORS,
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
    hasUNO
};
