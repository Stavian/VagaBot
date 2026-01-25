// UNO Card Renderer Module
// Canvas-based card image generation

const { createCanvas, registerFont } = require('canvas');
const { CARD_TYPES, getColorEmoji } = require('./unoGame');

// Card dimensions
const CARD_WIDTH = 120;
const CARD_HEIGHT = 180;
const CARD_SPACING = 80; // Overlap distance for fanned hands (increased for better visibility)
const CARD_ROTATION = 3; // Max rotation in degrees

// Colors
const COLORS = {
    red: '#E74C3C',
    blue: '#3498DB',
    green: '#2ECC71',
    yellow: '#F1C40F',
    wild: '#9B59B6',
    chaos: '#E67E22',
    back: '#34495E'
};

/**
 * Draw rounded rectangle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Get card background color
 * @param {Object} card - Card object
 * @returns {string} Color hex
 */
function getCardColor(card) {
    return COLORS[card.color] || COLORS.back;
}

/**
 * Draw gradient for chaos cards
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {CanvasGradient} Gradient
 */
function createChaosGradient(ctx, x, y, width, height) {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#9B59B6');
    gradient.addColorStop(0.5, '#E74C3C');
    gradient.addColorStop(1, '#F1C40F');
    return gradient;
}

/**
 * Get card type icon
 * @param {string} type - Card type
 * @returns {string} Icon
 */
function getCardIcon(type) {
    const icons = {
        [CARD_TYPES.SKIP]: '⊘',
        [CARD_TYPES.REVERSE]: '⟲',
        [CARD_TYPES.DRAW_TWO]: '+2',
        [CARD_TYPES.WILD]: '🌈',
        [CARD_TYPES.WILD_DRAW_FOUR]: '+4',
        [CARD_TYPES.CHAOS_HEIST]: '💰',
        [CARD_TYPES.CHAOS_SWAP]: '🔄',
        [CARD_TYPES.CHAOS_DRAW_ALL]: '📥',
        [CARD_TYPES.CHAOS_COLOR]: '🎨'
    };
    return icons[type] || '';
}

