const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertGuild, getGuild } = require("../../models/guild");
const { getPlayer, insertPlayer, Player } = require("../../models/player");
const { Game } = require("../../models/game");
const { insertStage } = require("../../models/stage");
const { GamePlayer } = require("../../models/gamePlayer");
const { insertCharacter } = require("../../models/character");
const { StageBan } = require("../../models/stageBan");

afterAll(async () => await db.close());

describe("test Game Player methods", () => {
  let guild;
  let player;
  let player2;
  let lobby;
  let game;
  let gamePlayer;
  let gamePlayer2;

  let gameset;

  const mockPlayerDiscordId = "147258369";
  const mockPlayer2DiscordId = "128394192";
  const mockGuildDiscordId = "843516697";

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    player2 = await getPlayer(mockPlayer2DiscordId, true);
    if (!player2) player2 = await insertPlayer(mockPlayer2DiscordId);

    lobby = await player.getOwnLobby();
    if (!lobby) lobby = await player.insertLobby(guild.id);

    await lobby.addPlayer(player2.id, "PLAYING");
    await lobby.setStatus("PLAYING");
    await lobby.setLobbyPlayersStatus("PLAYING");

    gameset = await lobby.newGameset();

    game = await gameset.getCurrentGame();
    if (!game) game = await gameset.newGame();

    gamePlayer = await game.getGamePlayer(player.id);
    if (!gamePlayer) gamePlayer = await game.addPlayer(player.id);

    gamePlayer2 = await game.getGamePlayer(player2.id);
    if (!gamePlayer2) gamePlayer2 = await game.addPlayer(player2.id);
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    player2 = await getPlayer(mockPlayer2DiscordId, true);
    if (player2) await player2.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();

    if (gameset) await gameset.remove();
  });

  it("inserts a new gamePlayer", async () => {
    expect(gamePlayer).not.toBeNull();
    expect(gamePlayer instanceof GamePlayer).toBe(true);
    expect(gamePlayer.gameId).toBe(game.id);
    expect(gamePlayer.playerId).toEqual(player.id);

    expect(gamePlayer.characterId).toBeNull();
    expect(gamePlayer.banTurn).toBeFalsy();
    expect(gamePlayer.charMessageId).toBeNull();
    expect(gamePlayer.winner).toBeFalsy();
  });

  it("gets the opponent gamePlayer", async () => {
    let opponent = await gamePlayer.getOpponent();
    expect(opponent instanceof GamePlayer).toBe(true);

    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(gamePlayer2));

    await player2.remove();
    opponent = await gamePlayer.getOpponent();
    expect(opponent).toBeNull();
  });

  it("gets all gamePlayers", async () => {
    let gps = await game.getGamePlayers();
    expect(gps.length).toBe(2);

    expect(gps.every((gp) => gp instanceof GamePlayer)).toBe(true);
    expect(gps.some((gp) => gp.playerId === player.id)).toBe(true);
    expect(gps.some((gp) => gp.playerId === player2.id)).toBe(true);
  });

  it("sets the character", async () => {
    let character = await insertCharacter("Test name");
    expect(gamePlayer.characterId).toBeNull();

    await gamePlayer.setCharacter(character.id);
    expect(gamePlayer.characterId).toBe(character.id);

    gamePlayer = await game.getGamePlayer(gamePlayer.playerId);
    expect(gamePlayer.characterId).toBe(character.id);

    await character.remove();
  });

  it("sets the ban turn", async () => {
    expect(gamePlayer.banTurn).toBeFalsy();
    await gamePlayer.setBanTurn(true);
    expect(gamePlayer.banTurn).toBe(true);

    gamePlayer = await game.getGamePlayer(gamePlayer.playerId);
    expect(gamePlayer.banTurn).toBe(true);
  });

  it("sets the winner vote", async () => {
    expect(gamePlayer.winner).toBeFalsy();
    await gamePlayer.setWinner(true);
    expect(gamePlayer.winner).toBe(true);

    gamePlayer = await game.getGamePlayer(gamePlayer.playerId);
    expect(gamePlayer.winner).toBe(true);
  });

  it("checks if all have picked character", async () => {
    let haveAll = await game.haveAllPicked();
    expect(haveAll).toBe(false);

    const character = await insertCharacter("Test char");
    await gamePlayer.setCharacter(character.id);

    haveAll = await game.haveAllPicked();
    expect(haveAll).toBe(false);

    await gamePlayer2.setCharacter(character.id);
    haveAll = await game.haveAllPicked();
    expect(haveAll).toBe(true);

    await character.remove();
  });

  it("gets the striker gameplayer", async () => {
    let striker = await game.getStriker();
    expect(striker).toBeNull();

    await gamePlayer.setBanTurn(true);
    striker = await game.getStriker();

    expect(JSON.stringify(striker)).toEqual(JSON.stringify(gamePlayer));
  });

  it("can calculate the winner GamePlayer", async () => {
    let winner = await game.calculateWinner();
    expect(winner).toBeNull();

    await gamePlayer.setWinner(true);
    winner = await game.calculateWinner();
    expect(winner).toBeNull();

    await gamePlayer2.setWinner(false);
    winner = await game.calculateWinner();
    expect(JSON.stringify(winner)).toEqual(JSON.stringify(gamePlayer));
  });

  it("can ban a stage", async () => {
    const stage = await insertStage("Test Stage 1", true);

    let bans = await game.getBans();
    expect(bans.length).toEqual(0);

    await gamePlayer.banStage(stage.id);
    bans = await game.getBans();
    expect(bans.length).toEqual(1);
    expect(bans[0] instanceof StageBan).toBe(true);

    await stage.remove();
  });

  it("gameset can get the current score", async () => {
    let results = await gameset.getScore();
    expect(results.length).toEqual(2);
    expect(results.every((scoreResult) => scoreResult.wins === 0)).toBe(true);
    expect(results.every((scoreResult) => scoreResult.player instanceof Player)).toBe(true);

    await game.setWinner(player.id);

    results = await gameset.getScore();
    expect(results.length).toEqual(2);
    expect(results.some((scoreResult) => scoreResult.wins === 0)).toBe(true);
    expect(results.some((scoreResult) => scoreResult.wins === 1)).toBe(true);
    expect(results.every((scoreResult) => scoreResult.player instanceof Player)).toBe(true);

    game = await gameset.newGame();
    gamePlayer = await game.addPlayer(player.id);
    gamePlayer2 = await game.addPlayer(player2.id);

    await game.setWinner(player.id);

    results = await gameset.getScore();

    expect(results.length).toEqual(2);
    expect(results.some((scoreResult) => scoreResult.wins === 0)).toBe(true);
    expect(results.some((scoreResult) => scoreResult.wins === 2)).toBe(true);
    expect(results.every((scoreResult) => scoreResult.player instanceof Player)).toBe(true);

    game = await gameset.newGame();
    gamePlayer = await game.addPlayer(player.id);
    gamePlayer2 = await game.addPlayer(player2.id);

    await game.setWinner(player2.id);

    results = await gameset.getScore();

    expect(results.length).toEqual(2);
    expect(results.some((scoreResult) => scoreResult.wins === 1)).toBe(true);
    expect(results.some((scoreResult) => scoreResult.wins === 0)).toBe(false);
    expect(results.some((scoreResult) => scoreResult.wins === 2)).toBe(true);
    expect(results.every((scoreResult) => scoreResult.player instanceof Player)).toBe(true);
  });
});
