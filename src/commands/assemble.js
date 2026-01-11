const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('assemble')
        .setDescription('Versammle die Squad für ein Spiel!')
        .addStringOption(option =>
            option.setName('spiel')
                .setDescription('Welches Spiel wird gezockt?')
                .setRequired(true)
                .setAutocomplete(true))
        .addIntegerOption(option =>
            option.setName('anzahl')
                .setDescription('Wie viele Leute brauchst du?')
                .setRequired(true)
                .setMinValue(1)),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const games = db.getAllGames();
        const filtered = games.filter(game => game.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(
            filtered.map(game => ({ name: game.name, value: game.name })).slice(0, 25),
        );
    },
    async execute(interaction) {
        const gameName = interaction.options.getString('spiel');
        const needed = interaction.options.getInteger('anzahl');
        const game = db.getGame(gameName);

        if (!game) {
            return interaction.reply({ content: 'Dieses Spiel ist nicht im System hinterlegt. Nutze `/config add_game`!', ephemeral: true });
        }

        await interaction.deferReply(); // Processing might take a second

        const subscriberIds = db.getSubscribers(gameName);
        // Exclude the user who started the command
        const potentialPlayers = subscriberIds.filter(id => id !== interaction.user.id);

        if (potentialPlayers.length === 0) {
            return interaction.editReply({ content: 'Niemand (außer dir) hat dieses Spiel abonniert.' });
        }

        // Fetch Guild Members to check status
        const guild = interaction.guild;
        const candidates = [];

        for (const userId of potentialPlayers) {
            try {
                const member = await guild.members.fetch(userId);
                let score = 0;
                let statusIcon = '⚫'; // Offline
                let statusText = 'Offline';

                if (member.presence) {
                    // Check if online
                    if (member.presence.status !== 'offline') {
                        score += 10;
                        statusIcon = '🟢';
                        statusText = 'Online';
                    }
                    
                    // Check if playing THIS game
                    const activities = member.presence.activities;
                    const isPlaying = activities.some(act => act.name.toLowerCase() === gameName.toLowerCase());
                    
                    if (isPlaying) {
                        score += 20; // High priority
                        statusIcon = '🎮';
                        statusText = `Spielt ${gameName}`;
                    }
                }

                candidates.push({
                    id: userId,
                    username: member.user.username,
                    score: score,
                    icon: statusIcon,
                    status: statusText
                });
            } catch (e) {
                // Member might have left the server
                continue;
            }
        }

        // Sort candidates: High score first
        candidates.sort((a, b) => b.score - a.score);

        // Select top N
        const selected = candidates.slice(0, needed);
        const remaining = candidates.slice(needed); // Backups

        let pingText = '';
        if (selected.length > 0) {
            pingText = selected.map(c => `<@${c.id}>`).join(' ') + ' - Ihr wurdet auserwählt! 🫡';
        } else {
            pingText = 'Keine geeigneten Spieler gefunden.';
        }

        // Build Description
        let desc = `Gesucht werden **${needed}** Spieler für **${gameName}**.\n\n`;
        
        desc += `**🎯 Auserwählt:**\n`;
        if (selected.length > 0) {
            desc += selected.map(c => `${c.icon} **${c.username}** (${c.status})`).join('\n');
        } else {
            desc += `*Niemand gefunden...*`;
        }

        if (remaining.length > 0) {
            desc += `\n\n**💤 Ersatzbank:**\n`;
            desc += remaining.map(c => `${c.icon} **${c.username}**`).join('\n');
        }

        desc += `\n\n**Bereits im Squad (1/?):**\n✅ <@${interaction.user.id}>`;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📢 Smart-Assemble: ${gameName}`)
            .setDescription(desc)
            .setFooter({ text: `Priorität: Spielt gerade > Online > Abo` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
`lfg_join_${gameName}`)
                    .setLabel('Bin dabei!')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`lfg_leave_${gameName}`)
                    .setLabel('Doch nicht...')
                    .setStyle(ButtonStyle.Danger),
            );

        await interaction.editReply({
            content: pingText, 
            embeds: [embed], 
            components: [row] 
        });
    },
};