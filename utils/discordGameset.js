const setAPI = require("../api/gameSet");
const rolesAPI = require("../api/roles");
const lobbyAPI = require("../api/lobby");
const ratingAPI = require("../api/rating");
const stageEmojis = require("../params/stageEmojis.json");
const smashCharacters = require("../params/smashCharacters.json");

const {
  MessageActionRow,
  MessageButton,
  Channel,
  GuildMember,
  Interaction,
  Guild,
} = require("discord.js");
const { Stage } = require("../models/stage");
const { Tier } = require("../models/tier");
const { updateLeaderboard } = require("./discordLeaderboard");
const winston = require("winston");
const { assignTier } = require("./discordTiers");
const { getGuild } = require("../api/guild");

/**
 * Get the text that will be displayed after picking or banning
 * @param {GuildMember} nextPlayer GuildMember of the player that bans next
 * @param {int} gameNum Number of the game
 * @param {int} bannedStagesLength Number of stages banned
 * @param {boolean} isBan True if banning, false if picking
 * @returns {string} Text that will be displayed after picking or banning
 */
const stageText = (nextPlayer, gameNum, bannedStagesLength, isBan) => {
  let text = `${nextPlayer}, te toca `;
  if (!isBan) {
    text += "**ESCOGER** un escenario.";
  } else {
    text += "banear ";

    if ([2, 6, 7].includes(bannedStagesLength)) text += `**1** escenario.`;
    else if (bannedStagesLength < 3) text += `**${3 - bannedStagesLength}** escenarios.`;
    else if (bannedStagesLength < 7) text += `**${7 - bannedStagesLength}** escenarios.`;
  }

  text += ` Pulsa el botón del escenario que quieras __**${isBan ? "BANEAR" : "JUGAR"}**__.`;
  return text;
};

/**
 * Get stage buttons
 * @param {string} nextPlayerId DiscordID of the next player to ban
 * @param {int} gameNum Number of the game
 * @param {Array<Stage>} stages Stages to choose from
 * @param {Array<Stage>} bannedStages Stages that are banned
 * @param {boolean} isBan True if banning, false if picking
 * @returns
 */
const stageButtons = (nextPlayerId, gameNum, stages, bannedStages, isBan) => {
  const rows = [];
  let i = 0;
  let row;

  for (let stage of stages) {
    const emoji = stageEmojis[stage.name];
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }

    let customId = `${isBan ? "ban" : "pick"}-stage-${nextPlayerId}-${gameNum}-${stage.id}`;
    const button = new MessageButton()
      .setCustomId(customId)
      .setLabel(stage.name)
      .setStyle("PRIMARY")
      .setEmoji(emoji);

    if (bannedStages.some((st) => st.name === stage.name)) {
      button.setStyle("SECONDARY");
      button.setDisabled(true);
    }

    row.addComponents(button);
    i++;
  }
  rows.push(row);

  return rows;
};

const bonusSetText = async (playerDiscordId1, playerDiscordId2, guildDiscordId, members) => {
  const bonus = await ratingAPI.isBonusMatch(playerDiscordId1, playerDiscordId2, guildDiscordId);
  let bonusText = "";

  if (bonus.isBonus) {
    bonusText = " Esta ranked es **Bonus**: no contará como victoria/derrota de promoción";
    if (bonus.reason === "BOTH_PROMO") {
      bonusText += " ya que ambos estáis en promo.";
    } else {
      const promoPlayerIndex = members.findIndex((m) => m.id == bonus.promoPlayer);
      const promoName = `**${members[promoPlayerIndex].displayName}**`;
      const normalName = `**${members[1 - promoPlayerIndex].displayName}**`;

      bonusText += ` para ${promoName} ya que`;

      if (bonus.reason === "TIER_DIFF") {
        bonusText += ` ${normalName} no es de una tier superior.`;
      } else if (bonus.reason === "ALREADY_BEAT") {
        bonusText += ` ha ganado a ${normalName} durante su promo.`;
      }
    }
  }

  return bonusText;
};

