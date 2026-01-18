const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Teilnahme an der Serverlotterie')
        .addSubcommand(subcommand =>
            subcommand
                .setName('teilnehmen')
                .setDescription('Kaufe ein Lotterie-Ticket')
                .addIntegerOption(option =>
                    option.setName('anzahl')
                        .setDescription('Anzahl der Tickets (1 Ticket = 10 Coins)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(10)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Zeige den aktuellen Lotterie-Status'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ziehen')
                .setDescription('Ziehe einen Gewinner (nur Admin)')
                .addIntegerOption(option =>
                    option.setName('anzahl_gewinner')
                        .setDescription('Anzahl der Gewinner')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(5)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Setze die Lotterie zurück (nur Admin)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'teilnehmen':
                await handleJoin(interaction);
                break;
            case 'status':
                await handleStatus(interaction);
                break;
            case 'ziehen':
                await handleDraw(interaction);
                break;
            case 'reset':
                await handleReset(interaction);
                break;
        }
    }
};

async function handleJoin(interaction) {
    const ticketCount = interaction.options.getInteger('anzahl') || 1;
    const ticketPrice = 10;
    const totalCost = ticketCount * ticketPrice;
    const userId = interaction.user.id;

    // Check if user has enough coins
    const userData = db.getUserCoins(userId);
    if (userData.coins < totalCost) {
        return interaction.reply({
            content: `❌ Du hast nicht genug Coins! Du brauchst ${totalCost.toLocaleString('de-DE')} Coins (${ticketCount} x ${ticketPrice} Coins).`,
            ephemeral: true
        });
    }

    // Deduct coins
    db.addCoins(userId, -totalCost, 'lottery', `${ticketCount} Lotterie-Ticket${ticketCount > 1 ? 's' : ''} gekauft`);

    // Add tickets to lottery
    const currentTickets = db.getLotteryTickets(userId);
    db.addLotteryTickets(userId, interaction.user.username, ticketCount);

    const newBalance = db.getUserCoins(userId).coins;
    const totalTickets = currentTickets + ticketCount;

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎟️ Lotterie-Ticket gekauft!')
        .setDescription(`Du hast erfolgreich **${ticketCount}** Ticket${ticketCount > 1 ? 's' : ''} gekauft!`)
        .addFields(
            { name: '💰 Kosten', value: `${totalCost.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎫 Deine Tickets', value: `${totalTickets} Ticket${totalTickets > 1 ? 's' : ''}`, inline: true },
            { name: '💳 Neuer Kontostand', value: `${newBalance.toLocaleString('de-DE')} Coins`, inline: true }
        )
        .setFooter({ text: 'Viel Glück! Nutze /lottery status um den Jackpot zu sehen.' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleStatus(interaction) {
    const lotteryData = db.getLotteryStatus();
    const userTickets = db.getLotteryTickets(interaction.user.id);

    if (lotteryData.totalTickets === 0) {
        return interaction.reply({
            content: '🎟️ Derzeit sind keine Tickets verkauft. Sei der Erste und kaufe ein Ticket mit `/lottery teilnehmen`!',
            ephemeral: true
        });
    }

    const jackpot = lotteryData.totalTickets * 10; // Each ticket is 10 coins
    const winChance = userTickets > 0 ? ((userTickets / lotteryData.totalTickets) * 100).toFixed(2) : 0;

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🎰 Lotterie Status')
        .setDescription('Aktuelle Lotterie-Informationen')
        .addFields(
            { name: '💰 Jackpot', value: `${jackpot.toLocaleString('de-DE')} Coins`, inline: true },
            { name: '🎫 Verkaufte Tickets', value: `${lotteryData.totalTickets.toLocaleString('de-DE')}`, inline: true },
            { name: '👥 Teilnehmer', value: `${lotteryData.participants}`, inline: true },
            { name: '🎟️ Deine Tickets', value: `${userTickets}`, inline: true },
            { name: '📊 Deine Gewinnchance', value: `${winChance}%`, inline: true },
            { name: '🎁 Ticket-Preis', value: '10 Coins', inline: true }
        )
        .setFooter({ text: 'Kaufe mehr Tickets mit /lottery teilnehmen' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleDraw(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: '❌ Nur Administratoren können die Lotterie ziehen!',
            ephemeral: true
        });
    }

    const winnerCount = interaction.options.getInteger('anzahl_gewinner') || 1;
    const lotteryData = db.getLotteryStatus();

    if (lotteryData.totalTickets === 0) {
        return interaction.reply({
            content: '❌ Es sind keine Tickets verkauft. Es kann kein Gewinner gezogen werden.',
            ephemeral: true
        });
    }

    if (lotteryData.participants < winnerCount) {
        return interaction.reply({
            content: `❌ Es gibt nur ${lotteryData.participants} Teilnehmer, aber du möchtest ${winnerCount} Gewinner ziehen!`,
            ephemeral: true
        });
    }

    // Draw winners
    const winners = db.drawLotteryWinners(winnerCount);
    const jackpot = lotteryData.totalTickets * 10;

    // Distribute prizes
    let prizeDistribution = [];
    if (winnerCount === 1) {
        // Single winner takes all
        db.addCoins(winners[0].userId, jackpot, 'lottery_win', 'Lotterie Gewinn');
        prizeDistribution.push({ ...winners[0], prize: jackpot });
    } else {
        // Multiple winners - descending prize distribution (50%, 30%, 20% for 3 winners, etc.)
        const percentages = [0.5, 0.3, 0.15, 0.04, 0.01]; // For up to 5 winners
        for (let i = 0; i < winners.length; i++) {
            const prize = Math.floor(jackpot * percentages[i]);
            db.addCoins(winners[i].userId, prize, 'lottery_win', `Lotterie Gewinn (Platz ${i + 1})`);
            prizeDistribution.push({ ...winners[i], prize, place: i + 1 });
        }
    }

    // Create winner announcement
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 LOTTERIE GEWINNER!')
        .setDescription(`🎰 **Jackpot:** ${jackpot.toLocaleString('de-DE')} Coins\n🎫 **Tickets:** ${lotteryData.totalTickets.toLocaleString('de-DE')}\n👥 **Teilnehmer:** ${lotteryData.participants}`)
        .setTimestamp();

    if (winnerCount === 1) {
        const winner = prizeDistribution[0];
        embed.addFields({
            name: '🏆 Gewinner',
            value: `**${winner.username}**\n💰 Gewinn: **${winner.prize.toLocaleString('de-DE')} Coins**\n🎫 Tickets: ${winner.tickets}`,
            inline: false
        });
    } else {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        for (const winner of prizeDistribution) {
            embed.addFields({
                name: `${medals[winner.place - 1]} Platz ${winner.place}`,
                value: `**${winner.username}**\n💰 ${winner.prize.toLocaleString('de-DE')} Coins\n🎫 ${winner.tickets} Tickets`,
                inline: true
            });
        }
    }

    // Reset lottery
    db.resetLottery();

    embed.setFooter({ text: 'Die Lotterie wurde zurückgesetzt. Kaufe neue Tickets mit /lottery teilnehmen!' });

    await interaction.reply({ embeds: [embed] });
}

async function handleReset(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: '❌ Nur Administratoren können die Lotterie zurücksetzen!',
            ephemeral: true
        });
    }

    const lotteryData = db.getLotteryStatus();

    if (lotteryData.totalTickets === 0) {
        return interaction.reply({
            content: '⚠️ Die Lotterie ist bereits leer.',
            ephemeral: true
        });
    }

    // Refund all tickets
    db.refundAllLotteryTickets();
    db.resetLottery();

    const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔄 Lotterie zurückgesetzt')
        .setDescription(`Die Lotterie wurde zurückgesetzt.\n\n💰 Alle ${lotteryData.totalTickets} Tickets (${lotteryData.totalTickets * 10} Coins) wurden an die Teilnehmer zurückerstattet.`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
