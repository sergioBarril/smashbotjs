const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");

const smashCharacters = require("../params/smashCharacters.json");
const { getLeaderboardEmbed } = require("../utils/discordLeaderboard");

const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Visualiza la ladder de puntos")
  .addRoleOption((option) =>
    option
      .setName("tier")
      .setDescription("Tier de la que mostrar la leaderboard")
      .setRequired(false)
  );

function getLeaderboardButtons(page, maxPages, roleId, isShare) {
  page = Number(page);
  const isFirstPage = page <= 1;

  const prevLabel = isFirstPage ? " " : `Página ${page - 1}`;
  const publicId = isShare ? "public" : "private";

  const prevButton = new MessageButton()
    .setCustomId(`leaderboard-prev-${publicId}-${roleId}-${page - 1}`)
    .setLabel(prevLabel)
    .setStyle(isFirstPage ? "SECONDARY" : "PRIMARY")
    .setDisabled(isFirstPage)
    .setEmoji("⬅️");

  const shareButton = new MessageButton()
    .setCustomId(`leaderboard-share-${publicId}-${roleId}-${page}`)
    .setLabel("Compartir")
    .setStyle("SECONDARY")
    .setDisabled(isShare)
    .setEmoji("📤");

  const isLastPage = page >= maxPages;

  const nextLabel = isLastPage ? " " : `Página ${page + 1}`;
  const nextButton = new MessageButton()
    .setCustomId(`leaderboard-next-${publicId}-${roleId}-${page + 1}`)
    .setLabel(nextLabel)
    .setStyle(isLastPage ? "SECONDARY" : "PRIMARY")
    .setDisabled(isLastPage)
    .setEmoji("➡️");

  return new MessageActionRow().addComponents(prevButton, shareButton, nextButton);
}

module.exports = {
  data: data,
  async execute(interaction) {
    const guild = interaction.guild;

    let roleId = null;
    let page = null;
    let isPublic = false;
    let memberId = null;
    let isShare = false;

    if (interaction.isButton()) {
      const customId = interaction.customId.split("-");
      page = Number(customId.at(-1));
      roleId = customId.at(-2);
      isPublic = customId.at(-3) === "public";
      isShare = customId.at(-4) === "share";
    } else {
      let role = interaction.options.getRole("tier");

      if (role) roleId = role.id;
      memberId = interaction.member.id;
    }

    if (interaction.isButton()) await interaction.deferUpdate();
    else await interaction.deferReply({ ephemeral: true });

    const {
      embed,
      page: actualPage,
      maxPages,
      roleId: actualRoleId,
    } = await getLeaderboardEmbed(guild, roleId, memberId, page);

    const buttons = getLeaderboardButtons(actualPage, maxPages, actualRoleId, isShare || isPublic);
    if (isShare) {
      const actualRole = await guild.roles.fetch(actualRoleId);
      const content = `_Leaderboard de **${actualRole.name}** compartida por ${interaction.member}:_`;
      await interaction.followUp({ content, embeds: [embed], components: [buttons] });
    } else await interaction.editReply({ embeds: [embed], components: [buttons] });
  },
};
