const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wette')
        .setDescription('Wetten auf Match-Ergebnisse und Spieler-Performance')
        .addSubcommand(subcommand =>
            subcommand
                .setName('erstellen')
                .setDescription('Erstelle eine neue Wette')
                .addStringOption(option =>
                    option.setName('titel')
                        .setDescription('Titel der Wette')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('typ')
                        .setDescription('Art der Wette')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Match Ergebnis (Sieg/Niederlage)', value: 'match_result' },
                            { name: 'K/D Vorhersage', value: 'kd_prediction' },
                            { name: 'Custom', value: 'custom' }
                        ))
                .addStringOption(option =>
                    option.setName('beschreibung')
                        .setDescription('Beschreibung der Wette')
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName('spieler')
                        .setDescription('Spieler für Performance-Wetten')
                        .setRequired(false))
                .addNumberOption(option =>
                    option.setName('zielwert')
                        .setDescription('Ziel K/D-Wert für Vorhersagen')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('dauer')
                        .setDescription('Dauer in Minuten bis die Wette schließt')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('platzieren')
                .setDescription('Setze auf eine Wette')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID der Wette')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('betrag')
                        .setDescription('Anzahl der Coins')
                        .setRequired(true)
                        .setMinValue(10))
                .addStringOption(option =>
                    option.setName('auswahl')
                        .setDescription('Deine Wahl')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Ja / Sieg / Über', value: 'yes' },
                            { name: 'Nein / Niederlage / Unter', value: 'no' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Zeige alle aktiven Wetten'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Zeige Details einer Wette')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID der Wette')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('beenden')
                .setDescription('Beende eine Wette (nur Ersteller)')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID der Wette')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('gewinner')
                        .setDescription('Gewinner-Option')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Ja / Sieg / Über', value: 'yes' },
                            { name: 'Nein / Niederlage / Unter', value: 'no' }
                        ))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'erstellen') {
            await handleCreate(interaction);
        } else if (subcommand === 'platzieren') {
            await handlePlace(interaction);
        } else if (subcommand === 'liste') {
            await handleList(interaction);
        } else if (subcommand === 'info') {
            await handleInfo(interaction);
        } else if (subcommand === 'beenden') {
            await handleResolve(interaction);
        }
    }
};

