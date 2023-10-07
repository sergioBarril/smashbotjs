import { Events, Interaction } from "discord.js";
import CustomClient from "../config/custom-client";
import { Event } from "../interfaces/event";

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
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
}

const onInteractionCreate: Event = {
  name: Events.InteractionCreate,
  once: false,
  execute,
};

export default onInteractionCreate;
