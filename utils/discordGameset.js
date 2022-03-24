const setAPI = require("../api/gameSet");
const rolesAPI = require("../api/roles");
const stageEmojis = require("../params/stageEmojis.json");
const smashCharacters = require("../params/smashCharacters.json");

const { MessageActionRow, MessageButton, Message } = require("discord.js");

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

const setupCharacter = async (channel, player, guildId, gameNum) => {
  const { mains, seconds, pockets } = await rolesAPI.getCharacters(player.id, guildId);

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

  await setAPI.setCharMessage(player.id, message.id);
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

const setupSetEnd = async (interaction, winnerId) => {
  const player = await interaction.guild.members.fetch(winnerId);
  const pc = await setAPI.getPlayersAndCharacters(player.id);
  const characterName = await pc.find((p) => p.discord_id === player.id).character_name;
  const emoji = smashCharacters[characterName].emoji;

  await setAPI.setWinner(player.id);
  await setAPI.unlinkLobby(interaction.channel.id);

  return await interaction.channel.send({
    content: `¡**${player.displayName}** ${emoji} ha ganado el set! Puedes pedir la revancha, o cerrar la arena.`,
    components: setEndButtons(),
  });
};

const setupNextGame = async (interaction) => {
  const score = await setAPI.getScore(interaction.channel.id);

  const winner = score.find((player) => player.wins >= 3);

  if (winner) return await setupSetEnd(interaction, winner.discord_id);
  else {
    const { newGameNum } = await setAPI.newGame(interaction.channel.id);
    await interaction.channel.send(`__**Game ${newGameNum}**__`);
    await setupBans(interaction, newGameNum);
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
};
