const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });

// ===== CONFIGURE THESE =====
const RESULTS_CHANNEL_ID = '1353497689693618226'; // channel where match results are posted
const ROLE_ID = '1353499162502631484'; // role whose members are tracked
const MOTM_EMOJI = '<:MOTM:1411802660029468744>';
const DOTM_EMOJI = '<:defender:1411802703775924224>';
// ===========================

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (!message.guild) return;

    // Command to generate stat tracker
    if (message.content.startsWith('!statstracker')) {
        const role = message.guild.roles.cache.get(ROLE_ID);
        if (!role) return message.channel.send('Role not found.');

        // Get all members with this role
        const members = role.members.map(m => m.user.id);

        // Initialize stats
        const stats = {};
        members.forEach(id => {
            stats[id] = { goals: 0, assists: 0, motm: 0, dotm: 0 };
        });

        // Fetch messages from results channel
        const channel = message.guild.channels.cache.get(RESULTS_CHANNEL_ID);
        if (!channel) return message.channel.send('Results channel not found.');

        const messages = await channel.messages.fetch({ limit: 100 }); // adjust if needed

        messages.forEach(msg => {
            // Parse goal scorers (e.g., "2x <@USER_ID>")
            const goalRegex = /(\d+)x <@!?(\d+)>/g;
            let match;
            while ((match = goalRegex.exec(msg.content)) !== null) {
                const goals = parseInt(match[1]);
                const userId = match[2];
                if (stats[userId]) stats[userId].goals += goals;
            }

            // Parse assists (e.g., "1x assist <@USER_ID>")
            const assistRegex = /(\d+)x assist <@!?(\d+)>/g;
            while ((match = assistRegex.exec(msg.content)) !== null) {
                const assists = parseInt(match[1]);
                const userId = match[2];
                if (stats[userId]) stats[userId].assists += assists;
            }

            // Parse MOTM
            const motmRegex = /MOTM: <@!?(\d+)>/;
            const motmMatch = motmRegex.exec(msg.content);
            if (motmMatch && stats[motmMatch[1]]) stats[motmMatch[1]].motm += 1;

            // Parse DOTM
            const dotmRegex = /DOTM: <@!?(\d+)>/;
            const dotmMatch = dotmRegex.exec(msg.content);
            if (dotmMatch && stats[dotmMatch[1]]) stats[dotmMatch[1]].dotm += 1;
        });

        // Determine leading player (highest goals + assists)
        const leadingPlayerId = Object.keys(stats).reduce((a, b) => {
            const gaA = stats[a].goals + stats[a].assists;
            const gaB = stats[b].goals + stats[b].assists;
            return gaB > gaA ? b : a;
        });

        // Build the stat tracker message
        let trackerMessage = '';
        for (const [id, stat] of Object.entries(stats)) {
            trackerMessage += `** <@${id}> GOALS x${stat.goals} | ASSISTS x${stat.assists} | x${stat.motm} ${MOTM_EMOJI} | x${stat.dotm} ${DOTM_EMOJI} **\n`;
        }
        trackerMessage += `\n*Leading: <@${leadingPlayerId}>*\n`;

        // Add latest date
        const today = new Date();
        trackerMessage += `\n** ${today.getDate()} / ${today.getMonth() + 1} **\n`;

        // Add role ping
        trackerMessage += `# <@&${ROLE_ID}>`;

        message.channel.send(trackerMessage);
    }
});

// Login with token stored in Render as an environment variable
client.login(process.env.DISCORD_TOKEN);