/**
 * Final state for stage buttons
 * @param {Stage[]} stages All stages
 * @param {Stage} pickedStage Stage
 * @returns
 */
const stageFinalButtons = (stages, pickedStage) => {
  const rows = [];
  let i = 0;
  let row;

  for (let stage of stages) {
    const emoji = stageEmojis[stage.name];
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }

    const button = new MessageButton()
      .setCustomId(`ban-stage-final-${stage.id}`)
      .setLabel(stage.name)
      .setStyle("SECONDARY")
      .setEmoji(emoji)
      .setDisabled(true);
    if (stage.name === pickedStage.name) {
      button.setStyle("SUCCESS");
    }

    row.addComponents(button);
    i++;
  }
  rows.push(row);

  return rows;
};

/**
 * Sets up the message asking for the character
 * @param {Channel} channel DiscordJs Channel object
 * @param {GuildMember} player DiscordJS GuildMember
 * @param {int} gameNum Game Number
 * @param {Guild} discordGuild DiscordJS Guild object
 */
const setupCharacter = async (channel, player, gameNum, discordGuild) => {
  const { mains, seconds, pockets } = await rolesAPI.getCharacters(player.id);

  const characters = mains.concat(seconds).concat(pockets);

  const rows = [];
  let i = 0;
  let row;

  for (let character of characters) {
    const emoji = smashCharacters[character.name].emoji;
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }
    row.addComponents(
      new MessageButton()
        .setCustomId(`play-character-${player.id}-${gameNum}-${i}`)
        .setLabel(character.name)
        .setStyle(character.type === "MAIN" ? "PRIMARY" : "SECONDARY")
        .setEmoji(emoji)
    );
    i++;
  }
  if (row) rows.push(row);
  const components = [...rows];

  const playCommand = await getPlayCommand(discordGuild);

  const message = await channel.send({
    content: `${player}, selecciona el personaje que quieras jugar (con botones o usando </play:${playCommand.id}>)`,
    components,
  });

  await setAPI.setCharacterSelectMessage(player.id, message.id);
};

/**
 * Returns this guild play command
 * @param {Guild} discordGuild
 */
const getPlayCommand = async (discordGuild) => {
  await discordGuild.commands.fetch();
  return discordGuild.commands.cache.find((command) => command.name === "play");
};

/**
 * Get the final text of the stage pick/ban process
 * @param {int} gameNum Number of the game
 * @param {Stage} stage Chosen stage
 * @returns
 */
const stageFinalText = (gameNum, stage) => {
  const emoji = stageEmojis[stage.name];
  return `El **Game ${gameNum}** se jugará en **${stage.name}** ${emoji}`;
};

/**
 * Sets up the message asking for stage bans
 * @param {Interaction} interaction DiscordJS interaction
 * @param {int} gameNum Number of the game
 */
const setupBans = async (interaction, gameNum) => {
  const stages = await setAPI.getStages(gameNum);

  const striker = await setAPI.getStriker(interaction.channel.id);

  const player = await interaction.guild.members.fetch(striker.discordId);
  const banText = stageText(player, gameNum, 0, true);

  await interaction.channel.send({
    content: banText,
    components: stageButtons(player.id, gameNum, stages, [], true),
  });
};

/**
 * Sets up the message asking for the winner of the game
 * @param {Interaction} interaction DiscordJS interaction
 * @param {int} gameNum Number of the game
 */
