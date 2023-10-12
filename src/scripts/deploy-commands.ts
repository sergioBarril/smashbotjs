/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
import { REST, Routes } from "discord.js";
import "dotenv/config";
import path from "node:path";
import { readdirSync } from "node:fs";

import { Command } from "../interfaces/command";
import logger from "../config/logger";

// Get ENV variables
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) throw new Error("No token provided");
if (!CLIENT_ID) throw new Error("No client ID provided");
if (!GUILD_ID) throw new Error("No guild ID provided");

// Read all command files
const commandsPath = path.join(__dirname, "..", "commands");
const commandFolders = readdirSync(commandsPath);

const commandFileTree = commandFolders.map((folder) => {
  const folderPath = path.join(commandsPath, folder);
  const files = readdirSync(folderPath);
  return files
    .filter(
      (file) => file.endsWith(".command.ts") || file.endsWith(".command.js"),
    )
    .map((file) => path.join(folder, file));
});

const commandFiles = commandFileTree.flat();

// Import all command files
const commandPaths = commandFiles.map((file) => path.join(commandsPath, file));
logger.info(`Importing ${commandPaths.length} command files`);

const commandList: Command[] = commandPaths
  .map((commandPath) => require(commandPath))
  .flat()
  .map((module) => module.default);

const commands = commandList
  .filter((command) => command.data && command.execute)
  .map((command) => command.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(DISCORD_TOKEN);

// and deploy your commands!
logger.info(`Started refreshing ${commands.length} application (/) commands.`);

// The put method is used to fully refresh all commands in the guild with the current set
rest
  .put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  })
  .then((data: any) =>
    logger.info(
      `Successfully reloaded ${data.length} application (/) commands.`,
    ),
  )
  .catch((error) => logger.error(error));
