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
const { getLeaderboardEmbed } = require("../utils/discordLeaderboard");

const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Visualiza la ladder de puntos")
  .addRoleOption((option) =>
    option
      .setName("tier")
      .setDescription("Tier de la que mostrar la leaderboard")
      .setRequired(false)
  )
  .addUserOption((option) =>
    option
      .setName("player")
      .setDescription("El player de quien mostrar la posición en ladder. Por defecto, eres tú")
      .setRequired(false)
  );

// function makeEmbed(memberId, names, setCount, sets, page, isRanked) {
//   const losses = setCount.sets - setCount.wins;
//   const winrate = setCount.sets > 0 ? Math.round((setCount.wins * 100) / setCount.sets) : "?";

//   const rankedText = isRanked ? "Ranked " : "";

//   const descriptionText = `**${rankedText}Sets:** ${setCount.sets}\n**Set Count:** ${setCount.wins}-${losses} (${winrate}%)`;

//   let setValue = sets.map((s) => {
//     const isWin = Boolean(s.win);

//     // Member is always player 1
//     let [p1Score, p2Score] = s.scores;
//     if (!p1Score || p1Score.playerDiscordId != memberId) {
//       const aux = p1Score;
//       p1Score = p2Score;
//       p2Score = aux;
//     }

//     const p1Chars = p1Score.characters.slice(0, 1);
//     let p2Chars = [];
//     if (p2Score) p2Chars = p2Score.characters.slice(0, 1);

//     const p1CharEmojis = p1Chars.map((c) => smashCharacters[c].emoji).join("");
//     const p2CharEmojis = p2Chars.map((c) => smashCharacters[c].emoji).join("");

//     const p2DisplayName = p2Score ? names[p2Score.playerDiscordId] : "????";
//     const p2Wins = p2Score ? p2Score.wins : "?";

//     const circle = isWin ? "🟢" : "🔴";

//     return `${circle} ${p1CharEmojis} **${names[memberId]}** ${p1Score.wins} - ${p2Wins}  **${p2DisplayName}** ${p2CharEmojis}`;
//   });

//   if (setValue.length == 0) setValue.push("_No hay sets disponibles_");

//   const maxPages = Math.ceil(setCount.sets / 10);

//   const embed = new MessageEmbed()
//     .setTitle(`__${names[memberId]}__`)
//     .setDescription(descriptionText)
//     .addField(`**${rankedText}Sets**`, setValue.join("\n"), true)
//     .setThumbnail(names["AVATAR"])
//     .setFooter({ text: `Página ${page}/${maxPages}` })
//     .setTimestamp();

//   return embed;
// }

// async function getDisplayNames(guild, playerId, sets) {
//   const displayNames = {};

//   let displayName;
//   let image = null;
//   try {
//     const player = await guild.members.fetch(playerId);
//     displayName = player.displayName;
//     image = player.displayAvatarURL();
//   } catch (e) {
//     if (e instanceof DiscordAPIError) {
//       displayName = "??????";
//     } else throw e;
//   }

//   displayNames["AVATAR"] = image;

//   displayNames[playerId] = displayName;

//   for (let set of sets) {
//     const opponentScore = set.scores.find((sc) => sc.playerDiscordId != playerId);
//     if (!opponentScore) continue;

//     const opponentDiscordId = opponentScore.playerDiscordId;

//     if (opponentDiscordId in displayNames) continue;

//     let displayName = "";

//     try {
//       const opponent = await guild.members.fetch(opponentDiscordId);
//       displayName = opponent.displayName;
//     } catch (e) {
//       if (e instanceof DiscordAPIError) {
//         displayName = "??????";
//       } else throw e;
//     }
//     displayNames[opponentDiscordId] = displayName;
//   }

//   return displayNames;
// }

// function getLeaderboardButtons(page, setCount, memberId, isShare) {
//   page = Number(page);
//   const isFirstPage = page <= 1;

//   const prevLabel = isFirstPage ? " " : `Página ${page - 1}`;
//   const publicId = isShare ? "public" : "private";
//   const rankedId = isRanked ? "ranked" : "all";

//   const prevButton = new MessageButton()
//     .setCustomId(`historial-prev-${rankedId}-${publicId}-${memberId}-${page - 1}`)
//     .setLabel(prevLabel)
//     .setStyle(isFirstPage ? "SECONDARY" : "PRIMARY")
//     .setDisabled(isFirstPage)
//     .setEmoji("⬅️");

//   const shareButton = new MessageButton()
//     .setCustomId(`historial-share-${rankedId}-${publicId}-${memberId}-${page}`)
//     .setLabel("Compartir")
//     .setStyle("SECONDARY")
//     .setDisabled(isShare)
//     .setEmoji("📤");

//   const isLastPage = page * 10 >= setCount;

//   const nextLabel = isLastPage ? " " : `Página ${page + 1}`;
//   const nextButton = new MessageButton()
//     .setCustomId(`historial-next-${rankedId}-${publicId}-${memberId}-${page + 1}`)
//     .setLabel(nextLabel)
//     .setStyle(isLastPage ? "SECONDARY" : "PRIMARY")
//     .setDisabled(isLastPage)
//     .setEmoji("➡️");

//   const historyButtons = new MessageActionRow().addComponents(prevButton, shareButton, nextButton);
//   return historyButtons;
// }

module.exports = {
  data: data,
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const role = interaction.options.getRole("tier");

    const embed = await getLeaderboardEmbed(guild, role.id);
    await interaction.editReply({ embeds: [embed] });
  },
};
