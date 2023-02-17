const { MessageEmbed, Guild } = require("discord.js");
const tierAPI = require("../api/tier");
const ratingAPI = require("../api/rating");
const guildAPI = require("../api/guild");
const messageAPI = require("../api/message");

/**
 *
 * @param {Guild} guild DiscordJS guild
 * @param {Role} role Role of the tier
 * @param {*} leaderboardInfo Object with the player + rating info of this tier
 */
function getLeaderboardEmbed(guild, role, leaderboardInfo) {
  let playerMessage = "No hay nadie en esta tier... ¡de momento!";

  if (leaderboardInfo) {
    const playersInfo = leaderboardInfo.map((row, i) => {
      const playerName = guild.members.cache.get(row.playerDiscordId).displayName;
      const rating = row.rating;
      const promotionText = rating.promotion
        ? ` **[${rating.promotionWins} - ${rating.promotionLosses}]**`
        : "";

      return `${i + 1}. **${playerName}** _(${rating.score})_${promotionText}`;
    });

    playerMessage = playersInfo.slice(0, 20).join("\n");
  }

  return new MessageEmbed()
    .setColor(role.color)
    .setTitle(`__**${role.name}**__`)
    .addFields({ name: "Jugadores", value: playerMessage })
    .setTimestamp();
}

/**
 * Get the array of embeds
 * @param {Guild} guild DiscordJS Guild
 */
async function getLeaderboardEmbeds(guild) {
  const { weighted } = await tierAPI.getTiers(guild.id);

  const leaderboardInfo = await ratingAPI.getRatingsByTier(guild.id);

  const embeds = [];
  await guild.members.fetch();
  for (let tier of weighted) {
    const role = await guild.roles.fetch(tier.roleId);
    const embed = getLeaderboardEmbed(guild, role, leaderboardInfo[tier.id]);
    embeds.push(embed);
  }
  return embeds;
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
  updateLeaderboard,
};
