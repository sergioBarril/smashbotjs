import axios from "axios";
import { CommandInteraction } from "discord.js";
import { Role } from "../types/role";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function toggleRole(
  interaction: CommandInteraction,
  roleData: Role,
  action: MainAction,
) {
  if (!interaction.inCachedGuild())
    throw new Error("No guild found for this interaction");

  const { guild, member } = interaction;

  if (!guild) throw new Error("No guild found for this interaction");
  if (!member) throw new Error("No member found for this interaction");

  const role = await guild.roles.fetch(roleData.discordId);
  if (!role) throw new Error("No role found");

  if (action === "CREATED") {
    await member.roles.add(role);
  } else if (action === "DELETED") {
    await member.roles.remove(role);
  }
}

export default async function assignCharacter(
  interaction: CommandInteraction,
  type: MainType,
) {
  if (!interaction.isChatInputCommand()) throw new Error("Not a command");
  await interaction.deferReply({ ephemeral: true });

  const characterName = interaction.options.getString("character");
  const playerId = interaction.user.id;
  const { guild } = interaction;
  const guildDiscordId = guild?.id;

  const response = await axios
    .post(`${API_URL}/players/${playerId}/mains`, {
      characterName,
      guildDiscordId,
      type,
    })
    .catch((error) => {
      if (!error.response) throw error;
      const { status, data } = error.response;
      if (status === 500) {
        throw new Error("Internal server error");
      }

      throw new Error(data.message);
    });

  const { character, action, oldType, newType } = response.data;

  const message = toggleMainMessage(character, action, newType ?? oldType);
  // if (role) await toggleRole(interaction, role, action);

  await interaction.editReply(message);
}