const setupGameWinner = async (interaction, gameNum) => {
  const pcs = await setAPI.getPlayersAndCharacters(interaction.user.id);

  const buttons = [];
  let playersTextArr = [];

  for (pc of pcs) {
    const player = await interaction.guild.members.fetch(pc.playerDiscordId);
    const emoji = smashCharacters[pc.characterName].emoji;

    playersTextArr.push(`**${player.displayName}** ${emoji}`);

    buttons.push(
      new MessageButton()
        .setCustomId(`game-winner-${pc.playerDiscordId}-${gameNum}`)
        .setLabel(player.displayName)
        .setStyle("SECONDARY")
        .setEmoji(emoji)
    );
  }

  const isRanked = await setAPI.isRankedSet(interaction.user.id);
  if (!isRanked && gameNum != 1)
    buttons.push(
      new MessageButton()
        .setCustomId(`character-set-menu-${gameNum}`)
        .setLabel("Cambiar personaje")
        .setStyle("SECONDARY")
        .setEmoji("♻️")
    );

  const playersText = new Intl.ListFormat("es").format(playersTextArr);
  await interaction.channel.send({
    content: `¡Que empiece el **Game ${gameNum}** entre ${playersText}! Pulsad el nombre del ganador cuando acabéis.`,
    components: [new MessageActionRow().addComponents(...buttons)],
  });
};

const getRankedButtons = (isRematchBonus) => {
  let buttonLabel = "Revancha";
  if (isRematchBonus) buttonLabel += " (bonus)";

  const newSet = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("new-set-ranked-5").setLabel(buttonLabel).setStyle("SECONDARY"),
    new MessageButton().setCustomId("close-lobby").setLabel("Cerrar arena").setStyle("DANGER")
  );

  return [newSet];
};

const getFriendliesButtons = () => {
  const newSet = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("new-set-friendlies-3")
      .setLabel("Set BO3")
      .setStyle("SECONDARY"),
    new MessageButton()
      .setCustomId("new-set-friendlies-5")
      .setLabel("Set BO5")
      .setStyle("SECONDARY"),
    new MessageButton().setCustomId("close-lobby").setLabel("Cerrar arena").setStyle("DANGER")
  );

  return [newSet];
};

const setEndButtons = (isRanked = false, isRematchBonus = false) => {
  return isRanked ? getRankedButtons(isRematchBonus) : getFriendliesButtons();
};

const rankedScoreText = async (member, oldRating, rating, discordGuild) => {
  // PROMOTIONS
  if (oldRating.promotion && rating.promotion) {
    const bonusScoreDiff = rating.promotionBonusScore - oldRating.promotionBonusScore;
    const bonusSign = bonusScoreDiff >= 0 ? "+" : "";
    const bonusDiffText = bonusScoreDiff == 0 ? "" : ` (${bonusSign}${bonusScoreDiff})`;
    return `La promoción de **${member.displayName}** va ${rating.promotionWins} - ${rating.promotionLosses}. Puntos bonus: ${rating.promotionBonusScore}${bonusDiffText}`;
  } else if (oldRating.promotion) {
    const promotionWins = oldRating.promotionWins;
    const promotionLosses = oldRating.promotionLosses;
    const newTierRole = await discordGuild.roles.fetch(rating.tier.roleId);

    if (oldRating.tier.weight > rating.tier.weight) {
      return `**${member.displayName}**, tu promoción ha acabado ${
        promotionWins + 1
      } - ${promotionLosses}. ¡Felicidades, pasas a ${newTierRole}!`;
    } else
      return (
        `**${member.displayName}**, tu promoción ha acabado ${promotionWins} - ${
          promotionLosses + 1
        }. Sigues en **${newTierRole.name}** con ` + `una puntuación de ${rating.score}.`
      );
  } else if (rating.promotion) {
    const nextTier = await rating.tier.getNextTier();
    const newTierRole = await discordGuild.roles.fetch(nextTier.roleId);
    return `**${member.displayName}** acaba de entrar en promoción para ${newTierRole}. ¡Buena suerte en tus próximos sets!`;
  }

  // SCORES
  const scoreDiff = rating.score - oldRating.score;
  const sign = scoreDiff >= 0 ? "+" : "";
  let response = `La puntuación de **${member.displayName}** pasa a ${rating.score} (${sign}${scoreDiff}).`;
  if (oldRating.tier.weight < rating.tier.weight) {
    const newTierRole = await discordGuild.roles.fetch(rating.tier.roleId);
    response += `Has caído a ${newTierRole}. ¡Dale duro y seguro que vuelves a subir!`;
  }
  return response;
};

