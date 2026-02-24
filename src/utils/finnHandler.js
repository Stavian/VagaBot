const db = require('../database');

// Finn Wegbier Bot ID
const FINN_BOT_ID = process.env.FINN_BOT_ID || '';

// Configuration
const FINN_STARTING_COINS = 5000;
const FINN_ACCEPT_DELAY_MIN = 2000;  // 2 seconds
const FINN_ACCEPT_DELAY_MAX = 5000;  // 5 seconds
const FINN_DECLINE_CHANCE = 0.1;     // 10% chance to decline when feeling lazy

/**
 * Checks if the given user ID is Finn Wegbier
 */
function isFinn(userId) {
    return userId === FINN_BOT_ID && FINN_BOT_ID !== '';
}

/**
 * Simulates Finn "deciding" to accept or decline a duel
 * @param {number} betAmount - The bet amount for the duel
 * @returns {Promise<{accept: boolean, reason?: string, message?: string}>}
 */
async function finnDecision(betAmount) {
    // Check if Finn has enough coins
    const finnData = db.getUserCoins(FINN_BOT_ID);

    if (finnData.coins < betAmount) {
        const brokeMessages = [
            'ey bruder hab grade keine kohle, frag spaeter nochmal',
            'mies mann, bin grad blank, naechstes mal',
            'jo nee digga, meine taschen sind leer wie mein magen',
            'sorry bruder, hab alles versoffen gestern'
        ];
        return {
            accept: false,
            reason: 'broke',
            message: brokeMessages[Math.floor(Math.random() * brokeMessages.length)]
        };
    }

    // Random decline chance (Finn being lazy/not in the mood)
    if (Math.random() < FINN_DECLINE_CHANCE) {
        const lazyMessages = [
            'nee mann, hab grad keinen bock auf zocken',
            'lass mal bruder, muss erstmal ne kippe rauchen',
            'jo nee, bin grade zu besoffen fuer sowas',
            'mies alter, hab heute kein glueck in den knochen',
            'nee digga, ich penn gleich ein'
        ];
        return {
            accept: false,
            reason: 'lazy',
            message: lazyMessages[Math.floor(Math.random() * lazyMessages.length)]
        };
    }

    return { accept: true };
}

/**
 * Returns a random delay for Finn's response (simulates thinking)
 * @returns {number} Delay in milliseconds
 */
function getFinnDelay() {
    return FINN_ACCEPT_DELAY_MIN +
           Math.random() * (FINN_ACCEPT_DELAY_MAX - FINN_ACCEPT_DELAY_MIN);
}

/**
 * Returns Finn's acceptance message when he agrees to a duel
 * @returns {string}
 */
function getFinnAcceptMessage() {
    const acceptMessages = [
        'jo lass machen bruder, bin dabei',
        'alles klar digga, zeig was du drauf hast',
        'ey jo, ich bin ready, moege der gluecklichere gewinnen',
        'lass zocken bruder, aber danach gehts auf ein bier',
        'jo mann, ich hab heute nen guten lauf, lass sehen'
    ];
    return acceptMessages[Math.floor(Math.random() * acceptMessages.length)];
}

/**
 * Generates Finn-style win/loss messages
 * @param {boolean} won - Whether Finn won
 * @param {number} amount - The amount won/lost
 * @returns {string}
 */
function getFinnResultMessage(won, amount) {
    const winMessages = [
        `haha ja mann ${amount} coins, davon kauf ich mir n paar wegbier`,
        'jo laeuft bei mir bruder, easy kohle gemacht',
        'ey danke fuers mitmachen, das bier geht auf dich',
        `boah mann ${amount} coins, heute penn ich im warmen`,
        'nice bruder, die strasse war mir heute hold',
        'jo das war mein tag, prost drauf'
    ];

    const lossMessages = [
        'mies bruder, aber egal kohle ist eh nur schmonzes',
        `uff ${amount} coins weg, naja morgen sieht die welt anders aus`,
        'pech gehabt mann, aber die strasse gibt und nimmt',
        'autsch das tat weh, brauch jetzt erstmal n bier',
        'jo mies, aber hey, geld macht eh nicht gluecklich',
        'ey scheisse, naja weiter tippeln'
    ];

    const messages = won ? winMessages : lossMessages;
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get Finn's starting coin balance
 * @returns {number}
 */
function getStartingCoins() {
    return FINN_STARTING_COINS;
}

module.exports = {
    isFinn,
    finnDecision,
    getFinnDelay,
    getFinnAcceptMessage,
    getFinnResultMessage,
    getStartingCoins,
    FINN_BOT_ID
};
