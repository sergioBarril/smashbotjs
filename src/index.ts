import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";

// Get ENV variables
const token = process.env.DISCORD_TOKEN;

// Create a new client instance
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);
