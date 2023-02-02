const cron = require("node-cron");
const winston = require("winston");
const { getGuild, getCurrentList } = require("../api/guild");
const { NotFoundError } = require("../errors/notFound");

const GREEN_CHECK_EMOJI = ":white_check_mark:";
const HOURGLASS_EMOJI = ":hourglass:";

/**
 * @param {Guild} discordGuild DiscordJS Guild object
 * @param {Array} ranked Array with the information on ranked searching lobbies
 * @param {Array} searching Array with the information on searching lobbies
 * @param {Array} confirmation Array with the information on lobbies on confirmation
 * @param {Array} playing Array with the information on lobbies actively playing
 */
async function formatListMessage(discordGuild, ranked, searching, confirmation, playing) {
  let response = "";

  // *************
  //  SEARCHING
  // *************
  let auxSearchingTiers = searching.map(({ tier }) => tier);
  const searchingTiers = [];
  auxSearchingTiers.forEach((tier) => {
    if (!searchingTiers.some((t) => t.id === tier.id)) searchingTiers.push(tier);
  });

  const playerNamesDict = {};

  if (searchingTiers.length > 0 || ranked.length > 0) response += "**__BUSCANDO PARTIDA EN__:**\n";
  if (ranked.length > 0) {
    const personas = "persona" + (ranked.length > 1 ? "s" : "");
    response += `Ranked: ${ranked.length} ${personas}\n`;
  }
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
    let p1DisplayName = "**Alguien**";
    let p2DisplayName = "**Alguien**";

    if (!p1.ranked) {
      const discordP1 = await discordGuild.members.fetch(p1.player.discordId);
      const discordP2 = await discordGuild.members.fetch(p2.player.discordId);
      p1DisplayName = discordP1.displayName;
      p2DisplayName = discordP2.displayName;
    }
    response += `${p1DisplayName} (${p1.accepted ? GREEN_CHECK_EMOJI : HOURGLASS_EMOJI}) `;
    response += `y ${p2DisplayName} (${p2.accepted ? GREEN_CHECK_EMOJI : HOURGLASS_EMOJI})`;
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

      let { ranked, searching, confirmation, playing } = await getCurrentList(guild.discordId);
      const response = await formatListMessage(
        discordGuild,
        ranked,
        searching,
        confirmation,
        playing
      );

      await message.fetch();
      if (message.content != response.trim()) {
        winston.debug(`Updated list message`);
        winston.debug(`Old message: ${message.content}`);
        winston.debug(`New message: ${response.trim()}`);
        await message.edit(response);
      }
    } catch (e) {
      console.error(e);
    }
  });
}
module.exports = { searchListJob };
