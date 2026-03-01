const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

// ADMIN USER ID - Replace with your Discord user ID
const ADMIN_USER_ID = '1076478570848866304';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance-admin')
        .setDescription('Admin: Verwalte Coin-Guthaben von Benutzern')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Setze das Guthaben eines Benutzers auf einen bestimmten Wert')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Der Benutzer')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Neues Guthaben')
                        .setRequired(true)
                        .setMinValue(0)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Füge Coins zum Guthaben eines Benutzers hinzu')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Der Benutzer')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Anzahl der Coins zum Hinzufügen')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Entferne Coins vom Guthaben eines Benutzers')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Der Benutzer')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Anzahl der Coins zum Entfernen')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Zeige das Guthaben eines Benutzers an')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Der Benutzer')
                        .setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Check if user is admin
        if (interaction.user.id !== ADMIN_USER_ID) {
            return interaction.editReply({
                content: '❌ Du hast keine Berechtigung, diesen Befehl zu verwenden!'
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        const userData = db.getUserCoins(targetUser.id);
        const currentBalance = userData.coins;

        if (subcommand === 'set') {
            const difference = amount - currentBalance;
            db.addCoins(targetUser.id, difference, 'admin_set', `Admin set balance to ${amount}`);

            return interaction.editReply({
                content: `✅ Guthaben von ${targetUser.username} wurde auf **${amount.toLocaleString('de-DE')} Coins** gesetzt.\n📊 Vorher: ${currentBalance.toLocaleString('de-DE')} Coins`
            });

        } else if (subcommand === 'add') {
            db.addCoins(targetUser.id, amount, 'admin_add', `Admin added ${amount} coins`);
            const newBalance = db.getUserCoins(targetUser.id).coins;

            return interaction.editReply({
                content: `✅ **${amount.toLocaleString('de-DE')} Coins** wurden zu ${targetUser.username} hinzugefügt.\n💰 Vorher: ${currentBalance.toLocaleString('de-DE')} Coins\n💳 Nachher: ${newBalance.toLocaleString('de-DE')} Coins`
            });

        } else if (subcommand === 'remove') {
            db.addCoins(targetUser.id, -amount, 'admin_remove', `Admin removed ${amount} coins`);
            const newBalance = db.getUserCoins(targetUser.id).coins;

            return interaction.editReply({
                content: `✅ **${amount.toLocaleString('de-DE')} Coins** wurden von ${targetUser.username} entfernt.\n💰 Vorher: ${currentBalance.toLocaleString('de-DE')} Coins\n💳 Nachher: ${newBalance.toLocaleString('de-DE')} Coins`
            });

        } else if (subcommand === 'view') {
            return interaction.editReply({
                content: `💳 **${targetUser.username}** Guthaben:\n💰 Coins: ${currentBalance.toLocaleString('de-DE')}\n📈 Gesamt verdient: ${userData.total_earned.toLocaleString('de-DE')}\n🔥 Daily Streak: ${userData.daily_streak || 0}`
            });
        }
    }
};
