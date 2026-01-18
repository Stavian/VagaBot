const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
            .setTitle('🤖 Willkommen beim VagaBot!')
            .setDescription(
                '**VagaBot** ist dein ultimativer Gaming-Companion für Discord!\n\n' +
                'Dieser Bot wurde entwickelt, um dein Server-Erlebnis zu verbessern und deine Gaming-Sessions unvergesslich zu machen. ' +
                'Von legendären Zitaten über epische Fails bis hin zu automatischen Gaming-Stats und einem vollständigen Wirtschaftssystem – ' +
                'VagaBot hat alles, was du brauchst!\n\n' +
                '📌 **Wichtig:** Alle Befehle beginnen mit `/` (Slash-Commands)'
            )
            .addFields(
                {
                    name: '🎯 Was kann der Bot?',
                    value: 'VagaBot bietet eine umfassende Suite an Features:\n' +
                           '• **Community-Features** – Zitate, Fails und Profile\n' +
                           '• **Gaming-Integration** – Stats, Match-Tracking und LFG\n' +
                           '• **Economy-System** – Coins verdienen und Wetten abschließen\n' +
                           '• **Automatisierung** – Live-Monitoring und Auto-Rewards',
                    inline: false
                }
            )
            .setFooter({ text: 'Scrolle nach unten für alle Features' })
            .setTimestamp();

        const quotesEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('💬 Zitat-System')
            .setDescription('Halte die unvergesslichsten Momente deiner Community fest!')
            .addFields(
                {
                    name: 'Text-Chat Befehle',
                    value:
                           '`/zitat hinzufuegen` – Speichere ein legendäres Zitat\n' +
                           '`/zitat anzeigen` – Zeige ein zufälliges Zitat\n' +
                           '`/zitat suchen` – Suche nach bestimmten Zitaten\n' +
                           '`/zitat bearbeiten` – Bearbeite bestehende Zitate\n' +
                           '`/zitat loeschen` – Entferne ein Zitat',
                    inline: false
                },
                {
                    name: '🎤 Voice-Chat Befehle',
                    value:
                           '`/voice-zitat speichern` – Speichere Zitate aus Voice-Chats\n' +
                           '`/voice-zitat anzeigen` – Zeige ein zufälliges Voice-Zitat\n' +
                           '`/voice-zitat suchen` – Suche nach Voice-Zitaten\n' +
                           '`/voice-zitat löschen` – Entferne ein Voice-Zitat',
                    inline: false
                },
                {
                    name: '✨ Features',
                    value: '• Bilder und Screenshots zu Zitaten hinzufügen\n' +
                           '• Tags für bessere Organisation\n' +
                           '• Suchfunktion für schnelles Finden\n' +
                           '• Voice-Channel-Tracking für Voice-Zitate\n' +
                           '• Separate Bestenlisten für Text- und Voice-Zitate',
                    inline: false
                }
            );

        const failsEmbed = new EmbedBuilder()
            .setColor('#4ECDC4')
            .setTitle('📊 Hall of Shame')
            .setDescription('Dokumentiere die epischsten Fails und Gaming-Momente!')
            .addFields(
                {
                    name: 'Verfügbare Befehle',
                    value:
                           '`/fail hinzufuegen` – Dokumentiere einen epischen Fail\n' +
                           '`/fail anzeigen` – Zeige einen zufälligen Fail\n' +
                           '`/fail bearbeiten` – Bearbeite einen Fail-Eintrag\n' +
                           '`/fail loeschen` – Entferne einen Fail',
                    inline: false
                },
                {
                    name: '🏆 Hall of Shame',
                    value: 'Die Hall of Shame zeigt die User mit den meisten dokumentierten Fails. ' +
                           'Wer steht ganz oben auf der Liste der Peinlichkeiten?',
                    inline: false
                }
            );

        const economyEmbed = new EmbedBuilder()
            .setColor('#FFD93D')
            .setTitle('💰 Economy-System')
            .setDescription('Verdiene Coins, baue dein Vermögen auf und werde der reichste User!')
            .addFields(
                {
                    name: 'Verfügbare Befehle',
                    value:
                           '`/balance` – Zeige deinen Kontostand\n' +
                           '`/daily` – Hole dir tägliche Belohnungen',
                    inline: false
                },
                {
                    name: '💎 Coins verdienen',
                    value:
                           '**Tägliche Belohnung:** 50+ Coins jeden Tag\n' +
                           '**Streak-Bonus:** +10-100 Coins bei täglicher Aktivität\n' +
                           '**Wöchentliche Milestones:** +100 Coins bei 7-Tage-Streak\n' +
                           '**Wetten gewinnen:** Coins durch erfolgreiche Wetten\n' +
                           '**Startguthaben:** Neue User erhalten 100 Coins',
                    inline: false
                },
                {
                    name: '📈 Das Streak-System',
                    value: 'Je öfter du täglich deine Belohnung abholst, desto höher wird dein Streak-Bonus! ' +
                           'Verpasse keinen Tag, um maximale Belohnungen zu kassieren.',
                    inline: false
                }
            );

        const bettingEmbed = new EmbedBuilder()
            .setColor('#A8E6CF')
            .setTitle('🎲 Wett-System')
            .setDescription('Setze deine Coins auf Match-Ergebnisse und Spieler-Performance!')
            .addFields(
                {
                    name: 'Verfügbare Befehle',
                    value:
                           '`/wette erstellen` – Erstelle eine neue Wette\n' +
                           '`/wette platzieren` – Setze Coins auf eine Wette\n' +
                           '`/wette liste` – Zeige alle aktiven Wetten\n' +
                           '`/wette info` – Detaillierte Infos zu einer Wette\n' +
                           '`/wette beenden` – Wette auflösen (nur Ersteller)',
                    inline: false
                },
                {
                    name: '🎯 Wett-Typen',
                    value:
                           '**Match-Ergebnis:** Wette auf Sieg oder Niederlage\n' +
                           '**K/D Vorhersage:** Wird der Spieler die Ziel-K/D erreichen?\n' +
                           '**Arc Raiders Extraction:** Erfolgreiche Extraction oder Elimination?\n' +
                           '**Custom:** Erstelle eigene Wett-Kategorien',
                    inline: false
                },
                {
                    name: '⚡ Automatische Auflösung',
                    value: 'K/D Wetten und Arc Raiders Extraction-Wetten werden automatisch aufgelöst! ' +
                           'Gewinner erhalten ihren Anteil am Gesamt-Pool proportional zu ihrem Einsatz.',
                    inline: false
                }
            );

        const gamingEmbed = new EmbedBuilder()
            .setColor('#95E1D3')
            .setTitle('🎮 Gaming-Features')
            .setDescription('Verknüpfe deine Gaming-Accounts und tracke deine Performance!')
            .addFields(
                {
                    name: 'Verfügbare Befehle',
                    value:
                           '`/link` – Verknüpfe deine Gaming-Accounts (Uplay, Origin, PSN, etc.)\n' +
                           '`/arcraiders link` – Verknüpfe deinen Arc Raiders Account\n' +
                           '`/arcraiders stats` – Zeige deine Arc Raiders Extraction-Statistiken\n' +
                           '`/stats` – Zeige deine aktuellen Gaming-Statistiken\n' +
                           '`/lfg` – Erstelle eine Squad-Anfrage (Looking For Group)',
                    inline: false
                },
                {
                    name: '📈 Live-Monitoring',
                    value:
                           '• **Automatische Match-Erkennung** alle 10 Minuten\n' +
                           '• **Arc Raiders Extraction-Tracking** mit Loot-Analyse\n' +
                           '• **MVP-Alarm** bei herausragenden Performances (K/D > 3.0)\n' +
                           '• **Trash-Talk** bei schlechten Runden (K/D < 0.5)\n' +
                           '• **Performance-Tracking** über alle Spiele hinweg',
                    inline: false
                },
                {
                    name: '🎯 Unterstützte Spiele',
                    value:
                           '• **Arc Raiders** (Extraction-Shooter mit Loot-Tracking)\n' +
                           '• Rainbow Six Siege (Uplay, PSN, Xbox)\n' +
                           '• Battlefield 2042 (Origin, PSN, Xbox)\n' +
                           '• For Honor (Uplay, PSN, Xbox)\n' +
                           '• Destiny 2 (Steam, PSN, Xbox)\n' +
                           '• Valorant (Riot)',
                    inline: false
                }
            );

        const miscEmbed = new EmbedBuilder()
            .setColor('#F38181')
            .setTitle('🏆 Rankings & Weitere Features')
            .addFields(
                {
                    name: '📊 Rankings',
                    value:
                           '`/ranking` – Zeige Bestenlisten\n' +
                           '`/arcraiders leaderboard` – Top Arc Raiders Extraktoren\n\n' +
                           'Verfügbare Rankings:\n' +
                           '• **Hall of Shame** – Meiste Fails\n' +
                           '• **Meist zitiert** – Legendärste User (Text)\n' +
                           '• **Meist in Voice zitiert** – Legendärste Voice-Momente\n' +
                           '• **Top Snitch** – Meiste Beiträge (Zitate + Fails)\n' +
                           '• **Top Voice-Snitch** – Meiste Voice-Zitate gespeichert\n' +
                           '• **Reichste User** – Höchster Coin-Kontostand\n' +
                           '• **Top Earners** – Meiste Coins insgesamt verdient\n' +
                           '• **Top Extraktoren** – Beste Arc Raiders Spieler',
                    inline: false
                },
                {
                    name: '🎯 Weitere Befehle',
                    value:
                           '`/tag` – Erstelle und nutze Custom-Tags für schnelle Antworten\n' +
                           '`/profil` – Zeige detaillierte User-Profile und Aktivität\n' +
                           '`/avatar` – Zeige User-Avatare in hoher Auflösung\n' +
                           '`/ping` – Überprüfe die Bot-Latenz und Reaktionszeit',
                    inline: false
                }
            );

        const tipsEmbed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle('💡 Tipps & Tricks')
            .setDescription('So holst du das Maximum aus VagaBot heraus!')
            .addFields(
                {
                    name: '🔥 Daily Streak maximieren',
                    value: 'Hole dir jeden Tag deine `/daily` Belohnung! Nach 7 Tagen erhältst du einen extra Bonus von 100 Coins.',
                    inline: false
                },
                {
                    name: '💰 Coins verdienen',
                    value: 'Die beste Strategie: Tägliche Belohnungen sammeln und klug auf Wetten setzen. ' +
                           'Analysiere die Spieler-Stats bevor du setzt!',
                    inline: false
                },
                {
                    name: '🎮 Gaming-Account verknüpfen',
                    value: 'Verknüpfe deine Gaming-Accounts mit `/link` und `/arcraiders link`, um automatisch getrackt zu werden, ' +
                           'Coins für Extractions zu verdienen und an automatischen Wetten teilzunehmen.',
                    inline: false
                },
                {
                    name: '📱 LFG nutzen',
                    value: 'Erstelle Squad-Anfragen mit `/lfg`, um schnell Mitspieler für deine Sessions zu finden. ' +
                           'Andere User werden benachrichtigt und können direkt beitreten!',
                    inline: false
                }
            )
            .setFooter({ text: 'VagaBot wird ständig weiterentwickelt – stay tuned für neue Features!' })
            .setTimestamp();

        try {
            if (messageId) {
                // Update existing message
                const message = await channel.messages.fetch(messageId);
                await message.edit({
                    embeds: [introEmbed, quotesEmbed, failsEmbed, economyEmbed, bettingEmbed, gamingEmbed, miscEmbed, tipsEmbed]
                });
                await interaction.reply({
                    content: `✅ Info-Nachricht wurde aktualisiert und angepinnt in ${channel}!`,
                    ephemeral: true
                });
            } else {
                // Send new message
                const sentMessage = await channel.send({
                    embeds: [introEmbed, quotesEmbed, failsEmbed, economyEmbed, bettingEmbed, gamingEmbed, miscEmbed, tipsEmbed]
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
