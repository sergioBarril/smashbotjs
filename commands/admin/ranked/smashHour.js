const winston = require("winston");
const guildAPI = require("../../../api/guild");

const setSmashHour = async (interaction) => {
  await interaction.deferReply();
  const isSmashHour = interaction.options.getBoolean("smashhour");
  const start = interaction.options.getInteger("start");
  const end = interaction.options.getInteger("end");

  await guildAPI.setSmashHour(interaction.guild.id, isSmashHour, start, end);

  const messageText = `Smash Hour: **${isSmashHour ? "ON" : "OFF"}**. Start: **${
    start ?? "--"
  }h**. End: **${end ?? "--"}h**.`;
  await interaction.editReply(messageText);

  winston.info(messageText);
};

module.exports = { setSmashHour };
