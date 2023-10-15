import { Collection, GatewayIntentBits } from "discord.js";
import CustomClient from "./config/custom-client";
import "dotenv/config";
import { Command } from "./interfaces/command";
import logger from "./config/logger";
import { loadButtons, loadCommands, loadEvents } from "./config/startup";
import { Event } from "./interfaces/event";
import { Button } from "./interfaces/button";

// Get ENV variables
const token = process.env.DISCORD_TOKEN;

// Create a new client instance
const client = new CustomClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();

// Register commands
const commands: Command[] = loadCommands();
commands.forEach((command) => {
  if (!command.data || !command.execute) return;
  logger.info(`Registering command ${command.data.name}`);
  client.commands.set(command.data.name, command);
});

// Register buttons
client.buttons = new Collection();

const buttons: Button[] = loadButtons();
buttons.forEach((button) => {
  if (!button.data || !button.execute) return;
  logger.info(`Registering button ${button.data.name}`);
  client.buttons.set(button.data.name, button);
});

// Event handling
const events: Event[] = loadEvents();
events.forEach((event) => {
  if (!event.name || !event.execute) return;
  if (event.once)
    client.once(event.name as any, (...args) => event.execute(...args, client));
  else
    client.on(event.name as any, (...args) => event.execute(...args, client));
});

// Log in to Discord with your client's token
client.login(token);
