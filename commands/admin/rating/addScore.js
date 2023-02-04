const winston = require("winston");
const ratingAPI = require("../../../api/rating");

const addScore = async (interaction) => {
  const guild = interaction.guild;
  const member = interaction.options.getMember("player");
  const scoreToAdd = interaction.options.getInteger("score");

  const oldRating = await ratingAPI.getRating(member.id, guild.id);
  const oldScore = oldRating.score ?? 0;

  const { newScore } = await ratingAPI.setScore(member.id, guild.id, oldScore + scoreToAdd);

  let scoreDiffText = `(${scoreToAdd >= 0 ? "+" : ""}${scoreToAdd})`;

  winston.info(
    `[${interaction.user.username}] La puntuación de ${member.displayName} ha pasado a ${newScore} ${scoreDiffText}`
  );

  await interaction.reply(
    `La puntuación de **${member.displayName}** ha pasado a **${newScore}** ${scoreDiffText}`
  );
};

module.exports = { addScore };
