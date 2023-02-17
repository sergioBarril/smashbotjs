const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { Guild } = require("../../models/guild");
const { insertPlayer, Player } = require("../../models/player");
const { Lobby, getLobbyByTextChannel, getLobby } = require("../../models/lobby");
const { LobbyPlayer } = require("../../models/lobbyPlayer");
const {
  getOrCreateGuild,
  getOrCreatePlayer,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
  getOrCreateTier,
} = require("../utils/testingUtils");

afterAll(async () => await db.close());

describe("test Lobby methods", () => {
  let guild;
  const guildDiscordId = "191949144";

  let player;
  const playerDiscordId = "147258369";

  let lobby;
  const mockLobbyStatus = "SEARCHING";
  const mockLobbyMode = "FRIENDLIES";
  const mockLobbyIsRanked = false;

  const mockLobbyTextChannel = "554321";
  const mockLobbyVoiceChannel = "123455";

  beforeEach(async () => {
    guild = await getOrCreateGuild(guildDiscordId);

    player = await getOrCreatePlayer(playerDiscordId);
    lobby = await player.insertLobby(guild.id);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
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

  it("removes other lobbies where the owner of this lobby is, except this one", async () => {
    const player2DiscordId = "9845817";

    const player2 = await insertPlayer(player2DiscordId);
    let lobby2 = await player2.insertLobby(guild.id);

    await lobby2.addPlayer(player.id);
    await lobby.addPlayer(player2.id);

    await lobby2.removeOtherLobbies();

    // Assert lobby is deleted
    lobby = await getLobby(lobby.id);
    expect(lobby).toBeNull();

    lobby = await player.getOwnLobby();
    expect(lobby).toBeNull();

    // Assert lobby2 is intact
    lobby2 = await getLobby(lobby2.id);
    expect(lobby2 instanceof Lobby).toBe(true);

    const lps = await lobby2.getLobbyPlayers();
    expect(lps.length).toEqual(2);
    expect(lps[0] instanceof LobbyPlayer).toBe(true);
    expect(lps[0].playerId).toEqual(player2.id);
    expect(lps[1] instanceof LobbyPlayer).toBe(true);
    expect(lps[1].playerId).toEqual(player.id);

    // Cleanup
    await player2.remove();
  });
});

describe("test lobby.matchmaking() and setupMatch()", () => {
  let guild;
  const guildDiscordId = "191949144";

  let player;
  const playerDiscordId = "147258369";

  let player2;
  const player2DiscordId = "848149";

  let lobby;
  let lobby2;

  let tier3;
  const tier3RoleId = "1949194";
  const tier3ChannelId = "945191";

  let tier4;
  const tier4RoleId = "81845491";
  const tier4ChannelId = "8419419";

  let wifiTier;
  const wifiRoleId = "814381";
  const wifiChannelId = "81954915";

  let yuzuTier;
  const yuzuChannelId = "85915010182";

  beforeEach(async () => {
    guild = await getOrCreateGuild(guildDiscordId);
    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
    tier4 = await getOrCreateTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);
    yuzuTier = await getOrCreateTier(null, yuzuChannelId, guild.id, null, null, true);
    wifiTier = await getOrCreateTier(wifiRoleId, wifiChannelId, guild.id, null, null, false);

    await player.insertRating(guild.id, tier4.id, 1200);

    lobby = await player.insertLobby(guild.id);
    lobby2 = await player2.insertLobby(guild.id);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("returns null if there's only one lobby searching", async () => {
    await player2.remove();
    await lobby.addTiers([tier4]);

    let opponent = await lobby.matchmaking();
    expect(opponent).toBeNull();
  });

  it("returns null if there's another lobby searching, but it's searching on another tier", async () => {
    await lobby.addTiers([tier4]);
    await lobby2.addTiers([tier3]);

    let opponent = await lobby.matchmaking();
    expect(opponent).toBeNull();

    opponent = await lobby2.matchmaking();
    expect(opponent).toBeNull();
  });

  it("returns an opponent if they are searching a tier in common", async () => {
    await lobby.addTiers([tier4, tier3]);
    await lobby2.addTiers([tier3]);

    let opponent = await lobby.matchmaking();

    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player2));

    opponent = await lobby2.matchmaking();
    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player));
  });

  it("returns the opponent searching in the highest tier available, if possible to choose", async () => {
    // Setup
    const player3DiscordId = "9434949";
    let player3 = await getOrCreatePlayer(player3DiscordId);
    const lobby3 = await player3.insertLobby(guild.id);

    await lobby.addTiers([tier4, tier3]);
    await lobby2.addTiers([tier4]);
    await lobby3.addTiers([tier3]);

    let opponent = await lobby.matchmaking();
    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player3));

    // Cleanup
    await deleteIfExistsPlayer(player3DiscordId);
  });

  it("searches only in the given tier if given", async () => {
    // Setup
    const player3DiscordId = "9434949";
    let player3 = await getOrCreatePlayer(player3DiscordId);
    const lobby3 = await player3.insertLobby(guild.id);

    await lobby.addTiers([tier4, tier3]);
    await lobby2.addTiers([tier4]);
    await lobby3.addTiers([tier3]);

    const opponent = await lobby.matchmaking(tier3.id);
    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player3));

    // Cleanup
    await deleteIfExistsPlayer(player3DiscordId);
  });

  it("sets up the match confirmation process", async () => {
    await lobby.addTiers([tier4]);
    await lobby2.addTiers([tier4, tier3]);

    const opponent = await lobby.matchmaking();
    expect(opponent instanceof Player).toBe(true);

    await lobby.setupMatch(opponent);

    lobby = await player.getOwnLobby();
    expect(lobby.status).toBe("CONFIRMATION");

    let lps = await lobby.getLobbyPlayers();
    expect(lps.length).toEqual(2);
    expect(lps[0].playerId).toEqual(player.id);
    expect(lps[0].status).toEqual("CONFIRMATION");
    expect(lps[1].playerId).toEqual(player2.id);
    expect(lps[1].status).toEqual("CONFIRMATION");

    lobby2 = await player2.getOwnLobby();
    expect(lobby2.status).toBe("WAITING");

    lps = await lobby2.getLobbyPlayers();
    expect(lps.length).toEqual(1);
    expect(lps[0].playerId).toEqual(player2.id);
    expect(lps[0].status).toEqual("WAITING");
  });

  it("the opponent must have a lobby", async () => {
    await lobby2.remove();
    await expect(lobby.setupMatch(player2)).rejects.toThrow("matchmakingNoOppLobby");

    lobby = await player.getOwnLobby();
    expect(lobby.status).toEqual("SEARCHING");
    expect((await lobby.getLobbyPlayer(player.id)).status).toEqual("SEARCHING");
  });

  it("can remove the lobby by player", async () => {
    await player.removeOwnLobby();
    const lobbyFromGet = await player.getOwnLobby();
    expect(lobbyFromGet).toBeNull();

    expect(await player.removeOwnLobby()).toBe(false);
  });

  it("can get lobby by player and lobby status", async () => {
    const player2 = await insertPlayer("81481944957234");
    const lobby2 = await player2.insertLobby(guild.id);

    let lobbyFromGet = await player.getLobby("SEARCHING");
    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(JSON.stringify(lobbyFromGet)).toEqual(JSON.stringify(lobby));

    lobbyFromGet = await player.getLobby("CONFIRMATION");
    expect(lobbyFromGet).toBeNull();

    await lobby2.addPlayer(player.id, "CONFIRMATION");
    await lobby2.setStatus("CONFIRMATION");
    await lobby.setStatus("WAITING");

    lobbyFromGet = await player.getLobby("CONFIRMATION");
    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(JSON.stringify(lobbyFromGet)).toEqual(JSON.stringify(lobby2));

    lobbyFromGet = await player.getLobby("WAITING");
    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(JSON.stringify(lobbyFromGet)).toEqual(JSON.stringify(lobby));

    await player2.remove();
  });

  it("priority at matchmaking: tiers > wifi", async () => {
    await lobby2.addTiers([tier4]);
    let opponent = await lobby2.matchmaking();
    expect(opponent).toBeNull();

    const player3DiscordId = "385413";
    const player3 = await getOrCreatePlayer(player3DiscordId);
    const lobby3 = await player3.insertLobby(guild.id);
    await lobby3.addTiers([wifiTier]);

    opponent = await lobby3.matchmaking();
    expect(opponent).toBeNull();

    await lobby.addTiers([wifiTier, tier4]);
    opponent = await lobby.matchmaking();
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player2));
    await player3.remove();
  });

  it("priority at matchmaking: tier 3 > tier 4", async () => {
    await lobby2.addTiers([tier4]);
    let opponent = await lobby2.matchmaking();
    expect(opponent).toBeNull();

    const player3DiscordId = "385413";
    const player3 = await getOrCreatePlayer(player3DiscordId);
    const lobby3 = await player3.insertLobby(guild.id);
    await lobby3.addTiers([tier3]);

    opponent = await lobby3.matchmaking();
    expect(opponent).toBeNull();

    await lobby.addTiers([tier3, tier4]);
    opponent = await lobby.matchmaking();
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player3));
    await player3.remove();
  });

  it("priority at matchmaking: yuzu > tiers", async () => {
    await lobby2.addTiers([tier3]);
    let opponent = await lobby2.matchmaking();
    expect(opponent).toBeNull();

    const player3DiscordId = "385413";
    const player3 = await getOrCreatePlayer(player3DiscordId);
    const lobby3 = await player3.insertLobby(guild.id);
    await player3.insertYuzuPlayer(guild.id, true, true);
    await lobby3.addTiers([yuzuTier]);

    opponent = await lobby3.matchmaking();
    expect(opponent).toBeNull();

    await player.insertYuzuPlayer(guild.id, false, true);
    await lobby.addTiers([tier3, yuzuTier]);
    opponent = await lobby.matchmaking();
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player3));
    await player3.remove();
  });
});
