const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertGuild, getGuild } = require("../../models/guild");
const { getPlayer, insertPlayer } = require("../../models/player");
const { Game, getGame } = require("../../models/game");
const { insertStage } = require("../../models/stage");
const { insertCharacter } = require("../../models/character");

afterAll(async () => await db.close());

describe("test Game methods", () => {
  let guild;
  let player;
  let player2;
  let lobby;
  let game;

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

  it("inserts a new game", async () => {
    expect(game).not.toBeNull();
    expect(game instanceof Game).toBe(true);
    expect(game.num).toBe(1);
    expect(game.stageId).toBeNull();
    expect(game.winnerId).toBeNull();
    expect(game.gamesetId).toEqual(gameset.id);
  });

  it("can set a stage", async () => {
    const stage = await insertStage("Test stage", true);
    expect(game.stageId).toBeNull();

    await game.setStage(stage.id);
    expect(game.stageId).toEqual(stage.id);

    game = await gameset.getCurrentGame();
    expect(game.stageId).toEqual(stage.id);

    await stage.remove();
  });

  it("can set the winner", async () => {
    expect(game.winnerId).toBeNull();
    await game.setWinner(player.id);
    expect(game.winnerId).toBe(player.id);

    game = await gameset.getCurrentGame();
    expect(game.winnerId).toBe(player.id);
  });

  it("can be removed", async () => {
    await game.remove();
    game = await gameset.getCurrentGame();
    expect(game).toBeNull();
  });

  it("can get the winner Player", async () => {
    let winner = await game.getWinner();
    expect(winner).toBeNull();

    await game.setWinner(player.id);
    winner = await game.getWinner();
    expect(JSON.stringify(winner)).toEqual(JSON.stringify(player));
  });

  it("can get game", async () => {
    let gameFromGet = await getGame(null);
    expect(gameFromGet).toBeNull();

    gameFromGet = await getGame(game.id);
    expect(JSON.stringify(gameFromGet)).toEqual(JSON.stringify(game));
  });

  it("can get game by number", async () => {
    let gameFromGet = await gameset.getGameByNum(8);
    expect(gameFromGet).toBeNull();

    gameFromGet = await gameset.getGameByNum(null);
    expect(gameFromGet).toBeNull();

    gameFromGet = await gameset.getGameByNum(1);
    expect(JSON.stringify(gameFromGet)).toEqual(JSON.stringify(game));

    const game2 = await gameset.newGame();
    const game3 = await gameset.newGame();

    gameFromGet = await gameset.getGameByNum(2);
    expect(JSON.stringify(gameFromGet)).toEqual(JSON.stringify(game2));
  });
});
