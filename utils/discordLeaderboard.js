const { MessageEmbed, Guild, DiscordAPIError } = require("discord.js");
const tierAPI = require("../api/tier");
const ratingAPI = require("../api/rating");
const guildAPI = require("../api/guild");
const messageAPI = require("../api/message");
const { WifiLeaderboardError } = require("../errors/wifiLeaderboard");

const PLAYERS_PER_PAGE = 20;

/**
 *
 * @param {Guild} guild DiscordJS guild
 * @param {Role} role Role of the tier
 * @param {*} leaderboardInfo Object with the player + rating info of this tier
 */
async function leaderboardEmbedBuilder(guild, role, leaderboardInfo, page = 1) {
  let playerMessage = "";
  const maxPages = leaderboardInfo ? Math.ceil(leaderboardInfo.length / PLAYERS_PER_PAGE) : 0;

  if (maxPages === 0) page = 0;

  leaderboardInfo = leaderboardInfo?.slice((page - 1) * PLAYERS_PER_PAGE, PLAYERS_PER_PAGE * page);

  if (leaderboardInfo && page > 0) {
    const playersInfo = await Promise.all(
      leaderboardInfo.map(async (row, i) => {
        let player = guild.members.cache.get(row.displayName);
        if (!player) {
          try {
            player = await guild.members.fetch(row.playerDiscordId);
          } catch (e) {
            if (e instanceof DiscordAPIError) player = { displayName: "?????" };
            else throw e;
          }
        }
        const playerName = player.displayName;
        const rating = row.rating;
        const promotionText = rating.promotion
          ? ` **[${rating.promotionWins} - ${rating.promotionLosses}]**`
          : "";
        const playerIndex = (page - 1) * PLAYERS_PER_PAGE + i + 1;

        return `${playerIndex}. **${playerName}** _(${rating.score})_${promotionText}`;
      })
    );

    playerMessage = playersInfo.join("\n");
  }

  if (playerMessage.trim() == "") playerMessage = "No hay nadie en esta tier... ¡de momento!";

  return new MessageEmbed()
    .setColor(role.color)
    .setTitle(`__**${role.name}**__`)
    .addFields({ name: "Jugadores", value: playerMessage })
    .setFooter({ text: `Página ${page}/${maxPages}` })
    .setTimestamp();
}

/**
 * Get the array of embeds
 * @param {Guild} guild DiscordJS Guild
 */
async function getLeaderboardEmbeds(guild) {
  const { weighted } = await tierAPI.getTiers(guild.id);

  const leaderboardInfo = await ratingAPI.getRatingsSortedByTier(guild.id);

  const embeds = [];
  await guild.members.fetch();
  for (let tier of weighted) {
    const role = await guild.roles.fetch(tier.roleId);
    const embed = await leaderboardEmbedBuilder(guild, role, leaderboardInfo[tier.id]);
    embeds.push(embed);
  }
  return embeds;
}

async function getLeaderboardEmbed(guild, tierRoleId, playerDiscordId, page) {
  const { weighted } = await tierAPI.getTiers(guild.id);

  const playerFocus = tierRoleId === null;
  let tier = weighted.find((t) => t.roleId === tierRoleId);

  if (!tier) {
    tier = await ratingAPI.getPlayerTier(playerDiscordId, guild.id, true);
    if (!tier || !weighted.some((t) => t.roleId === tier.roleId)) throw new WifiLeaderboardError();
  }
  const leaderboardInfo = await ratingAPI.getRatingsByTier(tier.roleId);

  // GET PAGE
  const maxLength = leaderboardInfo.length;
  const maxPages = Math.ceil(maxLength / PLAYERS_PER_PAGE);
  if (playerFocus) {
    let playerIndex = leaderboardInfo.findIndex((li) => li.playerDiscordId === playerDiscordId);
    if (playerIndex === -1) page = 1;
    else {
      playerIndex += 1;
      page = Math.ceil(playerIndex / PLAYERS_PER_PAGE);
    }
  }

  if (page < 1) page = 1;
  if (page > maxPages) page = maxPages;

  const role = await guild.roles.fetch(tier.roleId);
  const embed = await leaderboardEmbedBuilder(guild, role, leaderboardInfo, page);

  return {
    embed,
    page,
    maxPages,
    roleId: tier.roleId,
  };
}

async function updateLeaderboard(guild) {
  const leaderboardChannelId = await guildAPI.getLeaderboardChannel(guild.id);
  const leaderboardChannel = await guild.channels.fetch(leaderboardChannelId);
  const embeds = await getLeaderboardEmbeds(guild);
  const { discordId: messageDiscordId } = await messageAPI.getLeaderboardMessage(guild.id);
  const message = await leaderboardChannel.messages.fetch(messageDiscordId);
  await message.edit({ embeds });
}

module.exports = {
  getLeaderboardEmbeds,
  getLeaderboardEmbed,
  updateLeaderboard,
};
