const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage_quote')
        .setDescription('Admin-Befehle zur Verwaltung der Zitate-Datenbank.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Lösche ein Zitat anhand der ID')
                .addIntegerOption(option => 
                    option.setName('id')
                        .setDescription('Die ID des Zitats')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Bearbeite ein Zitat')
                .addIntegerOption(option => 
                    option.setName('id')
                        .setDescription('Die ID des Zitats')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('neuer_text')
                        .setDescription('Der neue Text des Zitats'))
                .addStringOption(option => 
                    option.setName('neue_tags')
                        .setDescription('Die neuen Tags des Zitats'))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const id = interaction.options.getInteger('id');

        if (subcommand === 'delete') {
            const result = db.deleteQuote(id);
            if (result.changes > 0) {
                await interaction.reply({ content: `Zitat #${id} wurde erfolgreich gelöscht.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `Kein Zitat mit ID #${id} gefunden.`, ephemeral: true });
            }
        } else if (subcommand === 'edit') {
            const newText = interaction.options.getString('neuer_text');
            const newTags = interaction.options.getString('neue_tags');

            if (!newText && !newTags) {
                return interaction.reply({ content: 'Du musst entweder einen neuen Text oder neue Tags angeben.', ephemeral: true });
            }

            const result = db.updateQuote(id, newText, newTags);
            if (result.changes > 0) {
                await interaction.reply({ content: `Zitat #${id} wurde aktualisiert.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `Kein Zitat mit ID #${id} gefunden.`, ephemeral: true });
            }
        }
    },
};
