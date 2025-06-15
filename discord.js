const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', () => {
    console.log(`✅ Discord bot ready as ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

async function assignRole(discordTag) {
    const [username, discriminator] = discordTag.split('#');
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    await guild.members.fetch();

    const member = guild.members.cache.find(
        m => m.user.username === username && m.user.discriminator === discriminator
    );

    if (!member) throw new Error('User not found in Discord server.');
    await member.roles.add(process.env.DISCORD_ROLE_ID);
}

module.exports = {
    assignRole,
};
