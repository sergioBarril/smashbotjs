/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable no-await-in-loop */
import { readdirSync } from "node:fs";
import path from "node:path";

import { Collection, GatewayIntentBits } from "discord.js";
import CustomClient from "./config/custom-client";
import "dotenv/config";
import { Command } from "./interfaces/command";

// Get ENV variables
const token = process.env.DISCORD_TOKEN;

// Create a new client instance
const client = new CustomClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();

// Read all command files
const commandsPath = path.join(__dirname, "commands");
const commandFolders = readdirSync(commandsPath);

const commandUrls: string[] = [];

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);

  const commandFiles = readdirSync(folderPath).filter(
    (file) => file.endsWith(".command.ts") || file.endsWith(".command.js"),
  );

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    commandUrls.push(filePath);
  }
}

const commands: Command[] = commandUrls
  .map((commandPath) => require(commandPath))
  .flat()
  .map((module) => module.default);

commands.forEach((command) => {
  if (!command.data || !command.execute) return;
  console.log("Registering command", command.data.name);
  client.commands.set(command.data.name, command);
});

// Event handling
const eventFiles = readdirSync(path.join(__dirname, "events"));
for (const file of eventFiles) {
  const filePath = path.join(__dirname, "events", file);
  const event = require(filePath).default;

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Log in to Discord with your client's token
client.login(token);
