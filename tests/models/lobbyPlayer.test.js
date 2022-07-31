const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { getAllGuilds } = require("../../models/guild");
const { getPlayer, insertPlayer, Player } = require("../../models/player");
const { Lobby } = require("../../models/lobby");
const { LobbyPlayer } = require("../../models/lobbyPlayer");

afterAll(async () => await db.close());

describe("test Lobby Player methods", () => {
  let guild;
  let player;
  let secondPlayer;
  let lobby;
  let lobbyPlayer;

  const mockPlayerDiscordId = "147258369";
  const mockSecondPlayerId = "777777";

  const lobbyPlayerStatus = "SEARCHING";

  beforeEach(async () => {
    if (!guild) {
      const guilds = await getAllGuilds();
      guild = guilds[0];
    }

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    secondPlayer = await getPlayer(mockSecondPlayerId, true);
    if (!secondPlayer) secondPlayer = await insertPlayer(mockSecondPlayerId);

    lobby = await player.getOwnLobby();
    if (!lobby) lobby = await player.insertLobby(guild.id);

    lobbyPlayer = await lobby.addPlayer(secondPlayer.id, lobbyPlayerStatus);
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    secondPlayer = await getPlayer(mockSecondPlayerId, true);
    if (secondPlayer) await secondPlayer.remove();
  });

  it("inserts a new lobbyPlayer", async () => {
    expect(lobbyPlayer).not.toBeNull();
    expect(lobbyPlayer instanceof LobbyPlayer).toBe(true);

    expect(lobbyPlayer.lobbyId).toEqual(lobby.id);
    expect(lobbyPlayer.playerId).toEqual(secondPlayer.id);
    expect(lobbyPlayer.status).toEqual(lobbyPlayerStatus);
    expect(lobbyPlayer.messageId).toBeNull();

    expect(lobbyPlayer.newSet).toBe(false);
    expect(lobbyPlayer.cancelSet).toBe(false);
  });

  it("can get a lobby player from the lobby by the player Id", async () => {
    const lobbyPlayerFromGet = await lobby.getLobbyPlayer(secondPlayer.id);
    expect(JSON.stringify(lobbyPlayerFromGet)).toEqual(JSON.stringify(lobbyPlayer));
  });

  it("getLobbyPlayer returns null if a null id is passed", async () => {
    const lobbyPlayerFromGet = await lobby.getLobbyPlayer(null);
    expect(lobbyPlayerFromGet).toBeNull();
  });

  it("can get all lobbyPlayers from a lobby", async () => {
    const lps = await lobby.getLobbyPlayers();

    lps.forEach((lp) => expect(lp instanceof LobbyPlayer));
    expect(lps.length).toEqual(2);
  });

  it("can remove all lobbyPlayers from the lobby except one", async () => {
    let lps = await lobby.getLobbyPlayers();
    expect(lps.length).toEqual(2);

    await lobby.removeOtherPlayers(secondPlayer.id);

    lps = await lobby.getLobbyPlayers();

    // One lp has been removed
    expect(lps.length).toEqual(1);

    // The one remaining is secondPlayer
    expect(JSON.stringify(lps[0])).toEqual(JSON.stringify(lobbyPlayer));
  });

  it("can get the player from the lobbyPlayer", async () => {
    const playerFromGet = await lobbyPlayer.getPlayer();
    expect(playerFromGet instanceof Player).toBe(true);
    expect(JSON.stringify(playerFromGet)).toEqual(JSON.stringify(secondPlayer));
  });

  it("can get the lobby from the lobbyPlayer", async () => {
    const lobbyFromGet = await lobbyPlayer.getLobby();
    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(JSON.stringify(lobbyFromGet)).toEqual(JSON.stringify(lobby));
  });

  it("can get their opponent as lobbyPlayer", async () => {
    const opponent = await lobbyPlayer.getOpponent();
    expect(opponent instanceof LobbyPlayer).toBe(true);

    const playerLP = await lobby.getLobbyPlayer(player.id);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(playerLP));
  });

  it("getOpponent returns null if there's no opponent", async () => {
    await lobby.removeOtherPlayers(secondPlayer.id);
    const opponent = await lobbyPlayer.getOpponent();
    expect(opponent).toBeNull();
  });

  it("can set status for a single lobbyPlayer", async () => {
    expect(lobbyPlayer.status).toEqual(lobbyPlayerStatus);
    const newStatus = "NEWSTATUS";
    await lobbyPlayer.setStatus(newStatus);

    expect(lobbyPlayer.status).toEqual(newStatus);
    lobbyPlayer = await lobby.getLobbyPlayer(secondPlayer.id);
    expect(lobbyPlayer.status).toEqual(newStatus);
  });

  it("can set the status of all lobbyPlayers from a lobby", async () => {
    const newStatus = "NEWSTATUS";
    await lobby.setLobbyPlayersStatus(newStatus);
    const lps = await lobby.getLobbyPlayers();
    lps.forEach((lp) => expect(lp.status).toEqual(newStatus));
  });

  it("can set the newSet bool of a lobbyPlayer", async () => {
    expect(lobbyPlayer.newSet).toBe(false);
    await lobbyPlayer.setNewSet(true);

    expect(lobbyPlayer.newSet).toBe(true);
    lobbyPlayer = await lobby.getLobbyPlayer(secondPlayer.id);
    expect(lobbyPlayer.newSet).toBe(true);
  });

  it("can set the cancelSet bool of a lobbyPlayer", async () => {
    expect(lobbyPlayer.cancelSet).toBe(false);
    await lobbyPlayer.setCancelSet(true);

    expect(lobbyPlayer.cancelSet).toBe(true);
    lobbyPlayer = await lobby.getLobbyPlayer(secondPlayer.id);
    expect(lobbyPlayer.cancelSet).toBe(true);
  });

  it("cascades when the lobby is deleted", async () => {
    const initialNumRows = await db.countRows("lobby_player");
    await lobby.remove();
    const finalNumRows = await db.countRows("lobby_player");
    expect(finalNumRows).toEqual(initialNumRows - 2);
  });

  it("cascades when the player is deleted", async () => {
    const initialNumRows = await db.countRows("lobby_player");
    await secondPlayer.remove();
    const finalNumRows = await db.countRows("lobby_player");
    expect(finalNumRows).toEqual(initialNumRows - 1);
  });
});
