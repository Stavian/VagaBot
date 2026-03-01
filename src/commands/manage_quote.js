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
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        const id = interaction.options.getInteger('id');

        if (subcommand === 'delete') {
            const result = db.deleteQuote(id);
            if (result.changes > 0) {
                await interaction.editReply({ content: `Zitat #${id} wurde erfolgreich gelöscht.` });
            } else {
                await interaction.editReply({ content: `Kein Zitat mit ID #${id} gefunden.` });
            }
        } else if (subcommand === 'edit') {
            const newText = interaction.options.getString('neuer_text');
            const newTags = interaction.options.getString('neue_tags');

            if (!newText && !newTags) {
                return interaction.editReply({ content: 'Du musst entweder einen neuen Text oder neue Tags angeben.' });
            }

            const result = db.updateQuote(id, newText, newTags);
            if (result.changes > 0) {
                await interaction.editReply({ content: `Zitat #${id} wurde aktualisiert.` });
            } else {
                await interaction.editReply({ content: `Kein Zitat mit ID #${id} gefunden.` });
            }
        }
    },
};
