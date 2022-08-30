const setAPI = require("../api/gameSet");
const rolesAPI = require("../api/roles");
const lobbyAPI = require("../api/lobby");
const stageEmojis = require("../params/stageEmojis.json");
const smashCharacters = require("../params/smashCharacters.json");

const {
  MessageActionRow,
  MessageButton,
  Channel,
  GuildMember,
  Interaction,
} = require("discord.js");

const stageText = (nextPlayer, gameNum, bannedStagesLength, isBan) => {
  let text = `${nextPlayer}, te toca `;
  if (!isBan) {
    text += "**ESCOGER** un escenario.";
  } else {
    text += "banear ";
    if (gameNum == 1 && bannedStagesLength == 0) text += "un escenario.";
    else if ((gameNum == 1 && bannedStagesLength == 1) || (gameNum > 1 && bannedStagesLength === 0))
      text += "**DOS** escenarios.";
    else text += "otro escenario.";
  }

  text += ` Pulsa el botón del escenario que quieras __**${isBan ? "BANEAR" : "JUGAR"}**__.`;
  return text;
};

const stageButtons = (nextPlayerId, gameNum, stages, bannedStages, isBan) => {
  const rows = [];
  let i = 0;
  let row;
  const bannedStagesNames = bannedStages.map((stage) => stage.name);

  for (stage of stages) {
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
    if (bannedStagesNames.includes(stage.name)) {
      button.setStyle("SECONDARY");
      button.setDisabled(true);
    }

    row.addComponents(button);
    i++;
  }
  rows.push(row);

  return rows;
};

const stageFinalButtons = (stages, pickedStage) => {
  const rows = [];
  let i = 0;
  let row;

  for (stage of stages) {
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
 */
const setupCharacter = async (channel, player, gameNum) => {
  const { mains, seconds, pockets } = await rolesAPI.getCharacters(player.id);

  const characters = mains.concat(seconds).concat(pockets);

  const rows = [];
  let i = 0;
  let row;

  for (character of characters) {
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
  rows.push(row);

  const message = await channel.send({
    content: `${player}, selecciona el personaje que quieras jugar (con botones o usando \`/play\`).`,
    components: [...rows],
  });

  await setAPI.setCharacterSelectMessage(player.id, message.id);
};

const stageFinalText = (gameNum, stage) => {
  const emoji = stageEmojis[stage.name];
  return `El **Game ${gameNum}** se jugará en **${stage.name}** ${emoji}`;
};

const setupBans = async (interaction, gameNum) => {
  const stages = await setAPI.getStages(gameNum);

  const { striker } = await setAPI.getStriker(interaction.channel.id);

  const player = await interaction.guild.members.fetch(striker.discord_id);
  const banText = stageText(player, gameNum, 0, true);

  await interaction.channel.send({
    content: banText,
    components: stageButtons(player.id, gameNum, stages, [], true),
  });
};

const setupGameWinner = async (interaction, gameNum) => {
  const pc = await setAPI.getPlayersAndCharacters(interaction.user.id);

  const buttons = [];
  let playersTextArr = [];

  for ({ discord_id, character_name } of pc) {
    const player = await interaction.guild.members.fetch(discord_id);
    const emoji = smashCharacters[character_name].emoji;

    playersTextArr.push(`**${player.displayName}** ${emoji}`);

    buttons.push(
      new MessageButton()
        .setCustomId(`game-winner-${discord_id}-${gameNum}`)
        .setLabel(player.displayName)
        .setStyle("SECONDARY")
        .setEmoji(emoji)
    );
  }
  const playersText = new Intl.ListFormat("es").format(playersTextArr);
  await interaction.channel.send({
    content: `¡Que empiece el **Game ${gameNum}** entre ${playersText}! Pulsad el nombre del ganador cuando acabéis.`,
    components: [new MessageActionRow().addComponents(...buttons)],
  });
};

const setEndButtons = () => {
  const newSet = new MessageActionRow().addComponents(
    new MessageButton().setCustomId("new-set").setLabel("Revancha").setStyle("SECONDARY"),
    new MessageButton().setCustomId("close-lobby").setLabel("Cerrar arena").setStyle("DANGER")
  );

  return [newSet];
};

const setupSetEnd = async (interaction, playerId, isSurrender) => {
  const player = await interaction.guild.members.fetch(playerId);
  let emoji = "";
  let porAbandono = "";
  if (isSurrender) porAbandono = " por abandono";

  if (!isSurrender) {
    const pc = await setAPI.getPlayersAndCharacters(player.id);
    const characterName = await pc.find((p) => p.discord_id === player.id).character_name;
    emoji = ` ${smashCharacters[characterName].emoji}`;

    await setAPI.setWinner(player.id);
  }

  await setAPI.unlinkLobby(interaction.channel.id);

  const responseObj = {
    content: `¡**${player.displayName}**${emoji} ha ganado el set${porAbandono}! Puedes pedir la revancha, o cerrar la arena.`,
    components: setEndButtons(),
  };

  if (interaction.isButton()) return await interaction.channel.send(responseObj);
  return await interaction.reply(responseObj);
};

const setupNextGame = async (interaction) => {
  const score = await setAPI.getScore(interaction.channel.id);

  // Get winner. First check for surrender, else normal BO5
  const isSurrender = score.some((player) => player.surrender);

  let winner = isSurrender && score.find((player) => !player.surrender);
  if (!winner) winner = score.find((player) => player.wins >= 3);

  if (winner) return await setupSetEnd(interaction, winner.discord_id, isSurrender);
  else {
    const { newGameNum } = await setAPI.newGame(interaction.channel.id);

    if (newGameNum > 1) {
      await interaction.channel.send(`__**Game ${newGameNum}**__`);
      return await setupBans(interaction, newGameNum);
    }

    const members = [];
    const lp = await lobbyAPI.getPlayingPlayers(interaction.user.id);

    for ({ discord_id } of lp) {
      const member = await interaction.guild.members.fetch(discord_id);
      members.push(member);
    }
    return await setupFirstGame(interaction, members);
  }
};

const setupFirstGame = async (interaction, members) => {
  const channel = interaction.channel;
  await channel.send("__**Game 1**__");

  await Promise.all([
    members.map((member) => setupCharacter(channel, member, interaction.guild.id, 1)),
  ]);
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

  if (gameNum == 1) return await setupBans(interaction, gameNum);
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

  await interaction.reply({
    content: `Has seleccionado **${characterName}** ${emoji}. Espera a que tu rival acabe de pickear.`,
    ephemeral: true,
  });

  if (gameNum > 1)
    return await setupCharacter(interaction.channel, opponent, interaction.guild.id, gameNum);
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

  if (allPicked) {
    if (interaction.isButton()) await interaction.deferUpdate();
    else {
      const emoji = smashCharacters[characterName].emoji;
      await interaction.reply({
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
};
