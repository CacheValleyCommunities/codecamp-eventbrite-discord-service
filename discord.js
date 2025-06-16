const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.GuildMembers],
});

client.once('ready', () => {
    console.log(`✅ Discord bot ready as ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

async function assignRole(usernameInput) {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    await guild.members.fetch(); // fetch all members

    const member = guild.members.cache.find(member =>
        member.user.username.toLowerCase() === usernameInput.toLowerCase()
    );

    if (!member) {
        throw new Error(`❌ No user found with username "${usernameInput}"`);
    }

    await guild.roles.fetch();
    const roles = guild.roles.cache.map(role => `${role.name} (ID: ${role.id})`).join('\n');
    console.log(`🔍 Available roles in the guild:\n${roles}`);
    const role = guild.roles.cache.get(process.env.DISCORD_ROLE_ID);
    if (!role) {
        throw new Error(`❌ Role with ID ${process.env.DISCORD_ROLE_ID} not found`);
    }

    if (role.position >= guild.members.me.roles.highest.position) {
        throw new Error(`❌ Bot cannot assign this role due to role hierarchy.`);
    }

    await member.roles.add(role);
    console.log(`✅ Role assigned to ${member.user.username} (${member.id})`);
}


module.exports = {
    assignRole,
};
