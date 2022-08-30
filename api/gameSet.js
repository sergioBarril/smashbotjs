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
const { getPlayer } = require("../models/player");
const { NotFoundError } = require("../errors/notFound");
const { InGamesetError } = require("../errors/inGameset");
const { getCharacterByName } = require("../models/character");
const { Message } = require("../models/message");

/**
 * Starts a new set, and the first game
 * @param {string} playerDiscordId Discord ID of one of the players
 * @returns
 */
const newSet = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  // CHECK IF CURRENT SET EXISTS
  const oldGameset = await lobby.getGameset();
  if (oldGameset) throw new InGamesetError();

  // NEW SET
  await lobby.newGameset(3);
  const gameset = await lobby.getGameset();
  const game = await gameset.newGame();

  // GAME PLAYERS
  const lobbyPlayers = await lobby.getLobbyPlayers();
  for (lp of lobbyPlayers) await game.addPlayer(lp.playerId);

  const players = await Promise.all(lobbyPlayers.map(async (lp) => await lp.getPlayer()));
  return { players };
};

const newGame = async (lobbyChannelId) => {
  // Get variables
  const lobby = await lobbyDB.getByTextChannel(lobbyChannelId);
  const gameset = await gameSetDB.getByLobby(lobby.id);

  const client = await db.getClient();
  let newGameNum = null;
  try {
    await client.query("BEGIN");
    const prevGame = await gameDB.getCurrent(gameset.id, client);
    newGameNum = (prevGame?.num || 0) + 1;
    await gameDB.create(gameset.id, newGameNum, client);
    const newGameObj = await gameDB.getByNum(gameset.id, newGameNum, client);

    const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id, client);
    for (lp of lobbyPlayers) await gamePlayerDB.create(newGameObj.id, lp.player_id, client);

    await client.query("COMMIT");

    return { newGameNum };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const cancelSet = async (lobbyChannelId) => {
  const lobby = await lobbyDB.getByTextChannel(lobbyChannelId);
  const gameset = await gameSetDB.getByLobby(lobby.id);

  if (!gameset) throw { name: "NO_GAMESET" };
  if (gameset.winner_id) throw { name: "ALREADY_ENDED" };

  await gameSetDB.remove(gameset.id);
};

/**
 * Save the CharacterSelect message in the database
 * @param {string} playerDiscordId Discord ID of the player
 * @param {string} messageDiscordId Discord ID of the message to save
 */
const setCharacterSelectMessage = async (playerDiscordId, messageDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset");

  const game = await gameset.getCurrentGame();
  if (!game) throw new NotFoundError("Game");

  const gp = await game.getGamePlayer(player.id);
  if (!gp) throw new NotFoundError("GamePlayer");

  const message = await gp.insertCharacterMessage(messageDiscordId);
};

/**
 * Pick a character
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} charName Character Name
 * @returns
 */
const pickCharacter = async (playerDiscordId, charName) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset");

  const game = await gameset.getCurrentGame();
  if (!game) throw new NotFoundError("Game");

  const gp = await game.getGamePlayer(player.id);
  if (!gp) throw new NotFoundError("GamePlayer");

  const character = await getCharacterByName(charName);

  await gp.setCharacter(character.id);
  const allPicked = await game.haveAllPicked();
  const opponentGp = await gp.getOpponent();
  const opponent = await getPlayer(opponentGp.playerId, false);

  const charMessage = await gp.getCharacterMessage();

  return { allPicked, gameNum: game.num, charMessage, opponent };
};

const pickStage = async (playerDiscordId, gameNum, stageName) => {
  // Get variables
  const player = await playerDB.get(playerDiscordId, true);

  const gameset = await gameSetDB.getByPlayer(player.id);
  const game = await gameDB.getByNum(gameset.id, gameNum);

  const stage = await stageDB.getByName(stageName);
  await gameDB.setStage(game.id, stage.id);

  return { stage };
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
    let nextPicker = null;

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
    } else if (bannedStages.length == 2) {
      nextStriker = null;
      nextPicker = otherPlayer;
    }
    await client.query("COMMIT");
    return { nextStriker, bannedStages, nextPicker };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Gets and deletes all GAME_CHARACTER_PICK messages of the current game
 * @param {string} playerDiscordId Discord ID of one of the players
 * @returns {Promise<Array<Message>>} Array of messages
 */
const popCharacterMessages = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset");

  const game = await gameset.getCurrentGame();
  if (!game) throw new NotFoundError("Game");

  const charMessages = await game.getCharacterMessages();
  await game.deleteCharacterMessages();

  return { charMessages };
};

/**
 * Gets the character being played for every player
 * @param {string} playerDiscordId DiscordID of one of the players
 * @returns Array of objects with two properties: playerDiscordId and characterName
 */
