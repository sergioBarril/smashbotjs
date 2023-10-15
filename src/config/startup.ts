/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
import { readdirSync } from "fs";
import path from "path";
import { Command } from "../interfaces/command";
import { Event } from "../interfaces/event";

/**
 * Get all the commands in the commands folder
 * @returns An array of commands
 */
export function loadCommands() {
  const commandsPath = path.join(__dirname, "..", "commands");
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

  return commands;
}

export function loadEvents(): Event[] {
  const eventsFolder = path.join(__dirname, "..", "events");
  const eventFiles = readdirSync(eventsFolder);

  return eventFiles.map((file) => {
    const filePath = path.join(eventsFolder, file);
    return require(filePath).default;
  });
}
