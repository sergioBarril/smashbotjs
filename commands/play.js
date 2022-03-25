const { SlashCommandBuilder } = require("@discordjs/builders");

const lobbyAPI = require("../api/lobby");
const setAPI = require("../api/gameSet");

const smashCharacters = require("../params/smashCharacters.json");
const { pickCharacter } = require("../utils/discordGameset");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NOT_CHARACTER: "¡Este rol no corresponde a ningún personaje!",
    WRONG_CHANNEL: "¡No estás en el canal que toca! Vuelve a la arena y escribe el comando ahí.",
    CANT_PICK:
      "¡No te toca escoger personaje! O ya lo tienes, o tienes que esperar a que tu rival lo seleccione primero.",
  };
  const { name } = exception;

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Selecciona el personaje con el que jugarás ahora.")
  .addRoleOption((option) =>
    option
      .setName("character")
      .setDescription("Rol del personaje que quieres jugar.")
      .setRequired(true)
  );

const execute = async (interaction) => {
  try {
    const role = interaction.options.getRole("character");
    const charName = role.name;

    const charInfo = smashCharacters[charName];
    if (!charInfo) throw { name: "NOT_CHARACTER" };

    // Check is channel lobby
    const channelId = interaction.channel.id;

    const playerId = interaction.user.id;
    const validChannel = await lobbyAPI.isInCurrentLobby(playerId, channelId);
    if (!validChannel) throw { name: "WRONG_CHANNEL" };

    const gameNum = await setAPI.getGameNumber(channelId);

    const canPickNow = await setAPI.canPickCharacter(playerId, channelId, gameNum);
    if (!canPickNow) throw { name: "CANT_PICK" };
    await pickCharacter(interaction, playerId, gameNum, charName);
  } catch (e) {
    exceptionHandler(interaction, e);
  }
};

module.exports = {
  data,
  execute,
};
