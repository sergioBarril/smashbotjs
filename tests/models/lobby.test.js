const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { getAllGuilds, Guild } = require("../../models/guild");
const { getPlayer, insertPlayer } = require("../../models/player");
const { Lobby, getLobbyByTextChannel, getLobby } = require("../../models/lobby");

afterAll(async () => await db.close());

describe("test Lobby methods", () => {
  let guild;
  let player;
  let lobby;

  const mockPlayerDiscordId = "147258369";

  const mockLobbyStatus = "SEARCHING";
  const mockLobbyMode = "FRIENDLIES";
  const mockLobbyIsRanked = false;

  const mockLobbyTextChannel = "554321";
  const mockLobbyVoiceChannel = "123455";

  beforeEach(async () => {
    if (!guild) {
      const guilds = await getAllGuilds();
      guild = guilds[0];
    }

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    lobby = await player.getOwnLobby();
    if (!lobby) lobby = await player.insertLobby(guild.id);
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();
  });

  it("inserts a new lobby", async () => {
    expect(lobby).not.toBeNull();
    expect(lobby instanceof Lobby).toBe(true);

    expect(lobby.guildId).toEqual(guild.id);
    expect(lobby.createdBy).toEqual(player.id);
    expect(lobby.status).toEqual(mockLobbyStatus);
    expect(lobby.mode).toEqual(mockLobbyMode);
    expect(lobby.ranked).toEqual(mockLobbyIsRanked);

    expect(lobby.createdAt instanceof Date).toBe(true);
    expect(lobby.textChannelId).toBeNull();
    expect(lobby.voiceChannelId).toBeNull();
  });

  it("can be get from its creator", async () => {
    lobby = await player.getOwnLobby();
    expect(lobby instanceof Lobby).toBe(true);
  });

  it("can be get from its textChannel", async () => {
    lobby.setChannels(mockLobbyTextChannel, mockLobbyVoiceChannel);
    lobby = await getLobbyByTextChannel(mockLobbyTextChannel);
    expect(lobby instanceof Lobby).toBe(true);
    expect(lobby.createdBy).toEqual(player.id);
  });

  it("returns null if textChannel is null", async () => {
    const lobbyFromGet = await getLobbyByTextChannel(null);
    expect(lobbyFromGet).toBeNull();
  });

  it("getLobbyByTextChannel returns null if lobby doesnt exist", async () => {
    const lobbyFromGet = await getLobbyByTextChannel("8919191191");
    expect(lobbyFromGet).toBeNull();
  });

  it("can be removed", async () => {
    const numRows = await db.countRows("lobby");
    await lobby.remove();
    const finalNumRows = await db.countRows("lobby");
    expect(finalNumRows).toBe(numRows - 1);
  });

  it("cascades if player is removed", async () => {
    const numRows = await db.countRows("lobby");
    await player.remove();
    const finalNumRows = await db.countRows("lobby");
    expect(finalNumRows).toBe(numRows - 1);
  });

  it("can get guild", async () => {
    const guildFromGet = await lobby.getGuild();

    expect(guildFromGet instanceof Guild).toBe(true);
    expect(guildFromGet.id).toBe(guild.id);
  });

  it("can set text and voice channels", async () => {
    expect(lobby.textChannelId).toBeNull();
    expect(lobby.voiceChannelId).toBeNull();

    await lobby.setChannels(mockLobbyTextChannel, mockLobbyVoiceChannel);

    expect(lobby.textChannelId).toEqual(mockLobbyTextChannel);
    expect(lobby.voiceChannelId).toEqual(mockLobbyVoiceChannel);

    lobby = await player.getOwnLobby();

    expect(lobby.textChannelId).toEqual(mockLobbyTextChannel);
    expect(lobby.voiceChannelId).toEqual(mockLobbyVoiceChannel);
  });

  it("can set its status", async () => {
    expect(lobby.status).toEqual(mockLobbyStatus);

    const newStatus = "CONFIRMATION";
    await lobby.setStatus(newStatus);

    expect(lobby.status).toEqual(newStatus);
    lobby = await player.getOwnLobby();
    expect(lobby.status).toEqual(newStatus);
  });

  it("can set if its ranked", async () => {
    expect(lobby.ranked).toBe(false);

    await lobby.setRanked(true);
    expect(lobby.ranked).toBe(true);

    lobby = await player.getOwnLobby();
    expect(lobby.ranked).toBe(true);
  });

  it("can only create one lobby per player", async () => {
    expect(player.insertLobby(guild.id)).rejects.toThrow();
  });

  it("can be get by lobbyId", async () => {
    const lobbyFromGet = await getLobby(lobby.id);

    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(lobbyFromGet.id).toBe(lobby.id);
  });

  it("getLobby returns null if lobbyId is null", async () => {
    const lobbyFromGet = await getLobby(null);
    expect(lobbyFromGet).toBeNull();
  });
});
