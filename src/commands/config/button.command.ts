import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { Command } from "../../interfaces/command";

const data = new SlashCommandBuilder()
  .setName("button")
  .setDescription("Create a button with the given custom id")
  .addStringOption((option) =>
    option
      .setName("custom-id")
      .setDescription("Custom-id for the button")
      .setRequired(true),
  );

async function execute(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) throw new Error("Not a command");
  const customId = interaction.options.getString("custom-id", true);
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel("Click me!")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.reply({
    content: `Button with custom-id: ${customId}`,
    components: [row],
  });
}

const ping: Command = {
  data,
  execute,
};

export default ping;
