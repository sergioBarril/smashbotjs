import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../interfaces/command";
import assignCharacter from "../../utils/role.js";

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
  await assignCharacter(interaction, "POCKET");
}

const pocket: Command = {
  data,
  execute,
};

export default pocket;
