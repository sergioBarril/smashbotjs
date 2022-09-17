const { Interaction } = require("discord.js");
const { getTiers } = require("../../../api/tier");
const { NotFoundError } = require("../../../errors/notFound");
const { assignTier } = require("../../../utils/discordTiers");

/**
 *
 * @param {Interaction} interaction
 */
const setTier = async (interaction) => {
  const guild = interaction.guild;
  const member = interaction.options.getMember("player");
  const role = interaction.options.getRole("tier");

  // Check that the role is indeed a weighted tier
  const { weighted } = await getTiers(guild.id);
  if (role && !weighted.some((tier) => tier.roleId == role.id)) {
    throw new NotFoundError("Tier");
  }

  let roleId = role ? role.id : "wifi";

  const assignedRole = await assignTier(roleId, member.id, interaction.member.id, guild);
  await interaction.reply(
    `Se le ha asignado **${assignedRole.name}** a **${member.displayName}**.`
  );
};

module.exports = { setTier };
