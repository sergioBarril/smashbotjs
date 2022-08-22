const cron = require("node-cron");
const { getGuild, getCurrentList } = require("../api/guild");
const { NotFoundError } = require("../errors/notFound");

const GREEN_CHECK_EMOJI = ":white_check_mark:";
const HOURGLASS_EMOJI = ":hourglass:";

/**
 * @param {Guild} discordGuild DiscordJS Guild object
 * @param {Array} searching Array with the information on searching lobbies
 * @param {Array} confirmation Array with the information on lobbies on confirmation
 * @param {Array} playing Array with the information on lobbies actively playing
 */
async function formatListMessage(discordGuild, searching, confirmation, playing) {
  let response = "";

  // *************
  //  SEARCHING
  // *************
  let searchingTiers = searching.map(({ tier }) => tier);
  searchingTiers = Array.from(new Set(searchingTiers));

  const playerNamesDict = {};

  if (searchingTiers.length > 0) response += "**__BUSCANDO PARTIDA EN__:**\n";

  for (let tier of searchingTiers) {
    let tierName;

    if (tier.yuzu) tierName = "Yuzu";
    else {
      const tierRole = await discordGuild.roles.fetch(tier.roleId);
      tierName = tierRole.name;
    }

    const players = searching.filter(({ tier: t }) => t.id == tier.id).map(({ player }) => player);

    const playerNames = [];

    for (let player of players) {
      if (!(player.discordId in playerNamesDict)) {
        const discordPlayer = await discordGuild.members.fetch(player.discordId);
        playerNamesDict[discordPlayer.id] = discordPlayer.displayName
          .replace("*", "\\*")
          .replace("_", "\\_");
      }

      playerNames.push(playerNamesDict[player.discordId]);
    }

    response += `**${tierName}:** ${playerNames.join(", ")}\n`;
  }
  if (searchingTiers.length > 0) response += "\n\n";

  // *************
  //  CONFIRMATION
  // *************
  if (confirmation.length > 0) response += "**__ESPERANDO CONFIRMACIÓN__:**\n";
  for (let [p1, p2] of confirmation) {
    const discordP1 = await discordGuild.members.fetch(p1.player.discordId);
    const discordP2 = await discordGuild.members.fetch(p2.player.discordId);

    response += `${discordP1.displayName} (${p1.accepted ? GREEN_CHECK_EMOJI : HOURGLASS_EMOJI}) `;
    response += `y ${discordP2.displayName} (${p2.accepted ? GREEN_CHECK_EMOJI : HOURGLASS_EMOJI})`;
    response += "\n";
  }

  if (confirmation.length > 0) response += "\n\n";

  // *********
  //  PLAYING
  // *********
  if (playing.length > 0) response += "**__PARTIDAS EN CURSO__:**\n";
  for (let [p1, p2] of playing) {
    const discordP1 = await discordGuild.members.fetch(p1.discordId);
    const discordP2 = await discordGuild.members.fetch(p2.discordId);

    response += `${discordP1.displayName} vs ${discordP2.displayName} \n`;
  }

  if (response.trim() == "")
    return "No hay nadie buscando partida... ¡Pulsa un botón para empezar a buscar!";
  return response;
}

function searchListJob(client) {
  cron.schedule("*/5 * * * * *", async () => {
    try {
      const guild = await getGuild("885501308805738577");

      const listMessage = await guild.getListMessage();
      if (!listMessage) throw new NotFoundError("ListMessage");

      const discordGuild = await client.guilds.fetch(guild.discordId);
      const channel = await discordGuild.channels.fetch(guild.matchmakingChannelId);
      const message = await channel.messages.fetch(listMessage.discordId);

      let { searching, confirmation, playing } = await getCurrentList(guild.discordId);
      const response = await formatListMessage(discordGuild, searching, confirmation, playing);

      await message.fetch();
      if (message.content != response.trim()) {
        console.log(`Updated list message`);
        await message.edit(response);
      }
    } catch (e) {
      console.error(e);
    }
  });
}
module.exports = { searchListJob };
