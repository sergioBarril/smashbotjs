const winston = require("winston");
const guildAPI = require("../../../api/guild");
const { getLeaderboardEmbeds } = require("../../../utils/discordLeaderboard");

const channel = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;

  await guildAPI.removeLeaderboardMessages(guild.id);

  // Add Channel
  await guild.fetch();
  const category = await guild.channels.cache.find(
    (chan) => chan.name === "PERFIL" && chan.type === "GUILD_CATEGORY"
  );

  let leaderboardChannel;
  const name = "leaderboards";
  if (category) {
    leaderboardChannel = await guild.channels.create(name, { parent: category.id });
  } else leaderboardChannel = await guild.channels.create(name);

  // Add it to the DB
  const oldChannelId = await guildAPI.getLeaderboardChannel(guild.id);

  // Swap channels
  if (oldChannelId) {
    const oldChannel = await guild.channels.fetch(oldChannelId);
    await oldChannel.delete();
  }
  await guildAPI.setLeaderboardChannel(guild.id, leaderboardChannel.id);

  const embeds = await getLeaderboardEmbeds(guild);
  const leaderboardMessage = await leaderboardChannel.send({ embeds });
  await guildAPI.insertLeaderboardMessage(guild.id, leaderboardMessage.id);

  winston.info(`[${interaction.user.username}] Canal leaderboards creado`);

  await interaction.editReply({
    content: "¡Canal #leaderboards creado!",
    ephemeral: true,
  });
};

module.exports = { channel };
