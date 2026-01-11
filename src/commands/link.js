const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Verbinde deinen Discord-Account mit einem Spiele-Account.')
        .addStringOption(option =>
            option.setName('plattform')
                .setDescription('Die Plattform, die du verknüpfen möchtest')
                .setRequired(true)
                .addChoices(
                    { name: 'Rainbow Six Siege (PC)', value: 'r6_uplay' },
                    { name: 'Rainbow Six Siege (PSN)', value: 'r6_psn' },
                    { name: 'Rainbow Six Siege (Xbox)', value: 'r6_xbl' },
                    { name: 'Battlefield 6 (PC)', value: 'bf6_origin' },
                    { name: 'Battlefield 6 (PSN)', value: 'bf6_psn' },
                    { name: 'Battlefield 6 (Xbox)', value: 'bf6_xbl' },
                    { name: 'For Honor (PC)', value: 'fh_uplay' },
                    { name: 'For Honor (PSN)', value: 'fh_psn' },
                    { name: 'For Honor (Xbox)', value: 'fh_xbl' },
                    { name: 'Destiny 2 (PC)', value: 'd2_steam' },
                    { name: 'Destiny 2 (PSN)', value: 'd2_psn' },
                    { name: 'Destiny 2 (Xbox)', value: 'd2_xbl' },
                    { name: 'Steam (Allgemein)', value: 'steam' },
                    { name: 'Valorant', value: 'valorant' }
                ))
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Deine ID (z.B. Ubisoft Name, PSN-ID, Gamertag oder Name#Tag)')
                .setRequired(true)),
    async execute(interaction) {
        const platform = interaction.options.getString('plattform');
        const externalId = interaction.options.getString('id');
        const userId = interaction.user.id;

        // Validation
        if (platform === 'valorant' && !externalId.includes('#')) {
             return interaction.reply({
                content: '⚠️ Valorant IDs müssen das Format `Name#Tag` haben.',
                ephemeral: true
            });
        }

        try {
            db.linkUser(userId, platform, externalId);
            
            const platformNames = {
                'r6_uplay': 'Rainbow Six Siege (PC)',
                'r6_psn': 'Rainbow Six Siege (PSN)',
                'r6_xbl': 'Rainbow Six Siege (Xbox)',
                'bf6_origin': 'Battlefield 6 (PC)',
                'bf6_psn': 'Battlefield 6 (PSN)',
                'bf6_xbl': 'Battlefield 6 (Xbox)',
                'fh_uplay': 'For Honor (PC)',
                'fh_psn': 'For Honor (PSN)',
                'fh_xbl': 'For Honor (Xbox)',
                'd2_steam': 'Destiny 2 (PC)',
                'd2_psn': 'Destiny 2 (PSN)',
                'd2_xbl': 'Destiny 2 (Xbox)',
                'steam': 'Steam',
                'valorant': 'Valorant'
            };

                        await interaction.reply({ 
                            content: `✅ Erfolgreich verknüpft!\n**Plattform:** ${platformNames[platform]}\n**ID:** \`${externalId}\``,
                            ephemeral: true 
                        });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Fehler beim Verknüpfen des Accounts.', ephemeral: true });
        }
    },
};