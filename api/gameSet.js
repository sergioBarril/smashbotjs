const { getPlayer, getPlayerOrThrow } = require("../models/player");
const { NotFoundError } = require("../errors/notFound");
const { InGamesetError } = require("../errors/inGameset");
const { getCharacterByName, getCharacter } = require("../models/character");
const { Message } = require("../models/message");
const { getStarters, getAllStages, getStageByName, getStage } = require("../models/stage");
const { getLobbyByTextChannel, getLobbyByTextChannelOrThrow } = require("../models/lobby");
const { CustomError } = require("../errors/customError");
const { AlreadyFinishedError } = require("../errors/alreadyFinished");

/**
 * -------------
 * AUX FUNCTIONS
 * -------------
 */

/**
 * Gets the basic objects of this module
 * @param {string} playerDiscordId DiscordID of the player
 * @param {boolean} getCurrentGame True if should try to find the current game
 * @param {boolean} getGp True if should try to find the gp corresponding to the player
 * @returns
 */
async function getObjects(playerDiscordId, getCurrentGame = false, getGp = false) {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getLobbyOrThrow("PLAYING");
  const gameset = await lobby.getGamesetOrThrow();

  let game = null;
  let gp = null;

  if (getCurrentGame) {
    game = await gameset.getCurrentGame();
    if (!game) throw new NotFoundError("Game");
  }

  if (getGp) {
    gp = await game.getGamePlayer(player.id);
    if (!gp) throw new NotFoundError("GamePlayer");
  }

  return { player, lobby, gameset, game, gp };
}

/**
 * Get the lobby and gameset
 * @param {string} textChannelId DiscordID of the textChannel associated with an arena
 * @returns
 */
async function getObjectsByTextChannel(textChannelId) {
  const lobby = await getLobbyByTextChannelOrThrow(textChannelId, "GAMESET");
  const gameset = await lobby.getGamesetOrThrow();

  return { lobby, gameset };
}

/**
 * ------------------
 */

/**
 * Starts a new set, and the first game
 * @param {string} textChannelId DiscordID of the textChannel of the lobby
 * @returns
 */
const newSet = async (textChannelId) => {
  const lobby = await getLobbyByTextChannel(textChannelId);
  if (!lobby) throw new NotFoundError("Lobby", "GAMESET");

  // CHECK IF CURRENT SET EXISTS
  const oldGameset = await lobby.getGameset();
  if (oldGameset) throw new InGamesetError();

  // NEW SET
  await lobby.newGameset(3, lobby.mode == "RANKED");
  const gameset = await lobby.getGamesetOrThrow();
  const game = await gameset.newGame();

  // GAME PLAYERS
  const lobbyPlayers = await lobby.getLobbyPlayers();
  for (lp of lobbyPlayers) await game.addPlayer(lp.playerId);

  const players = await Promise.all(lobbyPlayers.map(async (lp) => await lp.getPlayer()));
  return { players };
};

/**
 * Make a new game
 * @param {string} lobbyChannelId TextChannel ID of the lobby
 * @returns
 */
const newGame = async (lobbyChannelId) => {
  const { lobby, gameset } = await getObjectsByTextChannel(lobbyChannelId);

  const newGame = await gameset.newGame();
  const lobbyPlayers = await lobby.getLobbyPlayers();
  for (let lp of lobbyPlayers) await newGame.addPlayer(lp.playerId);

  return newGame;
};

/**
 * Cancel the set
 * @param {string} lobbyChannelId DiscordID of the lobby
 */
const cancelSet = async (lobbyChannelId) => {
  const { gameset } = await getObjectsByTextChannel(lobbyChannelId);

  if (gameset.winnerId) throw new AlreadyFinishedError();
  await gameset.remove();
};

/**
 * Returns true if the gameset is ranked.
 * @param {string} playerDiscordId Discord ID of a player of the gameset
 * @returns
 */
const isRankedSet = async (playerDiscordId) => {
  const { gameset } = await getObjects(playerDiscordId);
  return gameset.ranked;
};

const getRankedCountToday = async (playerDiscordId, opponentDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const opponent = await getPlayerOrThrow(opponentDiscordId, true);

  return player.getRankedCountToday(opponent.id);
};

/**
 * Save the CharacterSelect message in the database
 * @param {string} playerDiscordId Discord ID of the player
 * @param {string} messageDiscordId Discord ID of the message to save
 */
const setCharacterSelectMessage = async (playerDiscordId, messageDiscordId) => {
  const { gp } = await getObjects(playerDiscordId, true, true);

  await gp.insertCharacterMessage(messageDiscordId);
};

/**
 * Pick a character
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} charName Character Name
 * @returns
 */
const pickCharacter = async (playerDiscordId, charName) => {
  const { game, gp } = await getObjects(playerDiscordId, true, true);

  const character = await getCharacterByName(charName);

  await gp.setCharacter(character.id);
  const allPicked = await game.haveAllPicked();
  const opponentGp = await gp.getOpponent();
  const opponent = await getPlayer(opponentGp.playerId, false);

  const charMessage = await gp.getCharacterMessage();

  return { allPicked, gameNum: game.num, charMessage, opponent };
};

