require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, Partials, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database'); // Import database
const { startMonitoring } = require('./utils/monitor');

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
        if (interaction.customId.startsWith('lfg_')) {
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

    startMonitoring(c);
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
