const winston = require("winston");
const ratingAPI = require("../../../api/rating");

const setScore = async (interaction) => {
  const guild = interaction.guild;
  const member = interaction.options.getMember("player");
  const newScore = interaction.options.getInteger("score");

  const { oldScore } = await ratingAPI.setScore(member.id, guild.id, newScore);

  const scoreDiff = newScore - oldScore;
  let scoreDiffText = `(${scoreDiff >= 0 ? "+" : ""}${scoreDiff})`;

  winston.info(
    `[${interaction.user.username}]: La puntuación de ${member.displayName} ha pasado a ${newScore} ${scoreDiffText}`
  );
  await interaction.reply(
    `La puntuación de **${member.displayName}** ha pasado a **${newScore}** ${scoreDiffText}`
  );
};

module.exports = { setScore };
