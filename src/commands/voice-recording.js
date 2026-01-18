const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getRecorder, stopRecording, activeRecordings } = require('../utils/voiceRecorder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice-recording')
        .setDescription('Verwalte Voice-Aufnahmen für Zitate.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starte Voice-Aufnahme im aktuellen Voice-Channel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stoppe Voice-Aufnahme im aktuellen Voice-Channel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Zeige Status der Voice-Aufnahme')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            await handleStart(interaction);
        } else if (subcommand === 'stop') {
            await handleStop(interaction);
        } else if (subcommand === 'status') {
            await handleStatus(interaction);
        }
    },
};

async function handleStart(interaction) {
    // Check if user is in a voice channel
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member || !member.voice.channel) {
        return interaction.reply({
            content: '❌ Du musst in einem Voice-Channel sein, um die Aufnahme zu starten!',
            ephemeral: true
        });
    }

    const voiceChannel = member.voice.channel;

    // Check if already recording
    if (activeRecordings.has(voiceChannel.id)) {
        return interaction.reply({
            content: `✅ Voice-Aufnahme läuft bereits in **${voiceChannel.name}**!`,
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const recorder = await getRecorder(voiceChannel);
        if (recorder) {
            await interaction.editReply({
                content: `🎙️ Voice-Aufnahme gestartet in **${voiceChannel.name}**!\n\n` +
                         `📝 Du kannst jetzt Voice-Zitate mit \`/voice-zitat speichern\` erstellen.\n` +
                         `🔊 Die letzten 30 Sekunden Audio werden automatisch gespeichert.`
            });
        } else {
            await interaction.editReply({
                content: '❌ Fehler beim Starten der Aufnahme. Stelle sicher, dass der Bot die nötigen Berechtigungen hat.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('[Voice-Recording] Start error:', error);
        await interaction.editReply({
            content: `❌ Fehler beim Starten der Aufnahme: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleStop(interaction) {
    // Check if user is in a voice channel
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member || !member.voice.channel) {
        return interaction.reply({
            content: '❌ Du musst in einem Voice-Channel sein!',
            ephemeral: true
        });
    }

    const voiceChannel = member.voice.channel;

    // Check if recording
    if (!activeRecordings.has(voiceChannel.id)) {
        return interaction.reply({
            content: `ℹ️ Keine aktive Aufnahme in **${voiceChannel.name}**.`,
            ephemeral: true
        });
    }

    const success = stopRecording(voiceChannel.id);
    if (success) {
        await interaction.reply({
            content: `⏹️ Voice-Aufnahme in **${voiceChannel.name}** wurde gestoppt.`
        });
    } else {
        await interaction.reply({
            content: '❌ Fehler beim Stoppen der Aufnahme.',
            ephemeral: true
        });
    }
}

async function handleStatus(interaction) {
    if (activeRecordings.size === 0) {
        return interaction.reply({
            content: 'ℹ️ Keine aktiven Voice-Aufnahmen.\n\n' +
                     'Nutze `/voice-recording start` in einem Voice-Channel, um die Aufnahme zu starten.',
            ephemeral: true
        });
    }

    let statusText = '🎙️ **Aktive Voice-Aufnahmen:**\n\n';

    for (const [channelId, recorder] of activeRecordings) {
        try {
            const channel = await interaction.guild.channels.fetch(channelId);
            const userCount = recorder.userStreams.size;
            statusText += `📢 **${channel.name}** - ${userCount} User werden aufgenommen\n`;
        } catch (error) {
            statusText += `📢 Channel ID: ${channelId}\n`;
        }
    }

    statusText += '\nℹ️ Nutze `/voice-recording stop` um die Aufnahme zu beenden.';

    await interaction.reply({
        content: statusText,
        ephemeral: true
    });
}
