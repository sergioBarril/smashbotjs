import axios from "axios";
import { CommandInteraction } from "discord.js";

const { API_URL } = process.env;

type MainType = "MAIN" | "SECONDARY" | "POCKET";
type Character = {
  id: number;
  name: string;
  emoji?: string;
};
type MainAction = "CREATED" | "UPDATED" | "DELETED";

function toggleMainMessage(
  character: Character,
  action: MainAction,
  type: string,
): string {
  const { name, emoji = "" } = character;

  const lowerType = type.toLowerCase();

  if (action === "CREATED") {
    return `Te he asignado a **${name} ${emoji}** como ${lowerType}.`;
  }
  if (action === "UPDATED") {
    return `**${name} ${emoji}** ha pasado a ser tu ${lowerType}.`;
  }
  return `**${name} ${emoji}** ha dejado de ser tu ${lowerType}.`;
}

export default async function assignCharacter(
  interaction: CommandInteraction,
  type: MainType,
) {
  if (!interaction.isChatInputCommand()) return;

  const characterName = interaction.options.getString("character");
  const playerId = interaction.user.id;
  const { guild } = interaction;
  const guildDiscordId = guild?.id;

  const response = await axios.post(`${API_URL}/players/${playerId}/mains`, {
    characterName,
    guildDiscordId,
    type,
  });

  const { character, action } = response.data;
  const message = toggleMainMessage(character, action, type);

  await interaction.reply(message);
}
