import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Events,
  Interaction,
} from "discord.js";
import CustomClient from "../config/custom-client";
import { Event } from "../interfaces/event";
import ApiError from "../errors/api-error.error";
import logger from "../config/logger";

async function errorHandler(interaction: Interaction, error: Error) {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  let content = "There was an error while executing this command!";
  if (error instanceof ApiError && error.statusCode < 500) {
    logger.warn(error, error.message);
    content = error.message;
  } else logger.error(error);

  const response = { content, ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(response);
  } else {
    await interaction.reply(response);
  }
}

async function commandHandler(interaction: ChatInputCommandInteraction) {
  const command = (interaction.client as CustomClient).commands.get(
    interaction.commandName,
  );

  if (!command)
    throw new Error(
      `No command matching ${interaction.commandName} was found.`,
    );

  await command.execute(interaction);
}

async function buttonHandler(interaction: ButtonInteraction) {
  const button = (interaction.client as CustomClient).buttons.get(
    interaction.customId,
  );

  if (!button) {
    throw new Error(`No button matching ${interaction.customId} was found.`);
  }

  await button.execute(interaction);
}

async function execute(interaction: Interaction) {
  try {
    if (interaction.isButton()) await buttonHandler(interaction);
    else if (interaction.isChatInputCommand())
      await commandHandler(interaction);
  } catch (error) {
    await errorHandler(interaction, error as Error);
  }
}

const onInteractionCreate: Event = {
  name: Events.InteractionCreate,
  once: false,
  execute,
};

export default onInteractionCreate;