const allRankedScoreText = async (
  winnerMember,
  winnerOldRating,
  winnerRating,
  loserMember,
  loserOldRating,
  loserRating,
  discordGuild
) => {
  const winnerText = await rankedScoreText(
    winnerMember,
    winnerOldRating,
    winnerRating,
    discordGuild
  );
  const loserText = await rankedScoreText(loserMember, loserOldRating, loserRating, discordGuild);
  return `\n${winnerText}\n${loserText}\n`;
};

const toggleTierX = async (playerDiscordId, discordGuild, isAdd) => {
  const member = await discordGuild.members.fetch(playerDiscordId);

  const guildInfo = await getGuild(discordGuild.id);
  const xRole = await discordGuild.roles.fetch(guildInfo.tierXRoleId);

  if (isAdd) await member.roles.add(xRole);
  else await member.roles.remove(xRole);
};

/**
 *
 * @param {string} playerDiscordId DiscordId of the player that needs their role changed
 * @param {Rating} oldRating Old rating
 * @param {Rating} newRating New rating
 * @param {Guild} discordGuild DiscordGuild object
 */
const changeTier = async (playerDiscordId, oldRating, newRating, discordGuild) => {
  const newTier = newRating.tier;
  const oldTier = oldRating.tier;

  const newTierNextTier = await newTier.getNextTier();

  if (!newTierNextTier) {
    const tierXThreshold = newTier.threshold + 200;
    if (oldRating.score < tierXThreshold && newRating.score >= tierXThreshold)
      await toggleTierX(playerDiscordId, discordGuild, true);
    else if (oldRating.score >= tierXThreshold && newRating.score < tierXThreshold) {
      await toggleTierX(playerDiscordId, discordGuild, false);
    }
  }

  if (oldTier.id === newTier.id && oldRating.promotion === newRating.promotion) return;
  const enterNewPromo = !oldRating.promotion && newRating.promotion;
  const isTierChange = oldTier.id !== newTier.id;

  await assignTier(
    newTier.roleId,
    playerDiscordId,
    null,
    discordGuild,
    oldTier,
    enterNewPromo,
    isTierChange
  );
};

/**
 *
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} winnerDiscordId DiscordID of the winner
 * @param {string} loserDiscordId DiscordID of the loser
 * @param {boolean} isSurrender True if won by surrender, false if won normally
 * @returns
 */
