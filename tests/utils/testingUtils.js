const { getCharacterByName, insertCharacter } = require("../../models/character");
const { getGuild, insertGuild } = require("../../models/guild");
const { getPlayer, insertPlayer } = require("../../models/player");
const { getRegionByName, insertRegion } = require("../../models/region");
const { getTierByRole, insertTier, getTierByChannel } = require("../../models/tier");

// Create

async function getOrCreatePlayer(playerDiscordId) {
  const player = await getPlayer(playerDiscordId, true);
  if (player) return player;
  return insertPlayer(playerDiscordId);
}

async function getOrCreateCharacter(characterName) {
  const character = await getCharacterByName(characterName);
  if (character) return character;
  return insertCharacter(characterName);
}

async function getOrCreateRegion(regionName) {
  const region = await getRegionByName(regionName);
  if (region) return region;
  return insertRegion(regionName);
}

async function getOrCreateGuild(guildDiscordId) {
  const guild = await getGuild(guildDiscordId, true);
  if (guild) return guild;
  return insertGuild(guildDiscordId);
}

async function getOrCreateTier(tierRoleId, tierChannelId, guildId, weight, threshold, yuzu) {
  if (!yuzu) {
    const tier = await getTierByRole(tierRoleId);
    if (tier) return tier;
  } else {
    const tier = await getTierByChannel(tierChannelId);
    if (tier) return tier;
  }
  return insertTier(tierRoleId, tierChannelId, guildId, weight, threshold, yuzu);
}

// Delete

async function deleteIfExistsPlayer(playerDiscordId) {
  const player = await getPlayer(playerDiscordId, true);
  if (player) await player.remove();
}

async function deleteIfExistsCharacter(characterName) {
  const character = await getCharacterByName(characterName);
  if (character) await character.remove();
}

async function deleteIfExistsRegion(regionName) {
  const region = await getRegionByName(regionName);
  if (region) await region.remove();
}

async function deleteIfExistsGuild(guildDiscordId) {
  const guild = await getGuild(guildDiscordId, true);
  if (guild) await guild.remove();
}

async function deleteIfExistsTier(tierDiscordId) {
  const tier = await getTierByRole(tierRoleId);
  if (tier) await tier.remove();
}

module.exports = {
  getOrCreatePlayer,
  getOrCreateCharacter,
  getOrCreateRegion,
  getOrCreateGuild,
  getOrCreateTier,
  deleteIfExistsPlayer,
  deleteIfExistsCharacter,
  deleteIfExistsRegion,
  deleteIfExistsGuild,
  deleteIfExistsTier,
};
