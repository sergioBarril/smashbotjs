import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";

import { Collection, Events, GatewayIntentBits } from "discord.js";
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

// Define the path to the current directory
const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);

// Read all command files
const commandsPath = path.join(dirName, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts"));

// Import all command files
const commandPaths = commandFiles.map((file) =>
  pathToFileURL(path.join(commandsPath, file)),
);
const commands: Command[] = (
  await Promise.all(
    commandPaths.map((commandPath) => import(commandPath.toString())),
  )
).map((module) => module.default);

commands.forEach((command) => {
  if (!command.data || !command.execute) return;
  client.commands.set(command.data.name, command);
});

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);
