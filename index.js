const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });

// ===== CONFIG =====
const RESULTS_CHANNEL_ID = 'YOUR_RESULTS_CHANNEL_ID'; // Channel where results are posted
const STAT_CHANNEL_ID = 'YOUR_STAT_TRACKER_CHANNEL_ID'; // Channel to post tracker
const ROLE_ID = 'YOUR_ROLE_ID'; // Role to ping
const MOTM_EMOJI = '<:MOTM:1411802660029468744>'; 
const DOTM_EMOJI = '<:defender:1411802703775924224>'; 
// ==================

let stats = {}; // Store player stats

// ===== Helper: parse result message =====
function parseResultMessage(content) {
    const lines = content.split('\n');
    let currentPlayerId = null;

    lines.forEach(line => {
        line = line.trim();
        // Goal scorer line (e.g., "3x <@USERID>")
        const goalMatch = line.match(/^(\d+)x\s*<@!?(\d+)>/);
        if (goalMatch) {
            const goals = parseInt(goalMatch[1]);
            currentPlayerId = goalMatch[2];
            if (!stats[currentPlayerId]) stats[currentPlayerId] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
            stats[currentPlayerId].goals += goals;
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
function buildTrackerMessage(guild) {
    const role = guild.roles.cache