/**
 * Render a single card
 * @param {Object} card - Card object
 * @param {boolean} highlighted - Whether to highlight the card
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderCard(card, highlighted = false) {
    const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    if (card.color === 'chaos') {
        ctx.fillStyle = createChaosGradient(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    } else {
        ctx.fillStyle = getCardColor(card);
    }
    roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 15);
    ctx.fill();

    // Border
    ctx.strokeStyle = highlighted ? '#FFD700' : '#000000';
    ctx.lineWidth = highlighted ? 6 : 4;
    roundRect(ctx, 2, 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, 13);
    ctx.stroke();

    // Inner white area
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 10, 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, 10);
    ctx.fill();

    // Value text (large, centered)
    ctx.fillStyle = getCardColor(card);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.value, CARD_WIDTH / 2, CARD_HEIGHT / 2);

    // Type icon (if action card)
    if (card.type !== CARD_TYPES.NUMBER) {
        const icon = getCardIcon(card.type);
        ctx.font = '24px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText(icon, CARD_WIDTH / 2, CARD_HEIGHT - 30);
    }

    // Small corner values
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = getCardColor(card);
    ctx.fillText(card.value.substring(0, 2), 20, 25);
    ctx.save();
    ctx.translate(CARD_WIDTH - 20, CARD_HEIGHT - 25);
    ctx.rotate(Math.PI);
    ctx.fillText(card.value.substring(0, 2), 0, 0);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

/**
 * Render a player's hand (fanned cards)
 * @param {Array} cards - Array of card objects
 * @param {string} playerName - Player's name
 * @param {Array} playableIndices - Array of indices that are playable
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderHand(cards, playerName, playableIndices = []) {
    if (cards.length === 0) {
        // Return simple empty hand image
        const canvas = createCanvas(300, 50);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 300, 50);
        ctx.fillStyle = '#000000';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Keine Karten!', 150, 30);
        return canvas.toBuffer('image/png');
    }

    // Calculate canvas size for fanned cards
    const totalWidth = CARD_WIDTH + (cards.length - 1) * CARD_SPACING;
    const totalHeight = CARD_HEIGHT + 80; // Extra space for rotation and name
    const canvas = createCanvas(totalWidth, totalHeight);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ECF0F1';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Player name at top
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${playerName} - ${cards.length} Karten`, totalWidth / 2, 30);

    // Draw each card
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const isPlayable = playableIndices.includes(i);

        // Calculate position and rotation
        const x = i * CARD_SPACING;
        const y = 60;
        const rotation = (i - cards.length / 2) * (CARD_ROTATION / cards.length) * (Math.PI / 180);

        ctx.save();
        ctx.translate(x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
        ctx.rotate(rotation);
        ctx.translate(-CARD_WIDTH / 2, -CARD_HEIGHT / 2);

        // Draw card background
        if (card.color === 'chaos') {
            ctx.fillStyle = createChaosGradient(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT);
        } else {
            ctx.fillStyle = getCardColor(card);
        }
        roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 15);
        ctx.fill();

        // Border (highlighted if playable)
        ctx.strokeStyle = isPlayable ? '#FFD700' : '#000000';
        ctx.lineWidth = isPlayable ? 6 : 4;
        roundRect(ctx, 2, 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, 13);
        ctx.stroke();

        // Inner white area
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, 10, 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, 10);
        ctx.fill();

        // Value text
        ctx.fillStyle = getCardColor(card);
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.value, CARD_WIDTH / 2, CARD_HEIGHT / 2);

        // Card number (for reference)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`#${i}`, CARD_WIDTH / 2, CARD_HEIGHT - 20);

        ctx.restore();
    }

    // Legend
    ctx.fillStyle = '#7F8C8D';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🟡 = Spielbar | Nutze die Kartennummer für Buttons', totalWidth / 2, totalHeight - 10);

    return canvas.toBuffer('image/png');
}

/**
 * Render table view (current card + game status)
 * @param {Object} currentCard - Current card on discard pile
 * @param {Array} playerNames - Array of player names
 * @param {number} currentPlayerIndex - Index of current player
 * @param {number} direction - Direction (1 or -1)
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderTableView(currentCard, playerNames, currentPlayerIndex, direction) {
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#16A085';
    ctx.fillRect(0, 0, 600, 400);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VagaUNO - Aktuelle Karte', 300, 40);

    // Draw current card (centered, larger)
    const cardX = (600 - CARD_WIDTH * 1.5) / 2;
    const cardY = 70;
    ctx.save();
    ctx.scale(1.5, 1.5);
    ctx.translate(cardX / 1.5, cardY / 1.5);

    // Card background
    if (currentCard.color === 'chaos') {
        ctx.fillStyle = createChaosGradient(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    } else {
        ctx.fillStyle = getCardColor(currentCard);
    }
    roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 15);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    roundRect(ctx, 2, 2, CARD_WIDTH - 4, CARD_HEIGHT - 4, 13);
    ctx.stroke();

    // Inner white area
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 10, 10, CARD_WIDTH - 20, CARD_HEIGHT - 20, 10);
    ctx.fill();

    // Value
    ctx.fillStyle = getCardColor(currentCard);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentCard.value, CARD_WIDTH / 2, CARD_HEIGHT / 2);

    ctx.restore();

    // Player status
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Spieler:', 300, 350);

    // Player list with current player highlighted
    let yOffset = 375;
    playerNames.forEach((name, idx) => {
        if (idx === currentPlayerIndex) {
            ctx.fillStyle = '#F1C40F';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(`➤ ${name} (am Zug)`, 300, yOffset);
        } else {
            ctx.fillStyle = '#ECF0F1';
            ctx.font = '16px Arial';
            ctx.fillText(name, 300, yOffset);
        }
        yOffset += 20;
        if (yOffset > 390) return; // Stop if too many players
    });

    // Direction indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Richtung: ${direction === 1 ? '↻ Im Uhrzeigersinn' : '↺ Gegen den Uhrzeigersinn'}`, 20, 380);

    return canvas.toBuffer('image/png');
}

/**
 * Render color picker for wild cards
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderColorPicker() {
    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ECF0F1';
    ctx.fillRect(0, 0, 400, 300);

    // Title
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Wähle eine Farbe:', 200, 40);

    // Color boxes
    const colors = [
        { name: 'red', color: COLORS.red, emoji: '🔴', x: 50, y: 80 },
        { name: 'blue', color: COLORS.blue, emoji: '🔵', x: 230, y: 80 },
        { name: 'green', color: COLORS.green, emoji: '🟢', x: 50, y: 180 },
        { name: 'yellow', color: COLORS.yellow, emoji: '🟡', x: 230, y: 180 }
    ];

    colors.forEach(c => {
        // Box
        ctx.fillStyle = c.color;
        roundRect(ctx, c.x, c.y, 120, 80, 10);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        roundRect(ctx, c.x, c.y, 120, 80, 10);
        ctx.stroke();

        // Emoji
        ctx.font = '48px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.emoji, c.x + 60, c.y + 40);
    });

    return canvas.toBuffer('image/png');
}

module.exports = {
    renderCard,
    renderHand,
    renderTableView,
    renderColorPicker
};
