const winston = require("winston");
const setAPI = require("../../../api/gameSet");
const { setupNextGame } = require("../../../utils/discordGameset");

const setWinner = async (interaction) => {
  const channel = interaction.channel;
  const member = interaction.options.getMember("player");

  await setAPI.surrenderOpponent(member.id, channel.id);
  winston.info(
    `[${interaction.user.username}]: ${member.username} ha ganado por surrender (forzado).`
  );
  await setupNextGame(interaction);
};

module.exports = { setWinner };
