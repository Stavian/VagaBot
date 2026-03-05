const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Konfiguriere Bot-Einstellungen.')
        .setDefaultMemberPermissions(null) // Allow everyone to see, but we check permissions inside
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
                .setName('log_channel')
                .setDescription('Setze den Kanal für Bot-Logs und Fehler.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Der Zielkanal')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('wett_channel')
                .setDescription('Setze den Kanal für Wetten, Gaming-Stats und Memes.')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Der Zielkanal')
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
                .addStringOption(option => option.setName('name').setDescription('Name des Spiels').setRequired(true)))
        .addSubcommandGroup(group =>
            group
                .setName('admin_role')
                .setDescription('Verwalte Rollen, die diesen Config-Befehl nutzen dürfen.')
                .addSubcommand(sub =>
                    sub.setName('add')
                       .setDescription('Füge eine Admin-Rolle hinzu.')
                       .addRoleOption(opt => opt.setName('rolle').setDescription('Die Rolle').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('remove')
                       .setDescription('Entferne eine Admin-Rolle.')
                       .addRoleOption(opt => opt.setName('rolle').setDescription('Die Rolle').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('list')
                       .setDescription('Zeige alle berechtigten Rollen.')))
        .addSubcommandGroup(group =>
            group
                .setName('soundclip_role')
                .setDescription('Verwalte Rollen, die /soundclip nutzen dürfen.')
                .addSubcommand(sub =>
                    sub.setName('add')
                       .setDescription('Füge eine Soundclip-Rolle hinzu.')
                       .addRoleOption(opt => opt.setName('rolle').setDescription('Die Rolle').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('remove')
                       .setDescription('Entferne eine Soundclip-Rolle.')
                       .addRoleOption(opt => opt.setName('rolle').setDescription('Die Rolle').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('list')
                       .setDescription('Zeige alle berechtigten Soundclip-Rollen.'))),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        // --- Security Check ---
        const allowedRoles = db.getConfigRoles();
        const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isAdmin && !hasAllowedRole) {
            return interaction.editReply({
                content: '⛔ Du hast keine Berechtigung, diesen Befehl zu nutzen.'
            });
        }
        // ----------------------

        let subcommand;
        let group;
        try {
            group = interaction.options.getSubcommandGroup();
            subcommand = interaction.options.getSubcommand();
        } catch (e) {
            subcommand = interaction.options.getSubcommand();
        }

        if (group === 'admin_role') {
            if (subcommand === 'add') {
                const role = interaction.options.getRole('rolle');
                db.addConfigRole(role.id);
                await interaction.editReply({ content: `✅ Rolle **${role.name}** wurde als Config-Admin hinzugefügt.`, ephemeral: true });
            } else if (subcommand === 'remove') {
                const role = interaction.options.getRole('rolle');
                db.removeConfigRole(role.id);
                await interaction.editReply({ content: `🗑️ Rolle **${role.name}** wurde entfernt.`, ephemeral: true });
            } else if (subcommand === 'list') {
                const roles = db.getConfigRoles();
                if (roles.length === 0) {
                    await interaction.editReply({ content: 'Nur Server-Administratoren haben Zugriff (keine extra Rollen konfiguriert).', ephemeral: true });
                } else {
                    const roleMentions = roles.map(id => `<@&${id}>`).join(', ');
                    await interaction.editReply({ content: `**Berechtigte Rollen:** ${roleMentions}\n(Server-Admins haben immer Zugriff)`, ephemeral: true });
                }
            }
        } else if (group === 'soundclip_role') {
            if (subcommand === 'add') {
                const role = interaction.options.getRole('rolle');
                db.addSoundclipRole(role.id);
                await interaction.editReply({ content: `✅ Rolle **${role.name}** darf jetzt /soundclip nutzen.`, ephemeral: true });
            } else if (subcommand === 'remove') {
                const role = interaction.options.getRole('rolle');
                db.removeSoundclipRole(role.id);
                await interaction.editReply({ content: `🗑️ Rolle **${role.name}** wurde von /soundclip entfernt.`, ephemeral: true });
            } else if (subcommand === 'list') {
                const roles = db.getSoundclipRoles();
                if (roles.length === 0) {
                    await interaction.editReply({ content: 'Nur Server-Administratoren können /soundclip nutzen (keine extra Rollen konfiguriert).', ephemeral: true });
                } else {
                    const roleMentions = roles.map(id => `<@&${id}>`).join(', ');
                    await interaction.editReply({ content: `**Soundclip-Rollen:** ${roleMentions}\n(Server-Admins haben immer Zugriff)`, ephemeral: true });
                }
            }
        } else if (subcommand === 'tag_role') {
            const role = interaction.options.getRole('rolle');
            db.setConfig('tag_creator_role_id', role.id);
            await interaction.editReply({ content: `Die Rolle **${role.name}** ist nun berechtigt, neue Tags zu erstellen.`, ephemeral: true });
        } else if (subcommand === 'log_channel') {
            const channel = interaction.options.getChannel('kanal');
            db.setConfig('bot_log_channel_id', channel.id);
            await interaction.editReply({ content: `✅ Kanal ${channel} wurde als Bot-Log-Kanal festgelegt.`, ephemeral: true });
        } else if (subcommand === 'wett_channel') {
            const channel = interaction.options.getChannel('kanal');
            db.setConfig('wett_channel_id', channel.id);
            await interaction.editReply({ content: `✅ Kanal ${channel} wurde als Wett-Channel festgelegt (Wetten, Stats, Memes).`, ephemeral: true });
        } else if (subcommand === 'add_game') {
            const name = interaction.options.getString('name');
            
            db.addGame(name);
            await interaction.editReply({ content: `Spiel **${name}** hinzugefügt!`, ephemeral: true });
        } else if (subcommand === 'remove_game') {
            const name = interaction.options.getString('name');
            db.removeGame(name);
            await interaction.editReply({ content: `Spiel **${name}** wurde entfernt.`, ephemeral: true });
        }
    },
};