async function handleCreate(interaction) {
    const title = interaction.options.getString('titel');
    const type = interaction.options.getString('typ');
    const description = interaction.options.getString('beschreibung') || 'Keine Beschreibung';
    const targetUser = interaction.options.getUser('spieler');
    const targetValue = interaction.options.getNumber('zielwert');
    const duration = interaction.options.getInteger('dauer');

    let closesAt = null;
    if (duration) {
        closesAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    }

    const result = db.createBet(
        interaction.user.id,
        title,
        description,
        type,
        targetUser?.id || null,
        targetValue,
        closesAt
    );

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Wette erstellt!')
        .setDescription(`**${title}**\n\n${description}`)
        .addFields(
            { name: '🆔 Wett-ID', value: `${result.lastInsertRowid}`, inline: true },
            { name: '📋 Typ', value: type === 'match_result' ? 'Match Ergebnis' : type === 'kd_prediction' ? 'K/D Vorhersage' : type === 'extraction_success' ? 'Arc Raiders Extraction' : 'Custom', inline: true }
        )
        .setFooter({ text: `Nutze /wette platzieren id:${result.lastInsertRowid} um zu setzen` })
        .setTimestamp();

    if (targetUser) {
        embed.addFields({ name: '🎯 Spieler', value: `${targetUser.username}`, inline: true });
    }

    if (targetValue) {
        embed.addFields({ name: '📊 Zielwert', value: `K/D: ${targetValue}`, inline: true });
    }

    if (closesAt) {
        embed.addFields({ name: '⏰ Schließt um', value: `<t:${Math.floor(new Date(closesAt).getTime() / 1000)}:R>`, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handlePlace(interaction) {
    const betId = interaction.options.getInteger('id');
    const amount = interaction.options.getInteger('betrag');
    const choice = interaction.options.getString('auswahl');

    const result = db.placeBet(betId, interaction.user.id, amount, choice);

    if (!result.success) {
        return interaction.reply({ content: `❌ Fehler: ${result.error}`, ephemeral: true });
    }

    const bet = db.getBetById(betId);
    const userData = db.getUserCoins(interaction.user.id);

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Wette platziert!')
        .setDescription(`Du hast **${amount.toLocaleString('de-DE')} Coins** auf "${bet.title}" gesetzt.`)
        .addFields(
            { name: '🎯 Deine Wahl', value: choice === 'yes' ? '✅ Ja / Sieg / Über' : '❌ Nein / Niederlage / Unter', inline: true },
            { name: '💰 Neuer Kontostand', value: `${userData.coins.toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setFooter({ text: 'Viel Glück!' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
    const bets = db.getActiveBets();

    if (bets.length === 0) {
        return interaction.reply({ content: '📭 Keine aktiven Wetten vorhanden.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎲 Aktive Wetten')
        .setDescription('Nutze `/wette info id:[ID]` für Details oder `/wette platzieren` zum Setzen.')
        .setTimestamp();

    for (const bet of bets.slice(0, 10)) {
        const placements = db.getBetPlacements(bet.id);
        const totalPool = placements.reduce((sum, p) => sum + p.amount, 0);

        let creator = bet.creator_id;
        try {
            const user = await interaction.client.users.fetch(bet.creator_id);
            creator = user.username;
        } catch (err) {
            // Keep ID if fetch fails
        }

        const typeDisplay = bet.bet_type === 'match_result' ? '⚔️ Match' : bet.bet_type === 'kd_prediction' ? '📊 K/D' : bet.bet_type === 'extraction_success' ? '📦 Extraction' : '🎯 Custom';
        const closesInfo = bet.closes_at ? `⏰ <t:${Math.floor(new Date(bet.closes_at).getTime() / 1000)}:R>` : '🕐 Offen';

        embed.addFields({
            name: `[${bet.id}] ${typeDisplay} ${bet.title}`,
            value: `💰 Pool: **${totalPool.toLocaleString('de-DE')}** Coins | 👥 ${placements.length} Teilnehmer\n${closesInfo} | Erstellt von: ${creator}`,
            inline: false
        });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleInfo(interaction) {
    const betId = interaction.options.getInteger('id');
    const bet = db.getBetById(betId);

    if (!bet) {
        return interaction.reply({ content: '❌ Wette nicht gefunden.', ephemeral: true });
    }

    const placements = db.getBetPlacements(betId);
    const totalPool = placements.reduce((sum, p) => sum + p.amount, 0);
    const yesCount = placements.filter(p => p.choice === 'yes').length;
    const noCount = placements.filter(p => p.choice === 'no').length;
    const yesPool = placements.filter(p => p.choice === 'yes').reduce((sum, p) => sum + p.amount, 0);
    const noPool = placements.filter(p => p.choice === 'no').reduce((sum, p) => sum + p.amount, 0);

    let creator = bet.creator_id;
    try {
        const user = await interaction.client.users.fetch(bet.creator_id);
        creator = user.username;
    } catch (err) {
        // Keep ID
    }

    const embed = new EmbedBuilder()
        .setColor(bet.resolved ? '#888888' : '#FFD700')
        .setTitle(`${bet.resolved ? '🔒' : '🎲'} ${bet.title}`)
        .setDescription(bet.description)
        .addFields(
            { name: '🆔 Wett-ID', value: `${bet.id}`, inline: true },
            { name: '📋 Typ', value: bet.bet_type === 'match_result' ? 'Match Ergebnis' : bet.bet_type === 'kd_prediction' ? 'K/D Vorhersage' : bet.bet_type === 'extraction_success' ? 'Arc Raiders Extraction' : 'Custom', inline: true },
            { name: '👤 Erstellt von', value: creator, inline: true },
            { name: '💰 Gesamter Pool', value: `${totalPool.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '👥 Teilnehmer', value: `${placements.length}`, inline: true },
            { name: '📊 Status', value: bet.resolved ? `✅ Beendet (Gewinner: ${bet.winning_option === 'yes' ? 'Ja' : 'Nein'})` : '🟢 Aktiv', inline: true }
        )
        .setTimestamp();

    if (!bet.resolved) {
        embed.addFields(
            { name: '✅ Ja / Sieg / Über', value: `${yesCount} Teilnehmer | ${yesPool.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '❌ Nein / Niederlage / Unter', value: `${noCount} Teilnehmer | ${noPool.toLocaleString('de-DE')} Coins`, inline: true }
        );
    }

    if (bet.target_user_id) {
        try {
            const targetUser = await interaction.client.users.fetch(bet.target_user_id);
            embed.addFields({ name: '🎯 Ziel-Spieler', value: targetUser.username, inline: true });
        } catch (err) {
            embed.addFields({ name: '🎯 Ziel-Spieler', value: bet.target_user_id, inline: true });
        }
    }

    if (bet.target_value) {
        embed.addFields({ name: '📊 Zielwert', value: `K/D: ${bet.target_value}`, inline: true });
    }

    if (bet.closes_at) {
        embed.addFields({ name: '⏰ Schließt', value: `<t:${Math.floor(new Date(bet.closes_at).getTime() / 1000)}:R>`, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleResolve(interaction) {
    const betId = interaction.options.getInteger('id');
    const winningOption = interaction.options.getString('gewinner');

    const bet = db.getBetById(betId);

    if (!bet) {
        return interaction.reply({ content: '❌ Wette nicht gefunden.', ephemeral: true });
    }

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (bet.creator_id !== interaction.user.id && !isAdmin) {
        return interaction.reply({ content: '❌ Nur der Ersteller oder ein Administrator kann diese Wette beenden.', ephemeral: true });
    }

    if (bet.resolved) {
        return interaction.reply({ content: '❌ Diese Wette wurde bereits beendet.', ephemeral: true });
    }

    const result = db.resolveBet(betId, winningOption);

    if (!result.success) {
        return interaction.reply({ content: `❌ Fehler: ${result.error}`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Wette beendet!')
        .setDescription(`**${bet.title}** wurde aufgelöst.`)
        .addFields(
            { name: '🏆 Gewinner-Option', value: winningOption === 'yes' ? '✅ Ja / Sieg / Über' : '❌ Nein / Niederlage / Unter', inline: true },
            { name: '👥 Gewinner', value: `${result.winners}`, inline: true },
            { name: '💰 Ausgezahlter Pool', value: `${result.pool.toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