/**
 * Pick a stage
 * @param {string} playerDiscordId DiscordID of the player
 * @param {int} gameNum Game number
 * @param {string} stageName Stage Name
 * @returns The stage picked
 */
const pickStage = async (playerDiscordId, gameNum, stageName) => {
  const { gameset } = await getObjects(playerDiscordId);

  const game = await gameset.getGameByNum(gameNum);
  const stage = await getStageByName(stageName);

  await game.setStage(stage.id);
  return stage;
};

/**
 *
 * @param {string} playerDiscordId DiscordID of the player
 * @param {int} gameNum Number of the game
 * @param {string} stageName Name of the stage
 * @returns
 */
const banStage = async (playerDiscordId, gameNum, stageName) => {
  // Get variables
  const { player, lobby, gameset } = await getObjects(playerDiscordId);

  const game = await gameset.getCurrentGame();
  if (gameNum != game.num) throw new NotFoundError("GameNum");

  const stage = await getStageByName(stageName);

  const lp = await lobby.getLobbyPlayer(player.id);
  const opponentLp = await lp.getOpponent();
  const otherPlayer = await opponentLp.getPlayer();

  const bannerGp = await game.getGamePlayer(player.id);

  await bannerGp.banStage(stage.id);
  const stageBans = await game.getBans();
  const bannedStages = await Promise.all(stageBans.map(async (sb) => await getStage(sb.stageId)));

  let nextPicker = null;
  let nextStriker = player;
  let starter = null;

  if (gameNum == 1) {
    // Swap striker at odd bans
    if (bannedStages.length === 3 || bannedStages.length === 7) nextStriker = otherPlayer;
    // All banned except 1
    else if (bannedStages.length == 8) {
      nextStriker = null;
      const starters = await getStarters();
      starter = starters.find((stage) => bannedStages.every((bs) => bs.name !== stage.name));
      await pickStage(playerDiscordId, gameNum, starter.name);
    }
  } else if (bannedStages.length == 3) {
    nextStriker = null;
    nextPicker = otherPlayer;
  }
  return { nextStriker, bannedStages, nextPicker, starter };
};

/**
 * Gets and deletes all GAME_CHARACTER_PICK messages of the current game
 * @param {string} playerDiscordId Discord ID of one of the players
 * @returns {Promise<Array<Message>>} Array of messages
 */
const popCharacterMessages = async (playerDiscordId) => {
  const { game } = await getObjects(playerDiscordId, true);
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
  const { game } = await getObjects(playerDiscordId, true);

  const pc = await game.getCharacters();
  return pc;
};

/**
 * Get stages. Starters if first game, all of them otherwise
 * @param {int} gameNum Number of the game
 * @returns Array of stages
 */
const getStages = async (gameNum) => {
  if (gameNum == 1) return await getStarters();
  else return await getAllStages();
};

/**
 * Get the player that strikes
 * @param {string} channelDiscordId TextChannel DiscordId of the lobby where the game is being played
 * @returns {Promise<Player>} Player that will strike
 */
const getStriker = async (channelDiscordId) => {
  const { lobby, gameset } = await getObjectsByTextChannel(channelDiscordId);

  const game = await gameset.getCurrentGame();
  if (!game) throw new NotFoundError("Game");

  const lobbyPlayers = await lobby.getLobbyPlayers();

  // If already exists
  let strikerGp = await game.getStriker();
  if (strikerGp) return await getPlayer(strikerGp.playerId, false);

  // Calculate new striker
  let striker;
  if (game.num === 1) {
    const strikerLp = lobbyPlayers[Math.floor(Math.random() * lobbyPlayers.length)];
    striker = await getPlayer(strikerLp.playerId, false);
  } else {
    const prevGame = await gameset.getGameByNum(game.num - 1);
    striker = await prevGame.getWinner();
  }

  // Update ban_turn
  strikerGp = await game.getGamePlayer(striker.id);
  await strikerGp.setBanTurn(true);
  return striker;
};

/**
 *
 * @param {string} playerDiscordId DiscordId of the player voting
 * @param {boolean} isWinner True if voting for themselves
 * @param {int} gameNum Game Number
 * @returns
 */
const pickWinner = async (playerDiscordId, isWinner, gameNum) => {
  const { player, gameset } = await getObjects(playerDiscordId);

  const game = await gameset.getGameByNum(gameNum);

  const gp = await game.getGamePlayer(player.id);
  await gp.setWinner(isWinner);

  const winnerGp = await game.calculateWinner();
  let winnerCharacter = null;
  const opponent = await gp.getOpponent();

  if (!isWinner) opponent.winner = opponent.winner === false;

  if (winnerGp) {
    winnerCharacter = await getCharacter(winnerGp.characterId);
    await game.setWinner(winnerGp.playerId);
  }

  const winner = await getPlayer(winnerGp?.playerId, false);
  return { winner, opponent, winnerCharacter };
};

/**
 * Get the score
 * @param {string} channelDiscordId DiscordID of the text channel of the lobby
 * @returns
 */
