const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Ein Spiel mit dem Schicksal. 1/6 Chance auf einen 60-Sekunden-Timeout.'),
    async execute(interaction) {
        // Check if the bot can actually timeout members
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ Ich habe keine Berechtigung, Mitglieder stummzuschalten (Moderate Members).', ephemeral: true });
        }

        // Check if the target is moderateable (admins/owners usually aren't)
        if (!interaction.member.moderatable) {
            return interaction.reply({ content: '🛡️ Du bist zu mächtig für dieses Spiel (kann nicht gemuted werden).', ephemeral: true });
        }

        const chance = Math.floor(Math.random() * 6); // 0 to 5

        if (chance === 0) {
            try {
                await interaction.member.timeout(60 * 1000, 'Verloren beim Russischen Roulette');
                await interaction.reply('💥 **PENG!** Das war die Kugel. Bis in 60 Sekunden!');
            } catch (error) {
                console.error('Roulette error:', error);
                await interaction.reply({ content: 'Fehler beim Ausführen des Timeouts.', ephemeral: true });
            }
        } else {
            await interaction.reply('🔫 *Klick*... Glück gehabt! Die Kammer war leer.');
        }
    },
};
