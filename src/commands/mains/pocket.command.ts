import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../interfaces/command";
import toggleCharacter from "./main.discord";

const data = new SlashCommandBuilder()
  .setName("pocket")
  .setDescription("Selecciona tu pocket")
  .addStringOption((option) =>
    option
      .setName("character")
      .setDescription("El personaje que pondrás como pocket")
      .setRequired(true),
  );

async function execute(interaction: CommandInteraction) {
  await toggleCharacter(interaction, "POCKET");
}

const pocket: Command = {
  data,
  execute,
};

export default pocket;
