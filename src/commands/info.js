const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Zeigt eine Übersicht aller Bot-Features (nur Admins)')
        .setDefaultMemberPermissions(null) // Allow everyone to see, but we check permissions inside
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Der Kanal, in dem die Info-Nachricht gepostet werden soll')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('Nachrichten-ID zum Aktualisieren (leer lassen für neue Nachricht)')
                .setRequired(false)),

    async execute(interaction) {
        // --- Security Check ---
        const allowedRoles = db.getConfigRoles();
        const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isAdmin && !hasAllowedRole) {
            return interaction.reply({
                content: '⛔ Du hast keine Berechtigung, diesen Befehl zu nutzen.',
                ephemeral: true
            });
        }
        // ----------------------

        const channel = interaction.options.getChannel('kanal');
        const messageId = interaction.options.getString('message_id');

        const introEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 VagaBot - Dein Gaming-Companion')
            .setDescription(
                'Von Zitaten über Gaming-Stats bis hin zu Wetten – VagaBot macht deine Gaming-Sessions unvergesslich!\n\n' +
                '📌 Alle Befehle beginnen mit `/`\n\n' +
                '**Klicke auf die Buttons unten, um mehr über die Features zu erfahren:**'
            )
            .addFields(
                {
                    name: '🎯 Hauptfeatures',
                    value: '💬 **Zitate** – Text & Voice-Zitate mit Audio\n' +
                           '🏆 **Rankings** – Bestenlisten & Stats\n' +
                           '💰 **Economy** – Coins & Wetten\n' +
                           '🎮 **Gaming** – Stats, LFG & Monitoring\n' +
                           '💡 **Tips** – Schnelltipps',
                    inline: false
                }
            )
            .setFooter({ text: 'VagaBot v2.0 – Nutze die Buttons zur Navigation' })
            .setTimestamp();

        const quotesEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('💬 Zitat-System')
            .addFields(
                {
                    name: 'Text-Chat',
                    value: '`/zitat` – Speichern, anzeigen, suchen, bearbeiten\n' +
                           '`/fail` – Dokumentiere Fails',
                    inline: true
                },
                {
                    name: 'Voice-Chat',
                    value: '`/voice-zitat` – Voice-Zitate verwalten\n' +
                           '`/voice-recording` – Audio aufnehmen',
                    inline: true
                },
                {
                    name: '✨ Features',
                    value: '• Bilder & Screenshots\n' +
                           '• Tags & Suche\n' +
                           '• **30s Audio-Aufnahmen**\n' +
                           '• MP3-Download\n' +
                           '• Separate Rankings',
                    inline: false
                }
            );

        const rankingEmbed = new EmbedBuilder()
            .setColor('#4ECDC4')
            .setTitle('🏆 Rankings & Weitere Befehle')
            .addFields(
                {
                    name: 'Rankings',
                    value: '`/ranking` – Hall of Shame, Meist zitiert, Top Snitch, Reichste User\n' +
                           '`/arcraiders leaderboard` – Top Extraktoren',
                    inline: false
                },
                {
                    name: 'Utilities',
                    value: '`/tags` – Tag-Verwaltung\n' +
                           '`/suche` – Zitate durchsuchen\n' +
                           '`/schedule` – Event-Umfragen\n' +
                           '`/roulette` – Russisches Roulette\n' +
                           '`/ping` – Bot-Latenz\n' +
                           '`/config` – Admin-Einstellungen',
                    inline: false
                }
            );

        const economyEmbed = new EmbedBuilder()
            .setColor('#FFD93D')
            .setTitle('💰 Economy & Wetten')
            .addFields(
                {
                    name: 'Coins verdienen',
                    value: '`/daily` – 50+ Coins täglich (Streak-Bonus bis +100)\n' +
                           '`/balance` – Kontostand prüfen\n\n' +
                           '**Weitere Quellen:**\n' +
                           '• Arc Raiders: 50-300+ Coins/Extraction\n' +
                           '• Wetten gewinnen\n' +
                           '• Startguthaben: 100 Coins',
                    inline: false
                },
                {
                    name: 'Wett-System',
                    value: '`/wette erstellen` – Neue Wette\n' +
                           '`/wette platzieren` – Coins setzen\n' +
                           '`/wette liste` – Aktive Wetten\n' +
                           '`/wette info` – Details\n' +
                           '`/wette beenden` – Auflösen\n\n' +
                           '**Typen:** Match, K/D, Extraction, Custom',
                    inline: false
                }
            );


        const gamingEmbed = new EmbedBuilder()
            .setColor('#95E1D3')
            .setTitle('🎮 Gaming & LFG')
            .addFields(
                {
                    name: 'Account-Linking',
                    value: '`/link` – Steam, Uplay, Origin, PSN, Xbox\n' +
                           '`/arcraiders link` – Arc Raiders\n' +
                           '`/stats` – Gaming-Stats anzeigen',
                    inline: true
                },
                {
                    name: 'Squad & LFG',
                    value: '`/assemble` – Squad-Anfrage\n' +
                           '`/abo` – Spiele-Abos verwalten',
                    inline: true
                },
                {
                    name: '📈 Live-Monitoring',
                    value: '• Match-Erkennung (10min)\n' +
                           '• Arc Raiders Tracking\n' +
                           '• Coin-Belohnungen\n' +
                           '• MVP-Alarm (K/D > 3.0)\n' +
                           '• Trash-Talk (K/D < 0.5)',
                    inline: false
                },
                {
                    name: '🎯 Arc Raiders Rewards',
                    value: '50 Coins Basis + 5/Kill + 10/Rare + 25/Epic + 50/Legendary + 1/min',
                    inline: false
                }
            );


        const tipsEmbed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle('💡 Quick Tips')
            .addFields(
                {
                    name: '🔥 Coins maximieren',
                    value: '• `/daily` jeden Tag (Streak-Bonus!)\n' +
                           '• Arc Raiders spielen\n' +
                           '• Klug wetten',
                    inline: true
                },
                {
                    name: '🎮 Account-Setup',
                    value: '• `/link` für Stats\n' +
                           '• `/arcraiders link` für Coins\n' +
                           '• `/abo` für LFG-Pings',
                    inline: true
                },
                {
                    name: '🎙️ Voice-Recording',
                    value: '• `/voice-recording start` im Channel\n' +
                           '• Lustige Momente passieren\n' +
                           '• `/voice-zitat speichern` danach\n' +
                           '• 30s Audio automatisch gespeichert!',
                    inline: false
                }
            )
            .setFooter({ text: 'VagaBot v2.0 – Ständig weiterentwickelt!' })
            .setTimestamp();

        // Create button rows
        const buttonRow1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('info_quotes')
                    .setLabel('💬 Zitate')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('info_rankings')
                    .setLabel('🏆 Rankings')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('info_economy')
                    .setLabel('💰 Economy')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('info_gaming')
                    .setLabel('🎮 Gaming')
                    .setStyle(ButtonStyle.Primary)
            );

        const buttonRow2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('info_tips')
                    .setLabel('💡 Tips')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('info_home')
                    .setLabel('🏠 Hauptmenü')
                    .setStyle(ButtonStyle.Secondary)
            );

        try {
            if (messageId) {
                // Update existing message
                const message = await channel.messages.fetch(messageId);
                await message.edit({
                    embeds: [introEmbed],
                    components: [buttonRow1, buttonRow2]
                });
                await interaction.reply({
                    content: `✅ Info-Nachricht wurde aktualisiert in ${channel}!`,
                    ephemeral: true
                });
            } else {
                // Send new message
                const sentMessage = await channel.send({
                    embeds: [introEmbed],
                    components: [buttonRow1, buttonRow2]
                });

                // Pin the message
                try {
                    await sentMessage.pin();
                } catch (pinError) {
                    console.error('[Info Command] Fehler beim Anpinnen:', pinError);
                }

                await interaction.reply({
                    content: `✅ Info-Nachricht wurde gepostet und angepinnt in ${channel}!\n\n**Nachrichten-ID zum Aktualisieren:** \`${sentMessage.id}\`\n\nNutze \`/info kanal:${channel} message_id:${sentMessage.id}\` um diese Nachricht zu aktualisieren.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('[Info Command] Fehler:', error);
            await interaction.reply({
                content: `❌ Fehler beim Posten/Aktualisieren der Nachricht: ${error.message}`,
                ephemeral: true
            });
        }
    },
};
