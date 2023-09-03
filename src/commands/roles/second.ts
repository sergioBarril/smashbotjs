import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../interfaces/command";
import assignCharacter from "../../utils/role.js";

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
  await assignCharacter(interaction, "SECONDARY");
}

const second: Command = {
  data,
  execute,
};

export default second;
