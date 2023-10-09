import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../interfaces/command";
import toggleCharacter from "./main.discord";

const data = new SlashCommandBuilder()
  .setName("second")
  .setDescription("Selecciona tu second")
  .addStringOption((option) =>
    option
      .setName("character")
      .setDescription("El personaje que pondrás como second")
      .setRequired(true),
  );

async function execute(interaction: CommandInteraction) {
  await toggleCharacter(interaction, "SECOND");
}

const second: Command = {
  data,
  execute,
};

export default second;
