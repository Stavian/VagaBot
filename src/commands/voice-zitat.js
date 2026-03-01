const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database');
const { getRecorder, saveLastAudio } = require('../utils/voiceRecorder');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice-zitat')
        .setDescription('Verwalte Voice-Chat-Zitate.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('speichern')
                .setDescription('Speichere ein Zitat aus dem Voice-Chat.')
                .addUserOption(option =>
                    option.setName('nutzer')
                        .setDescription('Der Nutzer, der es gesagt hat')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Das Zitat')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('tags')
                        .setDescription('Komma-getrennte Tags (z.B. #lustig, #rage)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('anzeigen')
                .setDescription('Zeige ein zufälliges Voice-Zitat.')
                .addUserOption(option =>
                    option.setName('nutzer')
                        .setDescription('Nach Nutzer filtern (optional)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('suchen')
                .setDescription('Suche nach Voice-Zitaten.')
                .addStringOption(option =>
                    option.setName('stichwort')
                        .setDescription('Suchbegriff')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('löschen')
                .setDescription('Lösche ein Voice-Zitat nach ID.')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('Die ID des Zitats')
                        .setRequired(true))),
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'speichern') {
            await handleSave(interaction);
        } else if (subcommand === 'anzeigen') {
            await handleDisplay(interaction);
        } else if (subcommand === 'suchen') {
            await handleSearch(interaction);
        } else if (subcommand === 'löschen') {
            await handleDelete(interaction);
        }
    },
};

async function handleSave(interaction) {
    const user = interaction.options.getUser('nutzer');
    const text = interaction.options.getString('text');
    const tagsInput = interaction.options.getString('tags');
    const addedBy = interaction.user.username;

    // Prevent self-save
    if (user.id === interaction.user.id) {
        return interaction.editReply({
            content: '🎤 Nice try! Du kannst deine eigenen Voice-Zitate nicht speichern. 👃'
        });
    }

    // Get voice channel info if user is in one
    let voiceChannelId = null;
    let voiceChannelName = null;
    let voiceChannel = null;

    const member = interaction.guild.members.cache.get(user.id);
    if (member && member.voice.channel) {
        voiceChannelId = member.voice.channel.id;
        voiceChannelName = member.voice.channel.name;
        voiceChannel = member.voice.channel;
    }

    // Tag validation
    let validTags = null;
    if (tagsInput) {
        const rawTags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const processedTags = rawTags.map(t => t.startsWith('#') ? t : `#${t}`);

        const newTags = [];
        for (const tag of processedTags) {
            if (!db.tagExists(tag)) {
                newTags.push(tag);
            }
        }

        if (newTags.length > 0) {
            // Check if user has permission to create new tags
            const tagCreatorRoleId = db.getConfig('tag_creator_role_id');
            const hasRole = tagCreatorRoleId ? interaction.member.roles.cache.has(tagCreatorRoleId) : false;
            const isAdmin = interaction.member.permissions.has('Administrator');

            const hasPermission = tagCreatorRoleId
                ? (hasRole || isAdmin)
                : interaction.member.permissions.has('ManageMessages');

            if (!hasPermission) {
                const existingTags = db.getAllTags().join(', ');
                return interaction.editReply({
                    content: `🛑 Du hast keine Berechtigung, neue Tags zu erstellen (${newTags.join(', ')}).\n\nErlaubte Tags: ${existingTags}`
                });
            } else {
                newTags.forEach(tag => db.createTag(tag, interaction.user.username));
            }
        }

        validTags = processedTags.join(', ');
    }

    // Handle audio recording
    let audioFilePath = null;

    if (voiceChannel) {
        try {
            // Ensure audio directory exists
            const audioDir = path.join(__dirname, '../../data/voice-quotes');
            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
            }

            // Get or create recorder for this channel
            const recorder = await getRecorder(voiceChannel);

            if (recorder) {
                // Generate unique filename
                const timestamp = Date.now();
                const filename = `quote_${user.id}_${timestamp}.mp3`;
                audioFilePath = path.join(audioDir, filename);

                // Save the last 30 seconds of audio
                try {
                    await saveLastAudio(voiceChannel, user.id, audioFilePath);
                } catch (audioError) {
                    console.error('[Voice-Zitat] Audio save error:', audioError);
                    // Continue without audio if recording fails
                    audioFilePath = null;
                }
            } else {
                console.log('[Voice-Zitat] No active recorder, saving without audio');
            }
        } catch (error) {
            console.error('[Voice-Zitat] Recording error:', error);
            // Continue without audio if recording fails
            audioFilePath = null;
        }
    }

    try {
        // Store relative path in database
        const relativeAudioPath = audioFilePath ? path.relative(path.join(__dirname, '../../data'), audioFilePath) : null;
        db.addVoiceQuote(user.id, user.username, text, addedBy, voiceChannelId, voiceChannelName, validTags, relativeAudioPath);

        let replyText = `🎤 Voice-Zitat für **${user.username}** gespeichert: "${text}"`;
        if (voiceChannelName) replyText += ` [📢 ${voiceChannelName}]`;
        if (validTags) replyText += ` [Tags: ${validTags}]`;
        if (audioFilePath && fs.existsSync(audioFilePath)) {
            replyText += ` [🔊 Mit Audio]`;
        } else {
            replyText += ` [ℹ️ Ohne Audio - Starte die Audio-Aufnahme mit dem Bot im Voice-Channel]`;
        }

        await interaction.editReply(replyText);
    } catch (error) {
        console.error(error);
        await interaction.editReply({ content: 'Fehler beim Speichern des Voice-Zitats.' });
    }
}

