const { cancelLobby } = require("../utils/discordCancel");

const execute = async (interaction) => await cancelLobby(interaction);

module.exports = {
  data: { name: "close-lobby" },
  execute,
};
