require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, Partials } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database'); // Import database

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions, // Needed for reaction listening
        GatewayIntentBits.MessageContent, // Needed to read message content
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction], // Needed for uncached messages
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

// Command handler (Placeholder for now)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Kein Befehl passend zu ${interaction.commandName} gefunden.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Es gab einen Fehler beim Ausführen dieses Befehls!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Es gab einen Fehler beim Ausführen dieses Befehls!', ephemeral: true });
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
            console.error('Something went wrong when fetching the message:', error);
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

client.once(Events.ClientReady, c => {

    console.log(`Bereit! Eingeloggt als ${c.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