const setupSetEnd = async (interaction, winnerDiscordId, loserDiscordId, isSurrender) => {
  const winner = await interaction.guild.members.fetch(winnerDiscordId);
  const loser = await interaction.guild.members.fetch(loserDiscordId);
  let emoji = "";
  let porAbandono = "";
  if (isSurrender) porAbandono = " por abandono";

  if (!isSurrender) {
    const pcs = await setAPI.getPlayersAndCharacters(winner.id);
    const characterName = await pcs.find((p) => p.playerDiscordId === winner.id).characterName;
    emoji = ` ${smashCharacters[characterName].emoji}`;

    await setAPI.setWinner(winner.id);
  }

  const isRanked = await setAPI.isRankedSet(winnerDiscordId);
  let rankedText = " ";
  let isRematchBonus = false;

  if (isRanked) {
    const winnerRoles = winner.roles.cache;
    const loserRoles = loser.roles.cache;

    const { oldRating: winnerOldRating, rating: winnerRating } = await ratingAPI.updateScore(
      winnerDiscordId,
      interaction.guild.id,
      loserDiscordId,
      null,
      winnerRoles
    );

    const { oldRating: loserOldRating, rating: loserRating } = await ratingAPI.updateScore(
      loserDiscordId,
      interaction.guild.id,
      winnerDiscordId,
      winnerOldRating.score,
      loserRoles
    );

    rankedText = await allRankedScoreText(
      winner,
      winnerOldRating,
      winnerRating,
      loser,
      loserOldRating,
      loserRating,
      interaction.guild
    );

    await changeTier(winnerDiscordId, winnerOldRating, winnerRating, interaction.guild);
    await changeTier(loserDiscordId, loserOldRating, loserRating, interaction.guild);
    updateLeaderboard(interaction.guild);

    const rematchInfo = await ratingAPI.isBonusMatch(
      winnerDiscordId,
      loserDiscordId,
      interaction.guild.id
    );

    isRematchBonus = rematchInfo.isBonus;
  }

  await setAPI.unlinkLobby(interaction.channel.id);

  winston.info(`${winner.displayName} ha ganado el set${porAbandono}`);
  winston.info(rankedText);

  let rematchText = `Puedes pedir la revancha, o cerrar la arena.`;
  if (isRematchBonus)
    rematchText = `Pese a estar en promoción, la revancha será Bonus (las wins/losses darán puntos bonus en vez de avanzar la promoción).`;

  const responseObj = {
    content: `¡**${winner.displayName}**${emoji} ha ganado el set${porAbandono}!${rankedText}${rematchText}`,
    components: setEndButtons(isRanked, isRematchBonus),
  };

  if (interaction.isButton()) return await interaction.channel.send(responseObj);

  if (interaction.replied || interaction.deferred) return await interaction.editReply(responseObj);
  else return await interaction.reply(responseObj);
};

/**
 * Setup next game, or set end if set's over.
 * @param {Interaction} interaction DiscordJS interaction
 */
const setupNextGame = async (interaction) => {
  const score = await setAPI.getScore(interaction.channel.id);

  // Get winner. First check for surrender, else normal BO5 or BO3
  const isSurrender = score.some((player) => player.surrender);

  let winner = isSurrender && score.find((player) => !player.surrender);

  if (!winner) {
    const firstTo = await setAPI.getFirstTo(interaction.channel.id);
    winner = score.find((ps) => ps.wins >= firstTo);
  }

  if (winner) {
    const loser = score.find((sc) => sc.player.id !== winner.player.id);
    return await setupSetEnd(
      interaction,
      winner.player.discordId,
      loser.player.discordId,
      isSurrender
    );
  } else {
    const newGame = await setAPI.newGame(interaction.channel.id);
    await interaction.channel.send(`__**Game ${newGame.num}**__`);

    const players = await lobbyAPI.getPlayingPlayers(interaction.channel.id);
    const members = await Promise.all(
      players.map(async (p) => await interaction.guild.members.fetch(p.discordId))
    );

    winston.info(`Empieza el Game ${newGame.num} entre ${members.map((m) => m.displayName)}`);

    if (newGame.num == 1) {
      return await Promise.all([
        members.map((member) => setupCharacter(interaction.channel, member, 1, interaction.guild)),
      ]);
    }

    const lastWinner = await setAPI.getGameWinner(interaction.channel.id, newGame.num - 1);
    const player = members.find((m) => m.id == lastWinner.discordId);

    const isRanked = await setAPI.isRankedSet(player.id);
    if (isRanked)
      return await setupCharacter(interaction.channel, player, newGame.num, interaction.guild);
    else {
      await setAPI.pickLastGameCharacters(interaction.channel.id, newGame.num);
      return await setupGameWinner(interaction, newGame.num);
    }
  }
};

// **********************************
//    C H A R A C T E R    P I C K
// **********************************
/**
 * Things to do after everyone has picked their character.
 * This includes:
 * - Delete all character Select messages
 * - Send a new one
 * - Go to stage bans or play directly depending on game num
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} playerDiscordId DiscordID of one of the players
 * @param {int} gameNum Number of the game
 * @returns
 */
