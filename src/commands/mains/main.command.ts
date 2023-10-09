import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../interfaces/command";
import toggleCharacter from "./main.discord";

const data = new SlashCommandBuilder()
  .setName("main")
  .setDescription("Selecciona tu main")
  .addStringOption((option) =>
    option
      .setName("character")
      .setDescription("El personaje que pondrás como main")
      .setRequired(true),
  );

async function execute(interaction: CommandInteraction) {
  await toggleCharacter(interaction, "MAIN");
}

const main: Command = {
  data,
  execute,
};

export default main;
