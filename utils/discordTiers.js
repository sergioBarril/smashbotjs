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
 */
async function assignTier(tierRoleId, playerId, panelistId, guild) {
  let tierRole;
  const isWifi = tierRoleId == "wifi";

  const member = await guild.members.fetch(playerId);

  const oldTier = await ratingAPI.getPlayerTier(playerId, guild.id, true);
  const guildInfo = await getGuild(guild.id);

  const cableRole = await guild.roles.fetch(guildInfo.cableRoleId);
  const noCableRole = await guild.roles.fetch(guildInfo.noCableRoleId);

  // Remove old roles
  if (oldTier) {
    const oldRole = await guild.roles.fetch(oldTier.roleId);
    const oldRankedRole = await guild.roles.fetch(oldTier.rankedRoleId);
    await member.roles.remove(oldRole);
    await member.roles.remove(oldRankedRole);
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
    await ratingAPI.setPlayerTier(playerId, guild.id, tierRoleId);
    tierRole = await guild.roles.fetch(tierRoleId);

    const tierInfo = await tierAPI.getTier(guild.id, tierRoleId);
    const rankedRole = await guild.roles.fetch(tierInfo.rankedRoleId);

    await member.roles.add(rankedRole);
    await member.roles.add(cableRole);
    await member.roles.remove(noCableRole);
  }

  await member.roles.add(tierRole);

  // Send message in #panelists
  const panelistChannel = await guild.channels.fetch(guildInfo.panelistChannelId);
  const panelistMember = await guild.members.fetch(panelistId);
  await panelistChannel.send(
    `**${panelistMember.displayName}** le ha asignado la tier **${tierRole.name}** a **${member.displayName}**`
  );

  winston.info(
    `**${panelistMember.displayName}** le ha asignado la tier **${tierRole.name}** a **${member.displayName}**`
  );

  return tierRole;
}

module.exports = {
  assignTier,
};