const getPlayersAndCharacters = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset");

  const game = await gameset.getCurrentGame();
  if (!game) throw new NotFoundError("Game");

  const pc = await game.getCharacters();
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

  let strikePlayer;
  if (game.num === 1) strikePlayer = lobbyPlayers[Math.floor(Math.random() * lobbyPlayers.length)];
  else {
    const prevGame = await gameDB.getByNum(gameset.id, game.num - 1);
    strikePlayer = { player_id: prevGame.winner_id };
  }
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

    if (!isWinner) opponent.winner = opponent.winner === false;

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

const getScore = async (channelDiscordId) => {
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  const gameset = await gameSetDB.getByLobby(lobby.id);
  const score = await gameSetDB.getScore(gameset.id);
  const winnerId = gameset.winner_id;

  const winner = await playerDB.get(winnerId, false);

  if (gameset.is_surrender)
    score.forEach((playerScore) => {
      playerScore.surrender = playerScore.discord_id != winner?.discord_id;
    });

  return score;
};

const getGameWinner = async (channelDiscordId, gameNum) => {
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  const gameset = await gameSetDB.getByLobby(lobby.id);

  const game = await gameDB.getByNum(gameset.id, gameNum);
  if (!game || !game.winner_id) return null;

  const player = await playerDB.get(game.winner_id, false);
  return player;
};

const setWinner = async (winnerDiscordId) => {
  const player = await playerDB.get(winnerDiscordId, true);
  const gameset = await gameSetDB.getByPlayer(player.id);

  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    await gameSetDB.setWinner(gameset.id, player.id, client);
    await gameSetDB.setFinish(gameset.id, client);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const unlinkLobby = async (channelDiscordId) => {
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  const gameset = await gameSetDB.getByLobby(lobby.id);
  await gameSetDB.setLobby(gameset.id, null);
};

const getGameNumber = async (channelDiscordId) => {
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  const gameset = await gameSetDB.getByLobby(lobby.id);
  const game = await gameDB.getCurrent(gameset.id);

  return game.num;
};

const canPickCharacter = async (playerDiscordId, channelDiscordId, gameNum) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  const gameset = await gameSetDB.getByLobby(lobby.id);
  const game = await gameDB.getCurrent(gameset.id);

  const gamePlayer = await gamePlayerDB.get(game.id, player.id);
  const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id);
  const opponentGP = await gamePlayerDB.get(game.id, opponent.id);

  // Conditions:
  const charMessage = gamePlayer.char_message != null;
  const notYetPicked = gamePlayer.character_id == null;

  const opponentHasPicked = opponentGP.character_id != null;
  const noOpponentMessage = opponentGP.char_message == null;
  const isFirstGame = gameNum == 1;

  return charMessage && notYetPicked && (isFirstGame || opponentHasPicked || noOpponentMessage);
};

const surrender = async (playerDiscordId, channelDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  if (!lobby) throw { name: "NO_LOBBY" };
  const gameset = await gameSetDB.getByLobby(lobby.id);
  if (!gameset) throw { name: "NO_GAMESET" };

  const game = await gameDB.getCurrent(gameset.id);
  const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    if (game) await gameDB.setWinner(game.id, opponent.id, client);
    await gameSetDB.setSurrender(gameset.id, opponent.id, client);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const removeCurrentGame = async (channelDiscordId) => {
  const lobby = await lobbyDB.getByTextChannel(channelDiscordId);
  if (!lobby) throw { name: "NO_LOBBY" };

  const gameset = await gameSetDB.getByLobby(lobby.id);
  if (!gameset) throw { name: "NO_GAMESET" };

  const game = await gameDB.getCurrent(gameset.id);
  if (!game) throw { name: "NO_GAME" };

  await gameDB.remove(game.id);
};

/**
 * Vote to play a new set BO5
 * @param {string} playerDiscordId DiscordID of the player voting
 * @returns
 */
const voteNewSet = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby");

  const currentGameset = await lobby.getGameset();
  if (currentGameset) throw new InGamesetError();

  const lp = await lobby.getLobbyPlayer(player.id);
  await lp.setNewSet(!lp.newSet);

  const newStatus = lp.newSet;

  const decided = await lobby.isNewSetDecided();

  const opponentLp = await lp.getOpponent();

  if (decided) {
    await opponentLp.setNewSet(false);
    await lp.setNewSet(false);
  }

  const opponent = await opponentLp.getPlayer();
  return { decided, status: newStatus, opponent };
};

module.exports = {
  newSet,
  newGame,
  cancelSet,
  getPlayersAndCharacters,
  pickCharacter,
  setCharacterSelectMessage,
  popCharacterMessages,
  getStages,
  getStriker,
  pickStage,
  pickWinner,
  banStage,
  getScore,
  getGameWinner,
  setWinner,
  unlinkLobby,
  getGameNumber,
  canPickCharacter,
  surrender,
  removeCurrentGame,
  voteNewSet,
};
