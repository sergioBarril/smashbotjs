// Require the necessary discord.js classes

const fs = require("fs");
const { Routes } = require("discord-api-types/v9");
const { Client, Collection, Intents } = require("discord.js");

// Get ENV variables
const dotenv = require("dotenv");
dotenv.config();
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS] });

// Commands
client.commands = new Collection();
const commandFiles = fs.readdirSync("./commands").filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Buttons
client.buttons = new Collection();
const buttonFiles = fs.readdirSync("./buttons").filter((file) => file.endsWith(".js"));

for (const file of buttonFiles) {
  const command = require(`./buttons/${file}`);
  client.buttons.set(command.data.name, command);
}
// Events
const eventFiles = fs.readdirSync("./events").filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, async (...args) => await event.execute(...args));
  }
}

// Guild commands
const { REST } = require("@discordjs/rest");

const rest = new REST({ version: "9" }).setToken(token);

// (async () => {
//   try {
//     console.log("Started refreshing application (/) commands.");

//     await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
//       body: commandFiles.map((file) => {
//         const command = require(`./commands/${file}`);
//         return command.data.toJSON();
//       }),
//     });

//     console.log("Successfully reloaded application (/) commands");
//   } catch (error) {
//     console.error(error);
//   }
// })();

// Login to Discord with your client's token
client.login(token);
