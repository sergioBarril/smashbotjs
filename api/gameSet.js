const db = require("../db");
const lobbyDB = require("../db/lobby");
const gameSetDB = require("../db/gameSet");
const gameDB = require("../db/game");
const gamePlayerDB = require("../db/gamePlayer");
const stageDB = require("../db/stage");
const stageBanDB = require("../db/stageBan");
const lobbyPlayerDB = require("../db/lobbyPlayer");
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
    const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    for (lp of lobbyPlayers) await gamePlayerDB.create(game.id, lp.player_id, client);
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

const pickStage = async (playerDiscordId, gameNum, stageName) => {
  // Get variables
  const player = await playerDB.get(playerDiscordId, true);

  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getByNum(gameset.id, gameNum);

  const stage = await stageDB.getByName(stageName);
  await gameDB.setStage(game.id, stage.id);
};

const banStage = async (playerDiscordId, gameNum, stageName) => {
  // Get variables
  const player = await playerDB.get(playerDiscordId, true);

  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getByNum(gameset.id, gameNum);

  const stage = await stageDB.getByName(stageName);
  const client = await db.getClient();

  // Find other player
  const lobby = await lobbyDB.getByGameSet(gameset.id);
  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  const otherPlayerInfo = lobbyPlayers.find((lp) => lp.player_id != player.id);
  const otherPlayer = await playerDB.get(otherPlayerInfo.player_id);

  try {
    await client.query("BEGIN");
    await stageBanDB.ban(game.id, player.id, stage.id, client);
    const bannedStages = await stageBanDB.getBans(game.id, client);

    // Strike
    let nextStriker = player;
    if (gameNum == 1) {
      if (bannedStages.length % 2 !== 0) nextStriker = otherPlayer;
      else if (bannedStages.length == 4) {
        nextStriker = null;
        const starters = await stageDB.getStarters();
        const bannedStagesNames = bannedStages.map((stage) => stage.name);
        const starter = starters.find((stage) => !bannedStagesNames.includes(stage.name));
        await pickStage(playerDiscordId, gameNum, starter.name);
        return { nextStriker, starter: starter };
      }
    } else {
      if (bannedStages.length == 2) nextStriker = null;
    }
    await client.query("COMMIT");
    return { nextStriker, bannedStages };
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

const getStages = async (gameNum) => {
  if (gameNum == 1) return await stageDB.getStarters();
  else return await stageDB.getAll();
};

const getStriker = async (channelDiscordId) => {
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  const gameset = await gameSetDB.getByLobby(lobby.id);
  const game = await gameDB.getCurrent(gameset.id);

  // If already exists
  const hasStriker = await gameDB.getStriker(game.id);
  if (hasStriker) return { striker: hasStriker };

  const strikePlayer = lobbyPlayers[Math.floor(Math.random() * lobbyPlayers.length)];
  await gamePlayerDB.setBanTurn(game.id, strikePlayer.player_id, true);

  const striker = await playerDB.get(strikePlayer.player_id, false);
  return { striker };
};

const pickWinner = async (playerDiscordId, isWinner, gameNum) => {
  // Get variables
  const player = await playerDB.get(playerDiscordId, true);

  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getByNum(gameset.id, gameNum);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await gamePlayerDB.setWinner(game.id, player.id, isWinner, client);
    const winner = await gameDB.calculateWinner(game.id, client);
    const opponent = await gamePlayerDB.getOpponent(game.id, player.id, client);

    if (winner) await gameDB.setWinner(game.id, winner.id, client);
    await client.query("COMMIT");

    return { winner, opponent };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

module.exports = {
  newSet,
  getPlayersAndCharacters,
  pickCharacter,
  setCharMessage,
  popCharacterMessages,
  getStages,
  getStriker,
  pickStage,
  pickWinner,
  banStage,
};
