const db = require("../db");
const lobbyDB = require("../db/lobby");
const gameSetDB = require("../db/gameSet");
const gameDB = require("../db/game");
const gamePlayerDB = require("../db/gamePlayer");
const stageDB = require("../db/stage");
const { getLobbyPlayers } = require("../db/lobbyPlayer");
const playerDB = require("../db/player");
const characterDB = require("../db/character");

const newSet = async (lobbyChannelId) => {
  // Starts a set and the first game.
  const lobby = await lobbyDB.getByTextChannel(lobbyChannelId);

  if (!lobby) throw { name: "NO_LOBBY" };

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    // CHECK IF CURRENT SET EXISTS
    const oldGameSet = await gameSetDB.getByLobby(lobby.id, client);
    if (oldGameSet) throw { name: "EXISTING_GAMESET" };

    // NEW SET
    await gameSetDB.create(lobby.guild_id, lobby.id, 3, client);
    const gameSet = await gameSetDB.getByLobby(lobby.id, client);

    // GAME
    await gameDB.create(gameSet.id, 1, client);
    const game = await gameDB.getByNum(gameSet.id, 1, client);

    // GAME PLAYERS
    const lobbyPlayers = await getLobbyPlayers(lobby.id, client);
    for (lp of lobbyPlayers) await gamePlayerDB.create(game.id, lp.player_id, client);

    const strikePlayer = lobbyPlayers[Math.floor(Math.random() * lobbyPlayers.length)];
    await gamePlayerDB.setBanTurn(game.id, strikePlayer.player_id, true, client);
    await client.query("COMMIT");
    return { players: lobbyPlayers };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const setCharMessage = async (playerDiscordId, messageId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getCurrent(gameset.id);

  await gamePlayerDB.setCharMessage(game.id, player.id, messageId);
};

const pickCharacter = async (playerDiscordId, charName) => {
  const player = await playerDB.get(playerDiscordId, true);
  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getCurrent(gameset.id);
  const character = await characterDB.getByName(charName);

  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    await gamePlayerDB.setCharacter(game.id, player.id, character.id, client);
    const allPicked = await gameDB.haveAllPicked(game.id, client);
    const gamePlayer = await gamePlayerDB.get(game.id, player.id, client);
    await client.query("COMMIT");

    return { allPicked, gameNum: game.num, charMessage: gamePlayer.char_message };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const popCharacterMessages = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getCurrent(gameset.id);

  const charMessages = await gamePlayerDB.getCharMessages(game.id);
  await gamePlayerDB.setNullCharMessages(game.id);

  return { charMessages };
};

const getPlayersAndCharacters = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getCurrent(gameset.id);

  const pc = await gamePlayerDB.getPlayersAndCharacters(game.id);
  return pc;
};

module.exports = {
  newSet,
  getPlayersAndCharacters,
  pickCharacter,
  setCharMessage,
  popCharacterMessages,
};
