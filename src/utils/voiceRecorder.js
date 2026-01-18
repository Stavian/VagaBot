const {
    joinVoiceChannel,
    EndBehaviorType,
    VoiceConnectionStatus,
    getVoiceConnection
} = require('@discordjs/voice');
const prism = require('prism-media');
const fs = require('fs');
const path = require('path');

// Store active recordings per voice channel
const activeRecordings = new Map();

/**
 * Voice Recorder for Discord Voice Channels
 * Records audio streams with circular buffer for "last 30 seconds" functionality
 */
class VoiceRecorder {
    constructor(channelId) {
        this.channelId = channelId;
        this.userStreams = new Map(); // userId -> CircularAudioBuffer
        this.connection = null;
    }

    /**
     * Start recording all users in the voice channel
     */
    async startRecording(voiceChannel) {
        try {
            // Join the voice channel
            this.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });

            // Wait for connection to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

                this.connection.on(VoiceConnectionStatus.Ready, () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.connection.on(VoiceConnectionStatus.Disconnected, () => {
                    clearTimeout(timeout);
                    reject(new Error('Disconnected'));
                });
            });

            // Subscribe to all users in the channel
            const receiver = this.connection.receiver;

            receiver.speaking.on('start', (userId) => {
                if (!this.userStreams.has(userId)) {
                    this.subscribeToUser(userId, receiver);
                }
            });

            console.log(`[VoiceRecorder] Started recording in channel ${this.channelId}`);
            return true;
        } catch (error) {
            console.error('[VoiceRecorder] Failed to start recording:', error);
            return false;
        }
    }

    /**
     * Subscribe to a specific user's audio stream
     */
    subscribeToUser(userId, receiver) {
        const audioStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.Manual
            }
        });

        // Create circular buffer for this user (30 seconds at 48kHz, 16-bit, 2 channels)
        const buffer = new CircularAudioBuffer(30);
        this.userStreams.set(userId, buffer);

        // Create decoder
        const decoder = new prism.opus.Decoder({
            frameSize: 960,
            channels: 2,
            rate: 48000
        });

        // Pipe audio through decoder and into circular buffer
        audioStream.pipe(decoder).on('data', (chunk) => {
            buffer.write(chunk);
        });

        console.log(`[VoiceRecorder] Subscribed to user ${userId}`);
    }

    /**
     * Save the last 30 seconds of audio for a specific user
     */
    async saveUserAudio(userId, outputPath) {
        const buffer = this.userStreams.get(userId);
        if (!buffer) {
            throw new Error(`No audio buffer found for user ${userId}`);
        }

        const audioData = buffer.getAll();
        if (audioData.length === 0) {
            throw new Error(`No audio data recorded for user ${userId}`);
        }

        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write raw PCM data to file
        const rawPath = outputPath.replace('.mp3', '.raw');
        fs.writeFileSync(rawPath, Buffer.concat(audioData));

        // Convert to MP3 using ffmpeg
        const ffmpeg = require('ffmpeg-static');
        const { spawn } = require('child_process');

        return new Promise((resolve, reject) => {
            const ffmpegProcess = spawn(ffmpeg, [
                '-f', 's16le',           // Input format: signed 16-bit little-endian
                '-ar', '48000',          // Sample rate: 48kHz
                '-ac', '2',              // Audio channels: 2 (stereo)
                '-i', rawPath,           // Input file
                '-codec:a', 'libmp3lame', // MP3 encoder
                '-b:a', '128k',          // Bitrate
                '-y',                    // Overwrite output file
                outputPath               // Output file
            ]);

            ffmpegProcess.on('close', (code) => {
                // Clean up raw file
                fs.unlinkSync(rawPath);

                if (code === 0) {
                    console.log(`[VoiceRecorder] Saved audio to ${outputPath}`);
                    resolve(outputPath);
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on('error', (error) => {
                // Clean up raw file
                if (fs.existsSync(rawPath)) {
                    fs.unlinkSync(rawPath);
                }
                reject(error);
            });
        });
    }

    /**
     * Stop recording and cleanup
     */
    stop() {
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        this.userStreams.clear();
        console.log(`[VoiceRecorder] Stopped recording in channel ${this.channelId}`);
    }
}

/**
 * Circular buffer for audio data (keeps last N seconds)
 */
class CircularAudioBuffer {
    constructor(durationSeconds) {
        // Calculate buffer size: 48kHz * 2 bytes (16-bit) * 2 channels * duration
        const samplesPerSecond = 48000;
        const bytesPerSample = 2; // 16-bit
        const channels = 2;
        this.maxBytes = samplesPerSecond * bytesPerSample * channels * durationSeconds;
        this.chunks = [];
        this.totalBytes = 0;
    }

    write(chunk) {
        this.chunks.push(chunk);
        this.totalBytes += chunk.length;

        // Remove old chunks if we exceed max size
        while (this.totalBytes > this.maxBytes && this.chunks.length > 0) {
            const removed = this.chunks.shift();
            this.totalBytes -= removed.length;
        }
    }

    getAll() {
        return this.chunks;
    }
}

/**
 * Get or create a voice recorder for a channel
 */
async function getRecorder(voiceChannel) {
    const channelId = voiceChannel.id;

    // Check if already recording
    if (activeRecordings.has(channelId)) {
        return activeRecordings.get(channelId);
    }

    // Create new recorder
    const recorder = new VoiceRecorder(channelId);
    const success = await recorder.startRecording(voiceChannel);

    if (success) {
        activeRecordings.set(channelId, recorder);
        return recorder;
    }

    return null;
}

/**
 * Stop recording in a specific channel
 */
function stopRecording(channelId) {
    const recorder = activeRecordings.get(channelId);
    if (recorder) {
        recorder.stop();
        activeRecordings.delete(channelId);
        return true;
    }
    return false;
}

/**
 * Save the last 30 seconds of audio for a user
 */
async function saveLastAudio(voiceChannel, userId, outputPath) {
    const recorder = activeRecordings.get(voiceChannel.id);
    if (!recorder) {
        throw new Error('No active recording in this channel');
    }

    return await recorder.saveUserAudio(userId, outputPath);
}

module.exports = {
    getRecorder,
    stopRecording,
    saveLastAudio,
    activeRecordings
};