const allHavePicked = async (interaction, playerDiscordId, gameNum) => {
  // Delete all charpick messages
  const { charMessages } = await setAPI.popCharacterMessages(playerDiscordId);
  for (let charMessage of charMessages) {
    const message = await interaction.channel.messages.fetch(charMessage.discordId);
    await message.delete();
  }

  // Get players and emojis for the response
  const pcs = await setAPI.getPlayersAndCharacters(playerDiscordId);
  const playerEmojis = [];
  for (let pc of pcs) {
    const player = await interaction.guild.members.fetch(pc.playerDiscordId);
    const emoji = smashCharacters[pc.characterName].emoji;
    playerEmojis.push(`**${player.displayName}** ${emoji}`);
  }

  const playersText = new Intl.ListFormat("es").format(playerEmojis);
  await interaction.channel.send({
    content: `El **Game ${gameNum}** será entre ${playersText}.`,
  });

  const isRanked = await setAPI.isRankedSet(playerDiscordId);
  if (isRanked) return await setupBans(interaction, gameNum);
  else return await setupGameWinner(interaction, gameNum);
};

const disableAllButtons = (message) => {
  const disabledComponents = message.components.map((row) => {
    const newRow = new MessageActionRow();
    row.components.forEach((button) => {
      button.setDisabled(true);
      newRow.addComponents(button);
    });
    return newRow;
  });

  return disabledComponents;
};

/**
 * Things to do if not everyone has picked their character.
 * - Deactivate buttons
 * - Change the charMessage content
 * - Reply
 * - If not game 1, ask the opponent for their character too.
 * @param {Interaction} interaction DiscordJS Interaction
 * @param {int} gameNum Number of the game
 * @param {string} characterName Name of the character picked
 * @param {string} characterMessageId DiscordId of the character message
 * @param {GuildMember} opponent GuildMember of the opponent
 * @returns
 */
const pickingIsNotOver = async (
  interaction,
  gameNum,
  characterName,
  characterMessageId,
  opponent
) => {
  const message = await interaction.channel.messages.fetch(characterMessageId);
  const disabledComponents = disableAllButtons(message);

  const emoji = smashCharacters[characterName].emoji;
  const player = await interaction.guild.members.fetch(interaction.user.id);

  let editedMessage = `**${player.displayName}** ha escogido **${characterName}** ${emoji}`;
  if (gameNum === 1) editedMessage = `**${player.displayName}** ya ha escogido personaje.`;

  await message.edit({
    content: editedMessage,
    components: disabledComponents,
  });

  await interaction.editReply({
    content: `Has seleccionado **${characterName}** ${emoji}. Espera a que tu rival acabe de pickear.`,
    ephemeral: true,
  });

  if (gameNum > 1)
    return await setupCharacter(interaction.channel, opponent, gameNum, interaction.guild);
};

/**
 * Pick a character, and answer accordingly
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} playerDiscordId DiscordID of the player picking
 * @param {string} characterName Character name picked
 */
const pickCharacter = async (interaction, playerDiscordId, characterName) => {
  const { allPicked, charMessage, opponent, gameNum } = await setAPI.pickCharacter(
    playerDiscordId,
    characterName
  );

  winston.info(`${interaction.user.username} ha pickeado ${characterName}.`);

  if (allPicked) {
    if (!interaction.isButton()) {
      const emoji = smashCharacters[characterName].emoji;
      await interaction.editReply({
        content: `Has seleccionado **${characterName}** ${emoji}. Espera a que tu rival acabe de pickear.`,
        ephemeral: true,
      });
    }
    await allHavePicked(interaction, playerDiscordId, gameNum);
  } else {
    const opponentPlayer = await interaction.guild.members.fetch(opponent.discordId);
    await pickingIsNotOver(
      interaction,
      gameNum,
      characterName,
      charMessage.discordId,
      opponentPlayer
    );
  }
};

module.exports = {
  setupBans,
  setupGameWinner,
  setupNextGame,
  setupCharacter,
  stageButtons,
  stageText,
  stageFinalText,
  stageFinalButtons,
  setEndButtons,
  pickCharacter,
  bonusSetText,
};
