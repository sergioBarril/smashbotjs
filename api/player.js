const { CustomError } = require("../errors/customError");
const { NotFoundError } = require("../errors/notFound");
const { getPlayer, insertPlayer } = require("../models/player");
const { getGuild } = require("./guild");

/**
 * Check if the player is already registered
 * @param {string} playerDiscordId DiscordID of the player
 * @returns True if already registered, else false
 */
async function isRegistered(playerDiscordId) {
  const player = await getPlayer(playerDiscordId, true);

  return player != null;
}

/**
 * Register the player to the DB, and create their rating for the guild
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} guildDiscordId DiscordID of the guild
 */
async function register(playerDiscordId, guildDiscordId) {
  let player = await getPlayer(playerDiscordId, true);
  if (player) throw new CustomError("¡Ya estás registrado!");

  player = await insertPlayer(playerDiscordId);

  const guild = await getGuild(guildDiscordId);
  if (!guild) throw new NotFoundError("Guild");

  await player.insertRating(guild.id, null, null);
}

module.exports = { isRegistered, register };
