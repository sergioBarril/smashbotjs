const winston = require("winston");
const setAPI = require("../../../api/gameSet");
const { setEndButtons } = require("../../../utils/discordGameset");

const cancelSet = async (interaction) => {
  const channel = interaction.channel;

  await setAPI.cancelSet(channel.id);

  winston.info(`[Admin] Set cancelado por ${interaction.user.username}`);
  await interaction.reply({
    content:
      `El set ha sido **cancelado**. ¿Qué set? Yo no he visto ningún set... ` +
      `Si queréis hacer otro dadle al botón. Si no, cerrad la arena cuando queráis.`,
    components: setEndButtons(),
  });
};

module.exports = { cancelSet };
