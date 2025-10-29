const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });

// ===== CONFIG =====
const RESULTS_CHANNEL_ID = '1353497689693618226'; // Channel where results are posted
const STAT_CHANNEL_ID = '1389031896008101961'; // Channel to post tracker
const ROLE_ID = '1353499162502631484'; // Role to ping
const MOTM_EMOJI = '<:MOTM:1411802660029468744>'; 
const DOTM_EMOJI = '<:defender:1411802703775924224>'; 
// ==================

let stats = {}; // Store player stats

// ===== Parse results =====
function parseResultMessage(content) {
    const lines = content.split('\n');
    lines.forEach(line => {
        line = line.trim();
        const goalMatch = line.match(/^(\d+)x\s*<@!?(\d+)>/);
        if (goalMatch) {
            const goals = parseInt(goalMatch[1]);
            const playerId = goalMatch[2];
            if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[playerId].goals += goals;
        }
        const assistMatches = [...line.matchAll(/(\d+)x assist <@!?(\d+)>/g)];
assistMatches.forEach(match => {
    const assists = parseInt(match[1]);
    const playerId = match[2];
    if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
    stats[playerId].assists += assists;
});
        
        const motmMatch = line.match(/^MOTM:\s*<@!?(\d+)>/);
        if (motmMatch) {
            const playerId = motmMatch[1];
            if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[playerId].motm += 1;
        }
        const dotmMatch = line.match(/^DOTM:\s*<@!?(\d+)>/);
        if (dotmMatch) {
            const playerId = dotmMatch[1];
            if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[playerId].dotm += 1;
        }
    });
}

// ===== Build tracker message =====
function buildTrackerMessage(guild, includeRolePing = true) {
    const role = guild.roles.cache.get(ROLE_ID);
    if (!role) return 'Role not found!';
    let trackerMessage = '';
    const members = role.members;
    let leadingPlayerId = null;
    let highestGA = -1;
    members.forEach(member => {
        const s = stats[member.id] || { goals: 0, assists: 0, motm: 0, dotm: 0 };
        trackerMessage += `**<@${member.id}> GOALS x${s.goals} | ASSISTS x${s.assists} | x${s.motm} ${MOTM_EMOJI} | x${s.dotm} ${DOTM_EMOJI}**\n`;
        const ga = s.goals + s.assists;
        if (ga > highestGA) {
            highestGA = ga;
            leadingPlayerId = member.id;
        }
    });
    trackerMessage += `\n*Leading: <@${leadingPlayerId}>*\n`;
    const now = new Date();
    trackerMessage += `**${now.getDate()} / ${now.getMonth() + 1}**\n`;
    if (includeRolePing) trackerMessage += `<@&${ROLE_ID}>`;
    return trackerMessage;
}

// ===== Generate full team tracker =====
async function generateFullTeamTracker(guild, includeRolePing = true) {
    const statChannel = guild.channels.cache.get(STAT_CHANNEL_ID);
    if (!statChannel) return;
    const oldMessages = await statChannel.messages.fetch({ limit: 10 });
    oldMessages.forEach(msg => {
        if (msg.author.id === client.user.id) msg.delete().catch(() => {});
    });
    const message = buildTrackerMessage(guild, includeRolePing);
    await statChannel.send(message);
}

// ===== Auto parse results =====
client.on('messageCreate', async message => {
    if (message.channel.id === RESULTS_CHANNEL_ID && !message.author.bot) {
        parseResultMessage(message.content);
        await generateFullTeamTracker(message.guild, true); // Include role ping
    }
});

// ===== Manual stat tracker =====
client.on('messageCreate', async message => {
    if (message.content === '!statstracker') {
        await generateFullTeamTracker(message.guild, false); // No role ping
    }
});

// ===== Reset stats =====
client.on('messageCreate', async message => {
    if (message.content === '!resetstats') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('You do not have permission to reset stats.');
        }
        for (const playerId in stats) {
            stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
        }
        await generateFullTeamTracker(message.guild, true);
        message.channel.send('✅ All stats have been reset to 0.');
    }
});

// ===== Slash command: /adjuststat =====
const adjustStatCommand = new SlashCommandBuilder()
    .setName('adjuststat')
    .setDescription('Increase or decrease a player’s stat by 1')
    .addUserOption(option => option
        .setName('player')
        .setDescription('Select the player')
        .setRequired(true))
    .addStringOption(option => option
        .setName('stat')
        .setDescription('Which stat to adjust')
        .setRequired(true)
        .addChoices(
            { name: 'goals', value: 'goals' },
            { name: 'assists', value: 'assists' },
            { name: 'MOTM', value: 'motm' },
            { name: 'DOTM', value: 'dotm' },
        ))
    .addStringOption(option => option
        .setName('action')
        .setDescription('Increase or decrease the stat by 1')
        .setRequired(true)
        .addChoices(
            { name: 'Increase', value: 'increase' },
            { name: 'Decrease', value: 'decrease' },
        ));

// ===== Register slash command =====
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands('1432123360959140014', '1353495424056688760'),
            { body: [adjustStatCommand.toJSON()] },
        );
        console.log('Slash commands registered!');
    } catch (error) {
        console.error(error);
    }
})();

// ===== Handle slash command =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'adjuststat') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }
        const user = interaction.options.getUser('player');
        const stat = interaction.options.getString('stat');
        const action = interaction.options.getString('action');
        if (!stats[user.id]) stats[user.id] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
        if (action === 'increase') stats[user.id][stat] += 1;
        if (action === 'decrease') stats[user.id][stat] -= 1;
        if (stats[user.id][stat] < 0) stats[user.id][stat] = 0;
        await generateFullTeamTracker(interaction.guild);
        await interaction.reply({ content: `✅ ${user.username}’s ${stat} has been ${action}d by 1.`, ephemeral: false });
    }
});

// ===== Login =====
client.login(process.env.DISCORD_TOKEN);

// ===== Keep-alive web server for Render =====
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(3000, () => console.log('✅ Keep-alive server running on port 3000'));
