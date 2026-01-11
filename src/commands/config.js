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
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add_game')
                .setDescription('Füge ein Spiel für das LFG-System hinzu.')
                .addStringOption(option => option.setName('name').setDescription('Name des Spiels').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove_game')
                .setDescription('Entferne ein Spiel aus dem LFG-System.')
                .addStringOption(option => option.setName('name').setDescription('Name des Spiels').setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'tag_role') {
            const role = interaction.options.getRole('rolle');
            db.setConfig('tag_creator_role_id', role.id);
            await interaction.reply({ content: `Die Rolle **${role.name}** ist nun berechtigt, neue Tags zu erstellen.`, ephemeral: true });
        } else if (subcommand === 'add_game') {
            const name = interaction.options.getString('name');
            
            db.addGame(name);
            await interaction.reply({ content: `Spiel **${name}** hinzugefügt!`, ephemeral: true });
        } else if (subcommand === 'remove_game') {
            const name = interaction.options.getString('name');
            db.removeGame(name);
            await interaction.reply({ content: `Spiel **${name}** wurde entfernt.`, ephemeral: true });
        }
    },
};
