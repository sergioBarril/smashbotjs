const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { getAllGuilds, Guild, insertGuild, getGuild } = require("../../models/guild");
const { getPlayer, insertPlayer, Player } = require("../../models/player");
const { Lobby, getLobbyByTextChannel, getLobby } = require("../../models/lobby");
const { LobbyPlayer } = require("../../models/lobbyPlayer");
const { getTierByRole, insertTier } = require("../../models/tier");

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

  it("removes other lobbies where the owner of this lobby is, except this one", async () => {
    const secondPlayerDiscordId = "9845817";

    const secondPlayer = await insertPlayer(secondPlayerDiscordId);
    let secondLobby = await secondPlayer.insertLobby(guild.id);

    await secondLobby.addPlayer(player.id);
    await lobby.addPlayer(secondPlayer.id);

    await secondLobby.removeOtherLobbies();

    // Assert lobby is deleted
    lobby = await getLobby(lobby.id);
    expect(lobby).toBeNull();

    lobby = await player.getOwnLobby();
    expect(lobby).toBeNull();

    // Assert secondLobby is intact
    secondLobby = await getLobby(secondLobby.id);
    expect(secondLobby instanceof Lobby).toBe(true);

    const lps = await secondLobby.getLobbyPlayers();
    expect(lps.length).toEqual(2);
    expect(lps[0] instanceof LobbyPlayer).toBe(true);
    expect(lps[0].playerId).toEqual(secondPlayer.id);
    expect(lps[1] instanceof LobbyPlayer).toBe(true);
    expect(lps[1].playerId).toEqual(player.id);

    // Cleanup
    await secondPlayer.remove();
  });
});

describe("test lobby.matchmaking() and setupMatch()", () => {
  let guild;
  let player;
  let secondPlayer;
  let lobby;
  let secondLobby;
  let tier;

  const mockPlayerDiscordId = "147258369";
  const secondPlayerDiscordId = "848149";

  const mockGuildDiscordId = "191949144";

  const mockTierDiscordId = "81845491";
  const mockTierWeight = 4;

  const secondTierDiscordId = "1949194";
  const secondTierWeight = 3;

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    tier = await getTierByRole(mockTierDiscordId);
    if (!tier)
      tier = await insertTier(mockTierDiscordId, null, guild.id, mockTierWeight, 2100, false);

    await player.insertRating(guild.id, tier.id, 1200);

    lobby = await player.getOwnLobby();
    if (!lobby) lobby = await player.insertLobby(guild.id);

    // Second
    secondPlayer = await getPlayer(secondPlayerDiscordId, true);
    if (!secondPlayer) secondPlayer = await insertPlayer(secondPlayerDiscordId);

    secondLobby = await secondPlayer.getOwnLobby();
    if (!secondLobby) secondLobby = await secondPlayer.insertLobby(guild.id);

    secondTier = await getTierByRole(secondTierDiscordId);
    if (!secondTier)
      secondTier = await insertTier(
        secondTierDiscordId,
        null,
        guild.id,
        secondTierWeight,
        4000,
        false
      );
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    secondPlayer = await getPlayer(secondPlayerDiscordId, true);
    if (secondPlayer) await secondPlayer.remove();
    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("returns null if there's only one lobby searching", async () => {
    await secondPlayer.remove();
    await lobby.addTiers([tier]);

    let opponent = await lobby.matchmaking();
    expect(opponent).toBeNull();
  });

  it("returns null if there's another lobby searching, but it's searching on another tier", async () => {
    await lobby.addTiers([tier]);
    await secondLobby.addTiers([secondTier]);

    let opponent = await lobby.matchmaking();
    expect(opponent).toBeNull();

    opponent = await secondLobby.matchmaking();
    expect(opponent).toBeNull();
  });

  it("returns an opponent if they are searching a tier in common", async () => {
    await lobby.addTiers([tier, secondTier]);
    await secondLobby.addTiers([secondTier]);

    let opponent = await lobby.matchmaking();

    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(secondPlayer));

    opponent = await secondLobby.matchmaking();
    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(player));
  });

  it("returns the opponent searching in the highest tier available, if possible to choose", async () => {
    // Setup
    const thirdPlayerId = "9434949";
    let thirdPlayer = await getPlayer(thirdPlayerId, true);
    if (!thirdPlayer) thirdPlayer = await insertPlayer(thirdPlayerId);

    const thirdLobby = await thirdPlayer.insertLobby(guild.id);

    await lobby.addTiers([tier, secondTier]);
    await secondLobby.addTiers([tier]);
    await thirdLobby.addTiers([secondTier]);

    let opponent = await lobby.matchmaking();
    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(thirdPlayer));

    // Cleanup
    await thirdPlayer.remove();
  });

  it("searches only in the given tier if given", async () => {
    // Setup
    const thirdPlayerId = "9434949";
    let thirdPlayer = await getPlayer(thirdPlayerId, true);
    if (!thirdPlayer) thirdPlayer = await insertPlayer(thirdPlayerId);

    const thirdLobby = await thirdPlayer.insertLobby(guild.id);

    await lobby.addTiers([tier, secondTier]);
    await secondLobby.addTiers([tier]);
    await thirdLobby.addTiers([secondTier]);

    const opponent = await lobby.matchmaking(secondTier.id);
    expect(opponent).not.toBeNull();
    expect(opponent instanceof Player).toBe(true);
    expect(JSON.stringify(opponent)).toEqual(JSON.stringify(thirdPlayer));

    // Cleanup
    await thirdPlayer.remove();
  });

  it.todo("can search in yuzu");

  it.todo("yuzu takes preference over tiers");

  it.todo("tiers take preference over wifi");

  it("sets up the match confirmation process", async () => {
    await lobby.addTiers([tier]);
    await secondLobby.addTiers([tier, secondTier]);

    const opponent = await lobby.matchmaking();
    expect(opponent instanceof Player).toBe(true);

    const isSetUp = await lobby.setupMatch(opponent);
    expect(isSetUp).toBe(true);

    lobby = await player.getOwnLobby();
    expect(lobby.status).toBe("CONFIRMATION");

    let lps = await lobby.getLobbyPlayers();
    expect(lps.length).toEqual(2);
    expect(lps[0].playerId).toEqual(player.id);
    expect(lps[0].status).toEqual("CONFIRMATION");
    expect(lps[1].playerId).toEqual(secondPlayer.id);
    expect(lps[1].status).toEqual("CONFIRMATION");

    secondLobby = await secondPlayer.getOwnLobby();
    expect(secondLobby.status).toBe("WAITING");

    lps = await secondLobby.getLobbyPlayers();
    expect(lps.length).toEqual(1);
    expect(lps[0].playerId).toEqual(secondPlayer.id);
    expect(lps[0].status).toEqual("WAITING");
  });

  it("the opponent must have a lobby", async () => {
    await secondLobby.remove();
    await expect(lobby.setupMatch(secondPlayer)).rejects.toThrow("matchmakingNoOppLobby");

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
});
