const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Konfiguriere Bot-Einstellungen.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('tag_role')
                .setDescription('Setze die Rolle, die neue Tags erstellen darf.')
                .addRoleOption(option => 
                    option.setName('rolle')
                        .setDescription('Die Rolle für Tag-Ersteller')
                        .setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'tag_role') {
            const role = interaction.options.getRole('rolle');
            db.setConfig('tag_creator_role_id', role.id);
            await interaction.reply({ content: `Die Rolle **${role.name}** ist nun berechtigt, neue Tags zu erstellen.`, ephemeral: true });
        }
    },
};
