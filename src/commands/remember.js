const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remember')
        .setDescription('Speichere ein lustiges Zitat oder einen Moment.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Der Nutzer, der es gesagt hat')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('text')
                .setDescription('Das Zitat an sich')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('category')
                .setDescription('Kategorie des Zitats (z.B. Fail, Win)')
                .addChoices(
                    { name: 'Allgemein', value: 'general' },
                    { name: 'Fail', value: 'fail' },
                    { name: 'Win', value: 'win' }
                )),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const text = interaction.options.getString('text');
        const category = interaction.options.getString('category') || 'general';
        const addedBy = interaction.user.username;

        try {
            db.addQuote(user.id, user.username, text, addedBy, category);
            await interaction.reply(`Zitat für **${user.username}** gespeichert: "${text}" (${category})`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Fehler beim Speichern des Zitats.', ephemeral: true });
        }
    },
};