async function handleDisplay(interaction) {
    const user = interaction.options.getUser('nutzer');

    let quote;
    if (user) {
        quote = db.getRandomVoiceQuote(user.id);
    } else {
        quote = db.getRandomVoiceQuote();
    }

    if (!quote) {
        return interaction.editReply({
            content: '🎤 Keine Voice-Zitate gefunden! Nutze `/voice-zitat speichern` um welche zu erstellen.'
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle(`🎤 Voice-Zitat von ${quote.username}`)
        .setDescription(`"${quote.quote_text}"`)
        .setFooter({ text: `ID: ${quote.id} | Von ${quote.added_by} hinzugefügt` })
        .setTimestamp(new Date(quote.timestamp));

    if (quote.voice_channel_name) {
        embed.addFields({ name: '📢 Voice-Channel', value: quote.voice_channel_name, inline: true });
    }

    if (quote.tags) {
        embed.addFields({ name: '🏷️ Tags', value: quote.tags, inline: true });
    }

    // Check if audio file exists
    const replyOptions = { embeds: [embed] };

    if (quote.audio_file_path) {
        const audioPath = path.join(__dirname, '../../data', quote.audio_file_path);
        if (fs.existsSync(audioPath)) {
            const audioAttachment = new AttachmentBuilder(audioPath, { name: 'voice-quote.mp3' });
            replyOptions.files = [audioAttachment];
            embed.addFields({ name: '🔊 Audio', value: 'Audio-Clip angehängt', inline: true });
        }
    }

    await interaction.editReply(replyOptions);
}

async function handleSearch(interaction) {
    const keyword = interaction.options.getString('stichwort');
    const results = db.searchVoiceQuotes(keyword);

    if (results.length === 0) {
        return interaction.editReply({
            content: `🔍 Keine Voice-Zitate mit dem Stichwort "${keyword}" gefunden.`
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle(`🔍 Voice-Zitate mit "${keyword}"`)
        .setDescription(`${results.length} Ergebnis(se) gefunden`)
        .setTimestamp();

    // Show up to 5 results
    results.slice(0, 5).forEach(quote => {
        let value = `"${quote.quote_text}"\nVon ${quote.added_by}`;
        if (quote.voice_channel_name) value += ` in ${quote.voice_channel_name}`;
        embed.addFields({ name: `${quote.username} (ID: ${quote.id})`, value: value });
    });

    if (results.length > 5) {
        embed.setFooter({ text: `... und ${results.length - 5} weitere` });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction) {
    const id = interaction.options.getInteger('id');
    const quote = db.getVoiceQuoteById(id);

    if (!quote) {
        return interaction.editReply({
            content: `❌ Voice-Zitat mit ID ${id} nicht gefunden.`
        });
    }

    // Check permissions: must be admin or the person who added it
    const isAdmin = interaction.member.permissions.has('Administrator');
    const isCreator = quote.added_by === interaction.user.username;

    if (!isAdmin && !isCreator) {
        return interaction.editReply({
            content: '🛑 Du hast keine Berechtigung, dieses Voice-Zitat zu löschen.'
        });
    }

    db.deleteVoiceQuote(id);
    await interaction.editReply(`🗑️ Voice-Zitat #${id} von **${quote.username}** wurde gelöscht.`);
}
