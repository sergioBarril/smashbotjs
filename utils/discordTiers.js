const { Guild } = require("discord.js");
const ratingAPI = require("../api/rating");
const tierAPI = require("../api/tier");
const { getWifiTier, getGuild } = require("../api/guild");
const winston = require("winston");

/**
 * Remove old roles, add new tier roles and send a message to #panelists
 *
 * @param {string} tierRoleId DiscordID of the tier to add
 * @param {string} playerId DiscordID of the player receiving the tier
 * @param {string} panelistId DiscordID of the panelist
 * @param {Guild} guild DiscordJS guild object
 * @param {Tier} oldTier BD Tier object
 * @param {boolean} isNewPromotion True if has just entered promotion
 * @param {boolean} isTierChange True if there's a tier change
 */
async function assignTier(
  tierRoleId,
  playerId,
  panelistId,
  guild,
  oldTier = null,
  isNewPromotion = false,
  isTierChange = true
) {
  let tierRole;
  const isWifi = tierRoleId == "wifi";

  const member = await guild.members.fetch(playerId);

  oldTier = oldTier ?? (await ratingAPI.getPlayerTier(playerId, guild.id, true));
  const guildInfo = await getGuild(guild.id);

  const cableRole = await guild.roles.fetch(guildInfo.cableRoleId);
  const noCableRole = await guild.roles.fetch(guildInfo.noCableRoleId);

  // Remove old roles
  if (oldTier) {
    let oldRole = await guild.roles.fetch(oldTier.roleId);
    const oldRankedRole = await guild.roles.fetch(oldTier.rankedRoleId);

    const previousTierInfo = await tierAPI.getPreviousTier(guild.id, oldTier.roleId);
    const previousRankedRole = previousTierInfo
      ? await guild.roles.fetch(previousTierInfo.rankedRoleId)
      : null;

    const nextTierInfo = await tierAPI.getNextTier(guild.id, oldTier.roleId);
    const nextRankedRole = nextTierInfo ? await guild.roles.fetch(nextTierInfo.rankedRoleId) : null;

    await member.roles.remove(oldRole);
    await member.roles.remove(oldRankedRole);
    if (previousRankedRole) await member.roles.remove(previousRankedRole);
    if (nextRankedRole) await member.roles.remove(nextRankedRole);
  }

  // Add wifi roles
  if (isWifi) {
    const wifiTier = await getWifiTier(guild.id);
    tierRole = await guild.roles.fetch(wifiTier.roleId);
    // Cable roles
    await ratingAPI.setPlayerTier(playerId, guild.id, null);
    await member.roles.remove(cableRole);
    await member.roles.add(noCableRole);
  } else {
    // Cable roles

    if (isTierChange) {
      await ratingAPI.setPlayerTier(playerId, guild.id, tierRoleId, Boolean(panelistId));
    }
    tierRole = await guild.roles.fetch(tierRoleId);

    const tierInfo = await tierAPI.getTier(guild.id, tierRoleId);
    const rankedRole = await guild.roles.fetch(tierInfo.rankedRoleId);

    const previousTierInfo = await tierAPI.getPreviousTier(guild.id, tierRoleId);
    const previousRankedRole = previousTierInfo
      ? await guild.roles.fetch(previousTierInfo.rankedRoleId)
      : null;

    const nextTierInfo = await tierAPI.getNextTier(guild.id, tierRoleId);
    const nextRankedRole = nextTierInfo ? await guild.roles.fetch(nextTierInfo.rankedRoleId) : null;

    if (!isNewPromotion) await member.roles.add(rankedRole);
    if (previousRankedRole && !isNewPromotion) await member.roles.add(previousRankedRole);
    if (nextRankedRole) await member.roles.add(nextRankedRole);

    await member.roles.add(cableRole);
    await member.roles.remove(noCableRole);
  }

  await member.roles.add(tierRole);

  // Send message in #panelists
  const panelistChannel = await guild.channels.fetch(guildInfo.panelistChannelId);
  let panelistText = "Text";

  if (panelistId) {
    const panelistMember = await guild.members.fetch(panelistId);
    panelistText = `**${panelistMember.displayName}** le ha asignado la tier **${tierRole.name}** a **${member.displayName}**`;
  } else {
    if (isNewPromotion)
      panelistText = `**${member.displayName}** acaba de entrar a Promoción para salir de ${tierRole.name}`;
    else panelistText = `**${member.displayName}** está a partir de ahora en **${tierRole.name}**`;
  }

  await panelistChannel.send(panelistText);
  winston.info(panelistText);

  return tierRole;
}

module.exports = {
  assignTier,
};
