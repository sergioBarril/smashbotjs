const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, GuildMember, Role } = require("discord.js");
const { Rating } = require("../models/rating");
const discordRolesUtils = require("../utils/discordRoles");

const smashRegions = require("../params/spanishRegions.json");
const smashCharacters = require("../params/smashCharacters.json");

const { Region } = require("../models/region");
const { getRating, getPlayerTier } = require("../api/rating");
const { getWifiTier, getGuild } = require("../api/guild");
const { getRegions, getCharacters } = require("../api/roles");
const { Character } = require("../models/character");

const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Visualiza tu perfil")
  .addUserOption((option) =>
    option
      .setName("player")
      .setDescription("Persona de quién ver el perfil. Si lo dejas vacío, serás tú")
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("personal")
      .setDescription("Si lo marcas, el mensaje será privado")
      .setRequired(false)
  );

/**
 *
 * @param {GuildMember} member
 * @param {Role} tierRole
 * @param {Region[]} regions
 * @param {Rating} rating
 * @param {{mains: Character[], seconds: Character[], pockets: Character[]}} characters
 */
function makeEmbed(member, tierRole, regions, rating, characters) {
  const fields = [];
  if (regions?.length > 0) {
    const name = `**Regi${regions.length > 1 ? "ones" : "ón"}:**`;
    const value = regions.map((r) => `${r.name} ${smashRegions[r.name].emoji}`).join("\n");
    fields.push({ name, value, inline: false });
  }

  let tierText = "";
  if (rating && rating.score) {
    const name = `**Ranked:**`;
    let value = `Puntuación: ${rating.score}`;
    if (rating.promotion) {
      value += ` **[${rating.promotionWins} - ${rating.promotionLosses}]**`;
      if (rating.promotionBonusScore !== 0) {
        const sign = rating.promotionBonusScore > 0 ? "+" : "";
        value += ` _**(${sign}${rating.promotionBonusScore})**_`;
      }
    }
    fields.push({ name, value, inline: false });

    tierText = ` (${tierRole.name})`;
  }

  if (characters.mains?.length > 0) {
    const name = `**Main${characters.mains.length > 1 ? "s" : ""}:**`;
    const value = characters.mains
      .map((c) => `${c.name} (${smashCharacters[c.name].emoji})`)
      .join("\n");
    fields.push({ name, value, inline: false });
  }

  if (characters.seconds?.length > 0) {
    const name = `**Second${characters.seconds.length > 1 ? "s" : ""}:**`;
    const value = characters.seconds.map((c) => smashCharacters[c.name].emoji).join(" ");
    fields.push({ name, value, inline: true });
  }

  if (characters.pockets?.length > 0) {
    const name = `**Pocket${characters.pockets.length > 1 ? "s" : ""}:**`;
    const value = characters.pockets.map((c) => smashCharacters[c.name].emoji).join(" ");
    fields.push({ name, value, inline: true });
  }

  const embed = new MessageEmbed()
    .setColor(tierRole.color)
    .setTitle(`__${member.displayName}__${tierText}`)
    .addFields(...fields)
    .setThumbnail(member.displayAvatarURL())
    .setTimestamp();

  return embed;
}

module.exports = {
  data: data,
  async execute(interaction) {
    const member = interaction.options.getMember("player") || interaction.member;
    const guild = interaction.guild;
    const ephemeral = !!interaction.options.getBoolean("personal");

    const rating = await getRating(member.id, guild.id);
    const guildInfo = await getGuild(guild.id);
    let tier = await getPlayerTier(member.id, guild.id, true);
    if (!tier) tier = await getWifiTier(guild.id);
    let roleId = tier.roleId;

    if (member.roles.cache.has(guildInfo.tierXRoleId)) {
      roleId = guildInfo.tierXRoleId;
    }

    const tierRole = await guild.roles.fetch(roleId);
    const regions = await getRegions(member.id);
    const characters = await getCharacters(member.id);

    await member.fetch();
    const embed = makeEmbed(member, tierRole, regions, rating, characters);

    await interaction.reply({ embeds: [embed], ephemeral });
  },
};
