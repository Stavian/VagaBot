const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('merken')
        .setDescription('Speichere ein lustiges Zitat oder einen Moment.')
        .addUserOption(option => 
            option.setName('nutzer')
                .setDescription('Der Nutzer, der es gesagt hat')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('text')
                .setDescription('Das Zitat an sich')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('kategorie')
                .setDescription('Kategorie des Zitats (z.B. Fail, Win)')
                .addChoices(
                    { name: 'Allgemein', value: 'general' },
                    { name: 'Fail', value: 'fail' },
                    { name: 'Win', value: 'win' }
                )),
    async execute(interaction) {
        const user = interaction.options.getUser('nutzer');
        const text = interaction.options.getString('text');
        const category = interaction.options.getString('kategorie') || 'general';
        const addedBy = interaction.user.username;

        const categoryNames = {
            'general': 'Allgemein',
            'fail': 'Fail',
            'win': 'Win'
        };
        const categoryLabel = categoryNames[category] || category;

        try {
            db.addQuote(user.id, user.username, text, addedBy, category);
            await interaction.reply(`Zitat für **${user.username}** gespeichert: "${text}" (${categoryLabel})`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Fehler beim Speichern des Zitats.', ephemeral: true });
        }
    },
};