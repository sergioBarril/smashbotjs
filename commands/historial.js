const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  MessageEmbed,
  GuildMember,
  Role,
  DiscordAPIError,
  MessageActionRow,
  MessageButton,
} = require("discord.js");
const { getHistory } = require("../api/gameSet");

const smashCharacters = require("../params/smashCharacters.json");

const data = new SlashCommandBuilder()
  .setName("historial")
  .setDescription("Visualiza tu historial de sets")
  .addUserOption((option) =>
    option
      .setName("player")
      .setDescription("El player de quien mostrar los results. Por defecto, eres tú")
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("page")
      .setDescription("Página del historial a mostrar: 10 resultados por página")
      .setMinValue(1)
      .setRequired(false)
  )
  .addBooleanOption((option) =>
    option
      .setName("friendlies")
      .setDescription(
        "Cuenta también los sets en arenas de friendlies. Por defecto está desactivado."
      )
      .setRequired(false)
  );

function makeEmbed(memberId, names, setCount, groupedSets, page, isRanked) {
  const losses = setCount.sets - setCount.wins;
  const winrate = setCount.sets > 0 ? Math.round((setCount.wins * 100) / setCount.sets) : "?";

  const rankedText = isRanked ? "Ranked " : "";

  const descriptionText = `**${rankedText}Sets:** ${setCount.sets}\n**Set Count:** ${setCount.wins}-${losses} (${winrate}%)`;

  const objects = [];
  for (const [date, sets] of Object.entries(groupedSets)) {
    const setValue = sets.map((s) => {
      const isWin = Boolean(s.win);

      // Member is always player 1
      let [p1Score, p2Score] = s.scores;
      if (!p1Score || p1Score.playerDiscordId != memberId) {
        const aux = p1Score;
        p1Score = p2Score;
        p2Score = aux;
      }

      const p1Chars = p1Score.characters.slice(0, 1);
      let p2Chars = [];
      if (p2Score) p2Chars = p2Score.characters.slice(0, 1);

      const p1CharEmojis = p1Chars.map((c) => smashCharacters[c].emoji).join("");
      const p2CharEmojis = p2Chars.map((c) => smashCharacters[c].emoji).join("");

      const p2DisplayName = p2Score ? names[p2Score.playerDiscordId] : "????";
      const p2Wins = p2Score ? p2Score.wins : "?";

      const circle = isWin ? "🟢" : "🔴";

      return `${circle} ${p1CharEmojis} **${names[memberId]}** ${p1Score.wins} - ${p2Wins}  **${p2DisplayName}** ${p2CharEmojis}`;
    });

    objects.push({ name: `**${date}**`, value: setValue.join("\n"), inline: true });
  }

  if (objects.length == 0)
    objects.push({
      name: `**No ${rankedText}sets**`,
      value: `_No hay ${rankedText}sets disponibles_`,
      inline: true,
    });

  const maxPages = Math.ceil(setCount.sets / 10);

  const embed = new MessageEmbed()
    .setTitle(`__${names[memberId]}__`)
    .setDescription(descriptionText)
    .addFields(...objects)
    .setThumbnail(names["AVATAR"])
    .setFooter({ text: `Página ${page}/${maxPages}` })
    .setTimestamp();

  return embed;
}

async function getDisplayNames(guild, playerId, groupedSets) {
  const displayNames = {};

  let displayName;
  let image = null;
  try {
    const player = await guild.members.fetch(playerId);
    displayName = player.displayName;
    image = player.displayAvatarURL();
  } catch (e) {
    if (e instanceof DiscordAPIError) {
      displayName = "??????";
    } else throw e;
  }

  displayNames["AVATAR"] = image;

  displayNames[playerId] = displayName;

  for (let sets of Object.values(groupedSets)) {
    for (let set of sets) {
      const opponentScore = set.scores.find((sc) => sc.playerDiscordId != playerId);
      if (!opponentScore) continue;

      const opponentDiscordId = opponentScore.playerDiscordId;

      if (opponentDiscordId in displayNames) continue;

      let displayName = "";

      try {
        const opponent = await guild.members.fetch(opponentDiscordId);
        displayName = opponent.displayName;
      } catch (e) {
        if (e instanceof DiscordAPIError) {
          displayName = "??????";
        } else throw e;
      }
      displayNames[opponentDiscordId] = displayName;
    }
  }

  return displayNames;
}

function getHistoryButtons(page, setCount, memberId, isShare, isRanked) {
  page = Number(page);
  const isFirstPage = page <= 1;

  const prevLabel = isFirstPage ? " " : `Página ${page - 1}`;
  const publicId = isShare ? "public" : "private";
  const rankedId = isRanked ? "ranked" : "all";

  const prevButton = new MessageButton()
    .setCustomId(`historial-prev-${rankedId}-${publicId}-${memberId}-${page - 1}`)
    .setLabel(prevLabel)
    .setStyle(isFirstPage ? "SECONDARY" : "PRIMARY")
    .setDisabled(isFirstPage)
    .setEmoji("⬅️");

  const shareButton = new MessageButton()
    .setCustomId(`historial-share-${rankedId}-${publicId}-${memberId}-${page}`)
    .setLabel("Compartir")
    .setStyle("SECONDARY")
    .setDisabled(isShare)
    .setEmoji("📤");

  const isLastPage = page * 10 >= setCount;

  const nextLabel = isLastPage ? " " : `Página ${page + 1}`;
  const nextButton = new MessageButton()
    .setCustomId(`historial-next-${rankedId}-${publicId}-${memberId}-${page + 1}`)
    .setLabel(nextLabel)
    .setStyle(isLastPage ? "SECONDARY" : "PRIMARY")
    .setDisabled(isLastPage)
    .setEmoji("➡️");

  const historyButtons = new MessageActionRow().addComponents(prevButton, shareButton, nextButton);
  return historyButtons;
}

module.exports = {
  data: data,
  async execute(interaction) {
    const guild = interaction.guild;

    let member;
    let memberId;
    let page;
    let isShare = false;
    let isPublic = false;
    let isRanked = true;

    if (interaction.isButton()) {
      const customId = interaction.customId.split("-");
      page = Number(customId.at(-1));
      memberId = customId.at(-2);
      isPublic = customId.at(-3) === "public";
      isRanked = customId.at(-4) === "ranked";
      isShare = customId.at(-5) === "share";
      await interaction.deferUpdate();
    } else {
      member = interaction.options.getMember("player") || interaction.member;
      memberId = member.id;
      page = interaction.options.getInteger("page") || 1;
      isRanked = !interaction.options.getBoolean("friendlies");
      await interaction.deferReply({ ephemeral: true });
    }

    const {
      page: actualPage,
      setCount,
      sets,
    } = await getHistory(memberId, guild.id, page, isRanked);
    const displayNames = await getDisplayNames(guild, memberId, sets);

    const embed = makeEmbed(memberId, displayNames, setCount, sets, actualPage, isRanked);

    const historyButtons = getHistoryButtons(
      actualPage,
      setCount.sets,
      memberId,
      isShare,
      isRanked
    );

    if (isShare) {
      await interaction.deleteReply();
      let content = `_${interaction.member} ha compartido el historial de **${displayNames[memberId]}**:_`;
      if (interaction.member.id === memberId)
        content = `_${interaction.member} ha compartido **su historial**:_`;
      await interaction.channel.send({ content, embeds: [embed], components: [historyButtons] });
    } else if (isPublic) {
      await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
        components: [historyButtons],
      });
    } else {
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true,
        components: [historyButtons],
      });
    }
  },
};
