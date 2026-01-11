const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
                ))
        .addAttachmentOption(option =>
            option.setName('bild')
                .setDescription('Optional: Ein Screenshot oder Bild dazu'))
        .addStringOption(option => 
            option.setName('tags')
                .setDescription('Komma-getrennte Tags (z.B. #valorant)')),
    async execute(interaction) {
        const user = interaction.options.getUser('nutzer');
        const text = interaction.options.getString('text');
        const category = interaction.options.getString('kategorie') || 'general';
        const image = interaction.options.getAttachment('bild');
        const tagsInput = interaction.options.getString('tags');
        const addedBy = interaction.user.username;

        // 1. Check: Self-Save Prevention
        if (user.id === interaction.user.id) {
            return interaction.reply({ content: 'Nice try! Du kannst deine eigenen Sachen nicht speichern. Eigenlob stinkt. 👃', ephemeral: true });
        }

        // 2. Check: Tag Management
        let validTags = null;
        if (tagsInput) {
            const rawTags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
            const processedTags = rawTags.map(t => t.startsWith('#') ? t : `#${t}`); // Ensure hashtag format
            
            const newTags = [];
            
            // Check which tags are new
            for (const tag of processedTags) {
                if (!db.tagExists(tag)) {
                    newTags.push(tag);
                }
            }

            if (newTags.length > 0) {
                // Check if user has permission to create new tags
                const tagCreatorRoleId = db.getConfig('tag_creator_role_id');
                const hasRole = tagCreatorRoleId ? interaction.member.roles.cache.has(tagCreatorRoleId) : false;
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                // Allow if user has the specific role OR is Admin. 
                // If no role is set, fall back to ManageMessages for backward compatibility/default behavior.
                const hasPermission = tagCreatorRoleId 
                    ? (hasRole || isAdmin) 
                    : interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

                if (!hasPermission) {
                    const existingTags = db.getAllTags().join(', ');
                    return interaction.reply({ 
                        content: `🛑 Du hast keine Berechtigung, neue Tags zu erstellen (${newTags.join(', ')}).\n\nErlaubte Tags: ${existingTags}`, 
                        ephemeral: true 
                    });
                } else {
                    // Create the new tags
                    newTags.forEach(tag => db.createTag(tag, interaction.user.username));
                }
            }
            
            validTags = processedTags.join(', ');
        }

        const categoryNames = {
            'general': 'Allgemein',
            'fail': 'Fail',
            'win': 'Win'
        };
        const categoryLabel = categoryNames[category] || category;
        const imageUrl = image ? image.url : null;

        try {
            db.addQuote(user.id, user.username, text, addedBy, category, imageUrl, validTags);
            
            let replyText = `Zitat für **${user.username}** gespeichert: "${text}" (${categoryLabel})`;
            if (validTags) replyText += ` [Tags: ${validTags}]`;
            if (imageUrl) replyText += ` [Mit Bild]`;
            
            await interaction.reply(replyText);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Fehler beim Speichern des Zitats.', ephemeral: true });
        }
    },
};