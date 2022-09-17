const ratingAPI = require("../../../api/rating");

const setPromotion = async (interaction) => {
  const guild = interaction.guild;
  const member = interaction.options.getMember("player");
  const isPromotion = interaction.options.getBoolean("promotion");
  const wins = interaction.options.getInteger("wins");
  const losses = interaction.options.getInteger("losses");

  await ratingAPI.setPromotion(member.id, guild.id, isPromotion, wins, losses);

  let messageText;
  if (isPromotion)
    messageText = `**${member.displayName}** está ahora en promoción. Wins: ${wins ?? 0}. Losses: ${
      losses ?? 0
    }`;
  else messageText = `**${member.displayName}** ya no está en promoción.`;

  await interaction.reply(messageText);
};

module.exports = { setPromotion };
