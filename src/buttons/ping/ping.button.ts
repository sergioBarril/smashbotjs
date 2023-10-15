import { ButtonInteraction } from "discord.js";

export default {
  data: { name: "ping" },
  async execute(interaction: ButtonInteraction) {
    await interaction.reply("Pong!");
  },
};
