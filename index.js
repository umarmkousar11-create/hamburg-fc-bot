const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Environment variables
const TEAM_ROLE_ID = process.env.TEAM_ROLE_ID;
const RESULTS_CHANNEL_ID = process.env.RESULTS_CHANNEL_ID;
const STATS_CHANNEL_ID = process.env.STATS_CHANNEL_ID;

// Data storage
let stats = {};

// Parse match results
function parseResults(message) {
    const lines = message.content.split('\n').map(l => l.trim()).filter(l => l);
    let motm, dotm;

    lines.forEach(line => {
        if (line.startsWith('MOTM:')) motm = line.replace('MOTM:', '').trim().replace(/<@!?(\d+)>/, '$1');
        else if (line.startsWith('DOTM:')) dotm = line.replace('DOTM:', '').trim().replace(/<@!?(\d+)>/, '$1');
        else if (/x <@!?(\d+)>/.test(line)) {
            const match = line.match(/(\d+)x <@!?(\d+)>/);
            const goals = parseInt(match[1]);
            const userId = match[2];

            if (!stats[userId]) stats[userId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[userId].goals += goals;

            const assistMatch = line.match(/-# (\d+)x assist <@!?(\d+)>/);
            if (assistMatch) {
                const assists = parseInt(assistMatch[1]);
                const assistUser = assistMatch[2];
                if (!stats[assistUser]) stats[assistUser] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
                stats[assistUser].assists += assists;
            }
        }
    });

    if (motm) {
        if (!stats[motm]) stats[motm] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
        stats[motm].motm += 1;
    }

    if (dotm) {
        if (!stats[dotm]) stats[dotm] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
        stats[dotm].dotm += 1;
    }
}

// Build leaderboard
function buildLeaderboard() {
    let leaderboard = '**HAMBURG FC PLAYER STATS (FM) <:hamburg:1432095514773684385>.**\n\n';
    const sorted = Object.entries(stats).sort((a, b) => {
        if (b[1].goals !== a[1].goals) return b[1].goals - a[1].goals;
        return b[1].assists - a[1].assists;
    });

    sorted.forEach(([id, s]) => {
        leaderboard += `${s.goals}x <@${id}>\n`;
        if (s.assists) leaderboard += `-# ${s.assists}x assist\n`;
        if (s.motm) leaderboard += `MOTM: ${s.motm} <:MOTM:1411802660029468744>\n`;
        if (s.dotm) leaderboard += `DOTM: ${s.dotm} <:defender:1411802703775924224>.\n`;
        leaderboard += '\n';
    });

    return leaderboard;
}

// Event: Listen for messages in results channel
client.on('messageCreate', message => {
    if (message.channel.id !== RESULTS_CHANNEL_ID) return;
    if (!message.member.roles.cache.has(TEAM_ROLE_ID)) return;

    parseResults(message);

    // Optional: react to confirm message processed
    message.react('✅');

    // Update stats channel automatically
    if (STATS_CHANNEL_ID) {
        const channel = client.channels.cache.get(STATS_CHANNEL_ID);
        if (channel) channel.send(buildLeaderboard());
    }
});

// Commands
client.on('messageCreate', message => {
    // Team stats command
    if (message.content === '!teamstats') {
        const channel = client.channels.cache.get(STATS_CHANNEL_ID) || message.channel;
        channel.send(buildLeaderboard());
    }

    // Player stats command
    if (message.content.startsWith('!playerstats')) {
        const mention = message.mentions.users.first();
        if (!mention) return message.channel.send('Mention a player.');
        const s = stats[mention.id];
        if (!s) return message.channel.send('No stats for this player.');
        let text = `**${mention.username} Stats:**\n`;
        text += `${s.goals}x Goals\n`;
        text += `${s.assists}x Assists\n`;
        if (s.motm) text += `MOTM: ${s.motm} <:MOTM:1411802660029468744>\n`;
        if (s.dotm) text += `DOTM: ${s.dotm} <:defender:1411802703775924224>.\n`;
        message.channel.send(text);
    }
});

client.login(process.env.TOKEN);
