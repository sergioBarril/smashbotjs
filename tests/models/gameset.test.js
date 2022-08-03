const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertGuild, getGuild } = require("../../models/guild");
const { getPlayer, insertPlayer } = require("../../models/player");
const { Lobby } = require("../../models/lobby");
const { Gameset, getGameset } = require("../../models/gameset");

afterAll(async () => await db.close());

describe("test Gameset methods", () => {
  let guild;
  let player;
  let player2;
  let lobby;

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

  it("inserts a new gameset", async () => {
    expect(gameset).not.toBeNull();
    expect(gameset instanceof Gameset).toBe(true);
    expect(gameset.createdAt instanceof Date).toBe(true);
    expect(gameset.finishedAt).toBeNull();

    expect(gameset.firstTo).toBe(3);
    expect(gameset.guildId).toBe(guild.id);
    expect(gameset.lobbyId).toBe(lobby.id);
    expect(gameset.winnerId).toBeNull();
    expect(gameset.isSurrender).toBeNull();
  });

  it("can get the lobby", async () => {
    let lobbyFromGet = await gameset.getLobby();
    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(JSON.stringify(lobbyFromGet)).toEqual(JSON.stringify(lobby));
  });

  it("has lobby = null when the lobby is deleted", async () => {
    await lobby.remove();
    let lobbyFromGet = await gameset.getLobby();
    expect(lobbyFromGet).toBeNull();

    gameset = await getGameset(gameset.id);
    expect(gameset.lobbyId).toBeNull();

    lobbyFromGet = await gameset.getLobby();
    expect(lobbyFromGet).toBeNull();
  });

  it("can set the winner", async () => {
    await gameset.setWinner(player.id);
    expect(gameset.winnerId).toEqual(player.id);

    gameset = await getGameset(gameset.id);
    expect(gameset.winnerId).toEqual(player.id);
  });

  it("can set the lobby", async () => {
    await lobby.remove();
    const oldId = lobby.id;
    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "PLAYING");
    await gameset.setLobby(lobby.id);

    expect(gameset.lobbyId).toEqual(lobby.id);
    expect(gameset.lobbyId).not.toEqual(oldId);
  });

  it("can set the finish datetime", async () => {
    expect(gameset.finishedAt).toBeNull();

    await gameset.setFinish();
    expect(gameset.finishedAt).not.toBeNull();
    gameset = await getGameset(gameset.id);
    expect(gameset.finishedAt instanceof Date).toBe(true);
  });

  it("can set the surrender bool", async () => {
    expect(gameset.isSurrender).toBeFalsy();

    await gameset.setSurrender();
    expect(gameset.isSurrender).toBe(true);

    gameset = await getGameset(gameset.id);
    expect(gameset.isSurrender).toBe(true);
  });

  it("can get the gameset", async () => {
    let gsFromGet = await getGameset(gameset.id);
    expect(JSON.stringify(gsFromGet)).toEqual(JSON.stringify(gameset));

    gsFromGet = await getGameset(0);
    expect(gsFromGet).toBeNull();
  });
});
