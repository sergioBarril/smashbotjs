// Require the necessary discord.js classes

const fs = require("fs");
const { Client, Collection, Intents } = require("discord.js");

// Get ENV variables
const dotenv = require("dotenv");
dotenv.config();
const token = process.env.DISCORD_TOKEN;

// Setup Logger
const winston = require("winston");
winston.configure({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: "matchmaking.log" })],
});

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

// Login to Discord with your client's token
client.login(token);
