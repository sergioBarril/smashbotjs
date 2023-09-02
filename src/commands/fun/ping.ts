import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../interfaces/command";

const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

async function execute(interaction: CommandInteraction) {
  await interaction.reply("Pong!");
}

const ping: Command = {
  data,
  execute,
};

export default ping;
