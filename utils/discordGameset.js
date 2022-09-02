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
  Guild,
} = require("discord.js");
const { Stage } = require("../models/stage");

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
    if (gameNum == 1 && bannedStagesLength == 0) text += "un escenario.";
    else if ((gameNum == 1 && bannedStagesLength == 1) || (gameNum > 1 && bannedStagesLength === 0))
      text += "**DOS** escenarios.";
    else text += "otro escenario.";
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
  rows.push(row);

  const playCommand = await getPlayCommand(discordGuild);

  const message = await channel.send({
    content: `${player}, selecciona el personaje que quieras jugar (con botones o usando </play:${playCommand.id}>)`, //\`/play\`).`,
    components: [...rows],
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

/**
 *
 * @param {Interaction} interaction DiscordJS interaction
 * @param {string} playerDiscordId DiscordID of the winner
 * @param {boolean} isSurrender True if won by surrender, false if won normally
 * @returns
 */
const setupSetEnd = async (interaction, playerDiscordId, isSurrender) => {
  const player = await interaction.guild.members.fetch(playerDiscordId);
  let emoji = "";
  let porAbandono = "";
  if (isSurrender) porAbandono = " por abandono";

  if (!isSurrender) {
    const pcs = await setAPI.getPlayersAndCharacters(player.id);
    const characterName = await pcs.find((p) => p.playerDiscordId === player.id).characterName;
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

/**
 * Setup next game, or set end if set's over.
 * @param {Interaction} interaction DiscordJS interaction
 */
const setupNextGame = async (interaction) => {
  const score = await setAPI.getScore(interaction.channel.id);

  // Get winner. First check for surrender, else normal BO5
  const isSurrender = score.some((player) => player.surrender);

  let winner = isSurrender && score.find((player) => !player.surrender);
  if (!winner) winner = score.find((ps) => ps.wins >= 3);

  if (winner) return await setupSetEnd(interaction, winner.player.discordId, isSurrender);
  else {
    const newGame = await setAPI.newGame(interaction.channel.id);

    if (newGame.num > 1) {
      await interaction.channel.send(`__**Game ${newGame.num}**__`);
      return await setupBans(interaction, newGame.num);
    }

    const players = await lobbyAPI.getPlayingPlayers(interaction.channel.id);

    const members = await Promise.all(
      players.map(async (p) => await interaction.guild.members.fetch(p.discordId))
    );

    return await setupFirstGame(interaction, members);
  }
};

const setupFirstGame = async (interaction, members) => {
  const channel = interaction.channel;
  await channel.send("__**Game 1**__");

  await Promise.all([
    members.map((member) => setupCharacter(channel, member, 1, interaction.guild)),
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
