require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, Partials, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database'); // Import database
// const { startMonitoring } = require('./utils/monitor'); // DISABLED - External API monitoring

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences, // Needed for smart matchmaking
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNUNG] Der Befehl in ${filePath} benötigt "data" oder "execute".`);
    }
}

// Command handler
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            logErrorToDiscord(error, `Command: /${interaction.commandName} by ${interaction.user.tag}`);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Es gab einen Fehler beim Ausführen dieses Befehls!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Es gab einen Fehler beim Ausführen dieses Befehls!', ephemeral: true });
            }
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('duel_accept_') || interaction.customId.startsWith('duel_decline_')) {
            // Coinflip duel button handler
            const parts = interaction.customId.split('_');
            const action = parts[1]; // 'accept' or 'decline'
            const duelId = parts.slice(2).join('_'); // Reconstruct full duelId (userId_opponentId_timestamp)
            const coinflipCommand = require('./commands/coinflip');
            if (coinflipCommand.handleDuelButton) {
                try {
                    await coinflipCommand.handleDuelButton(interaction, duelId, action);
                } catch (error) {
                    console.error('Coinflip duel button error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Fehler beim Verarbeiten deiner Aktion.', ephemeral: true });
                    }
                }
            }
            return;
        } else if (interaction.customId.startsWith('duel_roll_accept_') || interaction.customId.startsWith('duel_roll_decline_')) {
            // Dice roll duel button handler
            const parts = interaction.customId.split('_');
            const action = parts[2]; // 'accept' or 'decline'
            const duelId = parts.slice(3).join('_'); // Everything after action
            const rollCommand = require('./commands/roll');
            if (rollCommand.handleDuelButton) {
                try {
                    await rollCommand.handleDuelButton(interaction, duelId, action);
                } catch (error) {
                    console.error('Roll duel button error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Fehler beim Verarbeiten deiner Aktion.', ephemeral: true });
                    }
                }
            }
            return;
        } else if (interaction.customId.startsWith('roulette_')) {
            // Roulette game button handler
            const rouletteCommand = require('./commands/roulette');
            try {
                const parts = interaction.customId.split('_');
                const action = parts[1]; // 'join', 'start', 'cancel', 'solo'

                if (action === 'solo') {
                    // Solo roulette buttons
                    const soloAction = parts[2]; // 'pull' or 'cashout'
                    if (soloAction === 'pull' && rouletteCommand.handleSoloPull) {
                        await rouletteCommand.handleSoloPull(interaction);
                    } else if (soloAction === 'cashout' && rouletteCommand.handleSoloCashout) {
                        await rouletteCommand.handleSoloCashout(interaction);
                    }
                } else {
                    // Multiplayer roulette buttons
                    const gameId = parts.slice(2).join('_');
                    if (rouletteCommand.handleRouletteButton) {
                        await rouletteCommand.handleRouletteButton(interaction, gameId, action);
                    }
                }
            } catch (error) {
                console.error('Roulette button error:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Fehler beim Verarbeiten deiner Aktion.', ephemeral: true });
                }
            }
            return;
        } else if (interaction.customId.startsWith('highlow_')) {
            // High-Low game button handler
            const highlowCommand = require('./commands/highlow');
            if (highlowCommand.handleHighLowButton) {
                try {
                    await highlowCommand.handleHighLowButton(interaction);
                } catch (error) {
                    console.error('High-Low button error:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'Fehler beim Verarbeiten deiner Aktion.', ephemeral: true });
                    }
                }
            }
            return;
        } else if (interaction.customId.startsWith('uno_')) {
            // UNO game button handler
            const unoCommand = require('./commands/uno');
            if (unoCommand.handleUnoButton) {
                try {
                    await unoCommand.handleUnoButton(interaction);
                } catch (error) {
                    console.error('UNO button error:', error);
                    logErrorToDiscord(error, `UNO Button: ${interaction.customId}`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'Fehler beim Verarbeiten deiner Aktion.',
                            ephemeral: true
                        });
                    }
                }
            }
            return;
        } else if (interaction.customId.startsWith('lfg_')) {
            const [prefix, action, gameName] = interaction.customId.split('_');
            const game = db.getGame(gameName);
            if (!game) return interaction.reply({ content: 'Spielkonfiguration nicht gefunden.', ephemeral: true });

            const message = interaction.message;
            const embed = EmbedBuilder.from(message.embeds[0]);
            let playersString = embed.data.description.split('**Spieler')[1].split('):**\n')[1];
            let players = playersString === '*Noch niemand dabei.*' ? [] : playersString.split('\n').map(p => p.trim());

            const userTag = `<@${interaction.user.id}>`;

            if (action === 'join') {
                if (players.includes(userTag)) {
                    return interaction.reply({ content: 'Du bist bereits in der Squad!', ephemeral: true });
                }
                if (players.length >= game.max_players) {
                    return interaction.reply({ content: 'Die Squad ist leider schon voll!', ephemeral: true });
                }
                players.push(userTag);
            } else if (action === 'leave') {
                if (!players.includes(userTag)) {
                    return interaction.reply({ content: 'Du bist gar nicht in der Squad!', ephemeral: true });
                }
                players = players.filter(p => p !== userTag);
            }

            const newPlayersString = players.length > 0 ? players.join('\n') : '*Noch niemand dabei.*';
            embed.setDescription(`Geplant von **${message.interaction ? message.interaction.user.username : 'unbekannt'}**.\n\n**Spieler (${players.length}/${game.max_players}):**\n${newPlayersString}`);

            await interaction.update({ embeds: [embed] });
        } else if (interaction.customId.startsWith('info_')) {
            // Info menu navigation
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const section = interaction.customId.replace('info_', '');

            // Define all embeds
            const introEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🤖 VagaBot - Dein Gaming-Companion')
                .setDescription(
                    'Von Zitaten über Gaming-Stats bis hin zu Wetten – VagaBot macht deine Gaming-Sessions unvergesslich!\n\n' +
                    '📌 Alle Befehle beginnen mit `/`\n\n' +
                    '**Klicke auf die Buttons unten, um mehr über die Features zu erfahren:**'
                )
                .addFields({
                    name: '🎯 Hauptfeatures',
                    value: '💬 **Zitate** – Text & Voice-Zitate mit Audio\n' +
                           '🏆 **Rankings** – Bestenlisten & Stats\n' +
                           '💰 **Economy** – Coins & Wetten\n' +
                           '🎮 **Gaming** – Stats, LFG & Monitoring\n' +
                           '💡 **Tips** – Schnelltipps',
                    inline: false
                })
                .setFooter({ text: 'VagaBot v2.0 – Nutze die Buttons zur Navigation' })
                .setTimestamp();

            const quotesEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('💬 Zitat-System')
                .addFields(
                    { name: 'Text-Chat', value: '`/zitat` – Speichern, anzeigen, suchen, bearbeiten\n`/fail` – Dokumentiere Fails', inline: true },
                    { name: 'Voice-Chat', value: '`/voice-zitat` – Voice-Zitate verwalten\n`/voice-recording` – Audio aufnehmen', inline: true },
                    { name: '✨ Features', value: '• Bilder & Screenshots\n• Tags & Suche\n• **30s Audio-Aufnahmen**\n• MP3-Download\n• Separate Rankings', inline: false }
                )
                .setFooter({ text: 'VagaBot v2.0 – Klicke 🏠 für Hauptmenü' })
                .setTimestamp();

            const rankingEmbed = new EmbedBuilder()
                .setColor('#4ECDC4')
                .setTitle('🏆 Rankings & Weitere Befehle')
                .addFields(
                    { name: 'Rankings', value: '`/ranking` – Hall of Shame, Meist zitiert, Top Snitch, Reichste User', inline: false },
                    { name: 'Utilities', value: '`/tags` – Tag-Verwaltung\n`/suche` – Zitate durchsuchen\n`/schedule` – Event-Umfragen\n`/roulette` – Russisches Roulette\n`/ping` – Bot-Latenz\n`/config` – Admin-Einstellungen', inline: false }
                )
                .setFooter({ text: 'VagaBot v2.0 – Klicke 🏠 für Hauptmenü' })
                .setTimestamp();

            const economyEmbed = new EmbedBuilder()
                .setColor('#FFD93D')
                .setTitle('💰 Economy & Wetten')
                .addFields(
                    { name: 'Coins verdienen', value: '`/daily` – 50+ Coins täglich (Streak-Bonus bis +100)\n`/balance` – Kontostand prüfen\n\n**Weitere Quellen:**\n• Wetten gewinnen\n• Startguthaben: 100 Coins', inline: false },
                    { name: 'Wett-System', value: '`/wette erstellen` – Neue Wette\n`/wette platzieren` – Coins setzen\n`/wette liste` – Aktive Wetten\n`/wette info` – Details\n`/wette beenden` – Auflösen\n\n**Typen:** Match, K/D, Custom', inline: false }
                )
                .setFooter({ text: 'VagaBot v2.0 – Klicke 🏠 für Hauptmenü' })
                .setTimestamp();

            const gamingEmbed = new EmbedBuilder()
                .setColor('#95E1D3')
                .setTitle('🎮 Gaming & LFG')
                .addFields(
                    { name: 'Account-Linking', value: '`/link` – Steam, Uplay, Origin, PSN, Xbox', inline: true },
                    { name: 'Squad & LFG', value: '`/assemble` – Squad-Anfrage\n`/abo` – Spiele-Abos verwalten', inline: true }
                )
                .setFooter({ text: 'VagaBot v2.0 – Klicke 🏠 für Hauptmenü' })
                .setTimestamp();

            const tipsEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('💡 Quick Tips')
                .addFields(
                    { name: '🔥 Coins maximieren', value: '• `/daily` jeden Tag (Streak-Bonus!)\n• Klug wetten', inline: true },
                    { name: '🎮 Account-Setup', value: '• `/link` für Account-Linking\n• `/abo` für LFG-Pings', inline: true },
                    { name: '🎙️ Voice-Recording', value: '• `/voice-recording start` im Channel\n• Lustige Momente passieren\n• `/voice-zitat speichern` danach\n• 30s Audio automatisch gespeichert!', inline: false }
                )
                .setFooter({ text: 'VagaBot v2.0 – Klicke 🏠 für Hauptmenü' })
                .setTimestamp();

            // Select embed based on button clicked
            let selectedEmbed;
            switch (section) {
                case 'quotes':
                    selectedEmbed = quotesEmbed;
                    break;
                case 'rankings':
                    selectedEmbed = rankingEmbed;
                    break;
                case 'economy':
                    selectedEmbed = economyEmbed;
                    break;
                case 'gaming':
                    selectedEmbed = gamingEmbed;
                    break;
                case 'tips':
                    selectedEmbed = tipsEmbed;
                    break;
                case 'home':
                default:
                    selectedEmbed = introEmbed;
                    break;
            }

            // Recreate button rows
            const buttonRow1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('info_quotes').setLabel('💬 Zitate').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('info_rankings').setLabel('🏆 Rankings').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('info_economy').setLabel('💰 Economy').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('info_gaming').setLabel('🎮 Gaming').setStyle(ButtonStyle.Primary)
                );

            const buttonRow2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('info_tips').setLabel('💡 Tips').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('info_home').setLabel('🏠 Hauptmenü').setStyle(ButtonStyle.Secondary)
                );

            await interaction.update({
                embeds: [selectedEmbed],
                components: [buttonRow1, buttonRow2]
            });
        }
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Etwas ging schief beim Abrufen der Nachricht:', error);
            return;
        }
    }

    // Check if the reaction is the floppy disk 💾
    if (reaction.emoji.name === '💾') {
        const message = reaction.message;
        
        // Prevent bot messages from being saved
        if (message.author.bot) return;

        // Prevent self-saving
        if (message.author.id === user.id) {
            // Optional: Remove the reaction to indicate failure, or just ignore
            // await reaction.users.remove(user); 
            return; 
        }

        // Prepare data
        const userId = message.author.id;
        const username = message.author.username;
        const quoteText = message.content;
        const addedBy = user.username;
        const category = 'general'; // Default category for reactions
        
        // Check for attachments
        const attachment = message.attachments.first();
        const imageUrl = attachment ? attachment.url : null;
        const tags = '#reaction_save';

        try {
            // Save to DB
            db.addQuote(userId, username, quoteText, addedBy, category, imageUrl, tags);
            
            // Confirm with a check mark
            await message.react('✅');
        } catch (error) {
            console.error('Error saving quote via reaction:', error);
        }
    }
});

// Global error handler - logs to Discord channel
async function logErrorToDiscord(error, context = '') {
    try {
        const logChannelId = db.getConfig('bot_log_channel_id');
        if (!logChannelId || !client.isReady()) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚨 Bot-Fehler')
            .setDescription(`**Kontext:** ${context || 'Unbekannt'}\n\`\`\`${error.stack || error.message || error}\`\`\``)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[Error Logger] Failed to log to Discord:', err);
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Bereit! Eingeloggt als ${c.user.tag}`);

    // Set bot status
    c.user.setPresence({
        activities: [{ name: 'Passt auf!', type: 3 }], // Type 3 = Watching
        status: 'online'
    });
    console.log('[Status] Bot status set to "Passt auf!"');

    // startMonitoring(c); // DISABLED - External API monitoring
});

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('[Unhandled Rejection]', error);
    logErrorToDiscord(error, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
    console.error('[Uncaught Exception]', error);
    logErrorToDiscord(error, 'Uncaught Exception');
    // Give time to log before exiting
    setTimeout(() => process.exit(1), 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('[Shutdown] Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('[Shutdown] Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
