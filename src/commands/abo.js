const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abo')
        .setDescription('Verwalte deine Spiel-Abos.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('rein')
                .setDescription('Abonniere ein Spiel, um angepingt zu werden.')
                .addStringOption(option =>
                    option.setName('spiel')
                        .setDescription('Welches Spiel?')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('raus')
                .setDescription('Deabonniere ein Spiel.')
                .addStringOption(option =>
                    option.setName('spiel')
                        .setDescription('Welches Spiel?')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('liste')
                .setDescription('Zeige deine aktuellen Abos.')),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const games = db.getAllGames();
        const filtered = games.filter(game => game.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(
            filtered.map(game => ({ name: game.name, value: game.name })).slice(0, 25),
        );
    },
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'rein') {
            const gameName = interaction.options.getString('spiel');
            const game = db.getGame(gameName);
            
            if (!game) {
                return interaction.reply({ content: 'Dieses Spiel existiert nicht.', ephemeral: true });
            }

            db.subscribe(interaction.user.id, gameName);
            await interaction.reply({ content: `✅ Du hast **${gameName}** abonniert. Du wirst nun angepingt, wenn sich ein Squad bildet.`, ephemeral: true });
        
        } else if (subcommand === 'raus') {
            const gameName = interaction.options.getString('spiel');
            db.unsubscribe(interaction.user.id, gameName);
            await interaction.reply({ content: `❌ Du hast **${gameName}** deabonniert.`, ephemeral: true });
        
        } else if (subcommand === 'liste') {
            const subs = db.getUserSubscriptions(interaction.user.id);
            if (subs.length === 0) {
                return interaction.reply({ content: 'Du hast aktuell keine Spiele abonniert.', ephemeral: true });
            }
            await interaction.reply({ content: `Dein Abo-Feed: **${subs.join(', ')}**`, ephemeral: true });
        }
    },
};
