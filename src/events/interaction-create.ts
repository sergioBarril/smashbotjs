import { ChatInputCommandInteraction, Events, Interaction } from "discord.js";
import CustomClient from "../config/custom-client";
import { Event } from "../interfaces/event";
import ApiError from "../errors/api-error.error";

async function errorHandler(
  interaction: ChatInputCommandInteraction,
  error: Error,
) {
  console.error(error);

  let content = "There was an error while executing this command!";
  if (error instanceof ApiError && error.statusCode < 500) {
    content = error.message;
  }

  const response = { content, ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(response);
  } else {
    await interaction.reply(response);
  }
}

async function execute(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as CustomClient).commands.get(
    interaction.commandName,
  );

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
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
