const { SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const ffmpegStatic = require('ffmpeg-static');

const YTDLP_PATH = '/usr/local/bin/yt-dlp';

function parseTimestamp(str) {
    const parts = str.split(':').map(Number);
    if (parts.some(isNaN)) return NaN;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return NaN;
}

function spawnAsync(cmd, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args);
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Prozess beendet mit Code ${code}: ${stderr.slice(-300)}`));
        });
        proc.on('error', reject);
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soundclip')
        .setDescription('Erstellt einen Soundboard-Clip aus einem YouTube-Video (max. 5 Sekunden)')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('YouTube-URL des Videos')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('start')
                .setDescription('Startzeit (z.B. 1:23 oder 0:05:30)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('end')
                .setDescription('Endzeit (z.B. 1:28 oder 0:05:35)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name des Soundboard-Clips (max. 32 Zeichen)')
                .setRequired(true)
                .setMaxLength(32)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const url = interaction.options.getString('url');
        const startStr = interaction.options.getString('start');
        const endStr = interaction.options.getString('end');
        const clipName = interaction.options.getString('name');

        const startSeconds = parseTimestamp(startStr);
        const endSeconds = parseTimestamp(endStr);

        if (isNaN(startSeconds) || isNaN(endSeconds)) {
            return interaction.editReply('Ungultiges Zeitformat. Bitte verwende `MM:SS` oder `HH:MM:SS` (z.B. `1:23` oder `0:01:23`).');
        }
        if (endSeconds <= startSeconds) {
            return interaction.editReply('Die Endzeit muss nach der Startzeit liegen.');
        }
        const duration = endSeconds - startSeconds;
        if (duration > 5) {
            return interaction.editReply(`Der Clip ist **${duration.toFixed(1)} Sekunden** lang. Discord Soundboard erlaubt maximal **5 Sekunden**. Bitte waehle einen kuerzeren Abschnitt.`);
        }

        const tmpId = `${Date.now()}_${interaction.id}`;
        const rawPath = `/tmp/soundclip_${tmpId}.mp3`;
        const clipPath = `/tmp/soundclip_clip_${tmpId}.mp3`;

        try {
            await interaction.editReply('Audio wird heruntergeladen...');

            // Step 1: Download audio via yt-dlp (point to bundled ffmpeg)
            await spawnAsync(YTDLP_PATH, [
                '-x', '--audio-format', 'mp3',
                '--ffmpeg-location', ffmpegStatic,
                '-o', rawPath,
                '--no-playlist',
                url,
            ]);

            await interaction.editReply('Clip wird zugeschnitten...');

            // Step 2: Trim + re-encode to keep under 512KB
            await spawnAsync(ffmpegStatic, [
                '-ss', String(startSeconds),
                '-to', String(endSeconds),
                '-i', rawPath,
                '-ar', '22050',
                '-ac', '1',
                '-b:a', '64k',
                '-y', clipPath,
            ]);

            // Step 3: Read + size check
            const fileData = fs.readFileSync(clipPath);
            if (fileData.length > 512 * 1024) {
                return interaction.editReply('Der Clip ist zu gross fuer das Soundboard (max. 512 KB). Versuche einen kuerzeren Abschnitt.');
            }

            await interaction.editReply('Wird zum Soundboard hochgeladen...');

            // Step 4: Upload to Discord Soundboard API
            const dataUri = `data:audio/mpeg;base64,${fileData.toString('base64')}`;
            const response = await fetch(
                `https://discord.com/api/v10/guilds/${interaction.guildId}/soundboard-sounds`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: clipName, sound: dataUri }),
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error('[soundclip] Discord API Fehler:', err);
                const msg = err.message ?? JSON.stringify(err);
                return interaction.editReply(`Fehler beim Hochladen: ${msg}`);
            }

            await interaction.editReply(`Sound **${clipName}** wurde erfolgreich zum Soundboard hinzugefuegt!`);
        } catch (error) {
            console.error('[soundclip] Fehler:', error.message);
            await interaction.editReply(`Fehler: ${error.message}`);
        } finally {
            for (const f of [rawPath, clipPath]) {
                try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
            }
        }
    },
};
