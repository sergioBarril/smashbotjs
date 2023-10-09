/* eslint-disable no-console */
import { REST, Routes } from "discord.js";
import "dotenv/config";

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "../interfaces/command";

// Get ENV variables
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) throw new Error("No token provided");
if (!CLIENT_ID) throw new Error("No client ID provided");
if (!GUILD_ID) throw new Error("No guild ID provided");

// Define the path to the current directory
const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

// Read all command files
const commandsPath = path.join(dirName, "..", "commands");
const commandFolders = await readdir(commandsPath);

const commandFileTree = await Promise.all(
  commandFolders.map(async (folder) => {
    const folderPath = path.join(commandsPath, folder);
    const files = await readdir(folderPath);
    return files
      .filter(
        (file) => file.endsWith(".command.ts") || file.endsWith(".command.js"),
      )
      .map((file) => path.join(folder, file));
  }),
);

const commandFiles = commandFileTree.flat();

// Import all command files
const commandPaths = commandFiles.map((file) =>
  pathToFileURL(path.join(commandsPath, file)),
);

console.log(`Importing ${commandPaths.length} command files`);

const commandList: Command[] = (
  await Promise.all(
    commandPaths.map((commandPath) => import(commandPath.toString())),
  )
)
  .flat()
  .map((module) => module.default);

const commands = commandList
  .filter((command) => command.data && command.execute)
  .map((command) => command.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(DISCORD_TOKEN);

// and deploy your commands!
try {
  console.log(
    `Started refreshing ${commands.length} application (/) commands.`,
  );

  // The put method is used to fully refresh all commands in the guild with the current set
  const data = (await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands },
  )) as any[];

  console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
  // And of course, make sure you catch and log any errors!
  console.error(error);
}
