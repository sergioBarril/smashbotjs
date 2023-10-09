import { CommandInteraction } from "discord.js";
import { Character, MainAction, MainType } from "./main";
import MainService from "./main.service";

/**
 * Parses the interaction to get the data
 */
function parseInputCommand(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) throw new Error("Not a command");
  const characterName = interaction.options.getString("character")!;
  const { guild, user } = interaction;

  return { characterName, playerId: user.id, guildId: guild?.id };
}

function toggleCharacterMessage(
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

async function toggleRole(
  interaction: CommandInteraction,
  characterId: number,
  action: MainAction,
) {
  if (!interaction.inCachedGuild())
    throw new Error("No guild found for this interaction");

  const { guild, member } = interaction;

  const roleData = await MainService.getRole(guild.id, characterId);

  const role = await guild.roles.fetch(roleData.discordId);
  if (!role) throw new Error("No role found");

  if (action === "CREATED") {
    await member.roles.add(role);
  } else if (action === "DELETED") {
    await member.roles.remove(role);
  }
}

/**
 * Assigns a character to a player
 */
export default async function toggleCharacter(
  interaction: CommandInteraction,
  type: MainType,
) {
  const { characterName, playerId, guildId } = parseInputCommand(interaction);
  await interaction.deferReply({ ephemeral: true });

  const { character, action, oldType, newType } =
    await MainService.toggleCharacter({
      characterName,
      playerId,
      type,
    });

  const message = toggleCharacterMessage(
    character,
    action,
    (newType ?? oldType) as MainType,
  );

  await interaction.editReply(message);

  if (guildId) await toggleRole(interaction, character.id, action);
}