const getScore = async (channelDiscordId) => {
  const { gameset } = await getObjectsByTextChannel(channelDiscordId);

  const score = await gameset.getScore();
  const winnerId = gameset.winnerId;

  const winner = await getPlayer(winnerId, false);

  if (gameset.isSurrender)
    score.forEach((playerScore) => {
      playerScore.surrender = playerScore.player.discordId != winner?.discordId;
    });

  return score;
};

/**
 * Get the player that won in a game
 * @param {string} channelDiscordId DiscordID of the TextChannel of the lobby
 * @param {int} gameNum Game number
 * @returns {Promise<Player>}
 */
const getGameWinner = async (channelDiscordId, gameNum) => {
  const { gameset } = await getObjectsByTextChannel(channelDiscordId);

  const game = await gameset.getGameByNum(gameNum);
  if (!game || !game.winnerId) return null;

  return await getPlayer(game.winnerId, false);
};

/**
 * Sets the winner of the set
 * @param {string} winnerDiscordId Player DiscordId of the winner
 */
const setWinner = async (winnerDiscordId) => {
  const { player, gameset } = await getObjects(winnerDiscordId);

  await gameset.setWinner(player.id);
  await gameset.setFinish();
};

/**
 * Unlink the gameset and the lobby
 * @param {string} channelDiscordId
 */
const unlinkLobby = async (channelDiscordId) => {
  const lobby = await getLobbyByTextChannelOrThrow(channelDiscordId, "GAMESET");

  const gameset = await lobby.getGameset();
  await gameset.setLobby(null);
};

/**
 * Get the game number of the current set
 * @param {string} channelDiscordId TextChannel where the set is taking place
 * @returns Game number
 */
const getGameNumber = async (channelDiscordId) => {
  const lobby = await getLobbyByTextChannel(channelDiscordId);
  if (!lobby) throw new NotFoundError("Lobby");

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset");

  const game = await gameset.getCurrentGame();
  return game.num;
};

/**
 * Checks if the player can pick a character now
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} channelDiscordId DiscordID of the channel
 * @param {int} gameNum Number of the game
 * @returns True if the player can pick
 */
const canPickCharacter = async (playerDiscordId, channelDiscordId, gameNum) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobby = await getLobbyByTextChannel(channelDiscordId);
  if (!lobby) return false;

  const gameset = await lobby.getGameset();
  if (!gameset) return false;

  const game = await gameset.getCurrentGame();
  if (!game) return false;

  const gp = await game.getGamePlayer(player.id);
  const opponentGp = await gp.getOpponent();

  // Conditions:
  const charMessage = await gp.getCharacterMessage();

  const notYetPicked = gp.characterId == null;

  const opponentHasPicked = opponentGp.characterId != null;
  const opponentMessage = await opponentGp.getCharacterMessage();

  const isFirstGame = gameNum == 1;

  return charMessage && notYetPicked && (isFirstGame || opponentHasPicked || !opponentMessage);
};

/**
 *
 * @param {string} playerDiscordId DiscordID of the player surrendering
 * @param {string} channelDiscordId DiscordID of the textChannel where the set is being played
 */
const surrender = async (playerDiscordId, channelDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await getLobbyByTextChannelOrThrow(channelDiscordId, "SURRENDER");
  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset", "SURRENDER");

  if (gameset.finishedAt) throw new AlreadyFinishedError();

  const game = await gameset.getCurrentGame();
  const gp = await game?.getGamePlayer(player.id);
  const opponentGp = await gp?.getOpponent();

  await game.setWinner(opponentGp.playerId);
  await gameset.setWinner(opponentGp.playerId);
  await gameset.setFinish();
  await gameset.setSurrender();
};

/**
 * Force the opponent of the player to surrender
 */
const surrenderOpponent = async (playerDiscordId, channelDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await getLobbyByTextChannelOrThrow(channelDiscordId, "ADMINSETWIN");

  const lps = await lobby.getLobbyPlayers();
  if (!lps.some((lp) => lp.playerId === player.id)) {
    throw new NotFoundError("Player", "ADMINSETWIN");
  }

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset", "ADMINSETWIN");

  if (gameset.finishedAt) throw new AlreadyFinishedError();

  const game = await gameset.getCurrentGame();

  await game?.setWinner(player.id);
  await gameset.setWinner(player.id);
  await gameset.setFinish();
  await gameset.setSurrender();
};

const removeCurrentGame = async (channelDiscordId) => {
  const lobby = await getLobbyByTextChannelOrThrow(channelDiscordId, "REMAKE");

  const gameset = await lobby.getGameset();
  if (!gameset) throw new NotFoundError("Gameset", "REMAKE");

  const game = await gameset.getCurrentGame();
  if (!game) throw new NotFoundError("Game");

  await game.remove();
};

/**
 * Vote to play a new set BO5
 * @param {string} playerDiscordId DiscordID of the player voting
 * @returns
 */
const voteNewSet = async (playerDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getLobbyOrThrow("PLAYING", "GAMESET");

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
  isRankedSet,
  getRankedCountToday,
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
  surrenderOpponent,
  removeCurrentGame,
  voteNewSet,
};
