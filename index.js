const { Client, GatewayIntentBits } = require('discord.js');
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

// ===== Helper: parse result message =====
function parseResultMessage(content) {
    const lines = content.split('\n');
    lines.forEach(line => {
        line = line.trim();
        // Goal scorer line (e.g., "3x <@USERID>")
        const goalMatch = line.match(/^(\d+)x\s*<@!?(\d+)>/);
        if (goalMatch) {
            const goals = parseInt(goalMatch[1]);
            const playerId = goalMatch[2];
            if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[playerId].goals += goals;
        }

        // Assists line (e.g., "-# 1x assist <@USERID>")
        const assistMatch = line.match(/^-# (\d+)x assist <@!?(\d+)>/);
        if (assistMatch) {
            const assists = parseInt(assistMatch[1]);
            const playerId = assistMatch[2];
            if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[playerId].assists += assists;
        }

        // MOTM line
        const motmMatch = line.match(/^MOTM:\s*<@!?(\d+)>/);
        if (motmMatch) {
            const playerId = motmMatch[1];
            if (!stats[playerId]) stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[playerId].motm += 1;
        }

        // DOTM line
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

    // Optionally delete old messages by bot
    const oldMessages = await statChannel.messages.fetch({ limit: 10 });
    oldMessages.forEach(msg => {
        if (msg.author.id === client.user.id) msg.delete().catch(() => {});
    });

    const message = buildTrackerMessage(guild, includeRolePing);
    await statChannel.send(message);
}

// ===== Listen to results channel for automatic parsing (with role ping) =====
client.on('messageCreate', async message => {
    if (message.channel.id === RESULTS_CHANNEL_ID && !message.author.bot) {
        parseResultMessage(message.content);
        await generateFullTeamTracker(message.guild, true); // include role ping
    }
});

// ===== Manual command: !statstracker (no role ping) =====
client.on('messageCreate', async message => {
    if (message.content === '!statstracker') {
        await generateFullTeamTracker(message.guild, false); // exclude role ping
    }
});

// ===== Reset stats command: !resetstats =====
client.on('messageCreate', async message => {
    if (message.content === '!resetstats') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('You do not have permission to reset stats.');
        }

        // Reset all stats
        for (const playerId in stats) {
            stats[playerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
        }

        await generateFullTeamTracker(message.guild, true); // include role ping after reset
        message.channel.send('✅ All stats have been reset to 0.');
    }
});

// ===== Login =====
client.login(process.env.DISCORD_TOKEN);
