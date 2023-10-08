/* eslint-disable no-await-in-loop */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";

import { Collection, GatewayIntentBits } from "discord.js";
import CustomClient from "./config/custom-client.js";
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
const commandFolders = readdirSync(commandsPath);

const commandUrls: string[] = [];

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);

  const commandFiles = readdirSync(folderPath).filter(
    (file) => file.endsWith(".command.ts") || file.endsWith(".command.js"),
  );

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    commandUrls.push(pathToFileURL(filePath).toString());
  }
}

const commands: Command[] = (
  await Promise.all(
    commandUrls.map((commandPath) => import(commandPath.toString())),
  )
)
  .flat()
  .map((module) => module.default);

commands.forEach((command) => {
  if (!command.data || !command.execute) return;
  console.log("Registering command", command.data.name);
  client.commands.set(command.data.name, command);
});

// Event handling
const eventFiles = readdirSync(path.join(dirName, "events"));
for (const file of eventFiles) {
  const module = await import(
    pathToFileURL(path.join(dirName, "events", file)).toString()
  );
  const event = module.default;

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Log in to Discord with your client's token
client.login(token);
