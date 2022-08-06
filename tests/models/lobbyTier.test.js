const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { getGuild, insertGuild } = require("../../models/guild");
const { getPlayer, insertPlayer } = require("../../models/player");
const { getTier, insertTier, Tier } = require("../../models/tier");
const { LobbyTier } = require("../../models/lobbyTier");
const { Lobby } = require("../../models/lobby");
const { Message, MESSAGE_TYPES } = require("../../models/message");

afterAll(async () => await db.close());

describe("test Lobby methods", () => {
  let guild;
  let player;
  let lobby;
  let tier;
  let lobbyTiers;
  let lobbyTier;

  const mockGuildDiscordId = "843516697";
  const mockPlayerDiscordId = "147258369";
  const mockTierDiscordId = "812381231";

  const mockChannelDiscordId = "81238189191";

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    lobby = await player.getOwnLobby();
    if (!lobby) lobby = await player.insertLobby(guild.id);

    tier = await getTier(mockTierDiscordId);
    if (!tier)
      tier = await insertTier(mockTierDiscordId, mockChannelDiscordId, guild.id, 1, 2100, false);

    lobbyTiers = await lobby.addTiers([tier]);
    lobbyTier = lobbyTiers[0];
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new lobbyTier", async () => {
    expect(lobbyTier).not.toBe(null);
    expect(lobbyTier instanceof LobbyTier).toBe(true);
    expect(lobbyTier.lobbyId).toEqual(lobby.id);
    expect(lobbyTier.tierId).toEqual(tier.id);
    expect(lobbyTier.createdAt instanceof Date).toBe(true);
  });

  it("cascades delete if lobby is deleted", async () => {
    const numRows = await db.countRows("lobby_tier");
    await lobby.remove();
    const finalNumRows = await db.countRows("lobby_tier");
    expect(finalNumRows).toEqual(numRows - 1);
  });

  it("can check if a lobby is searching in a given tier", async () => {
    let hasTier = await lobby.hasTier(null);
    expect(hasTier).toBe(false);

    hasTier = await lobby.hasTier(tier.id);
    expect(hasTier).toBe(true);
  });

  it("can check if a lobby is searching in any tier", async () => {
    let hasAnyTier = await lobby.hasAnyTier();
    expect(hasAnyTier).toBe(true);

    await lobbyTier.remove();

    hasAnyTier = await lobby.hasAnyTier();
    expect(hasAnyTier).toBe(false);
  });

  it("can get lobby tier by lobby and tier", async () => {
    let lt = await lobby.getLobbyTier(tier.id);
    expect(lt instanceof LobbyTier).toBe(true);
    expect(JSON.stringify(lt)).toEqual(JSON.stringify(lobbyTier));

    lt = await lobby.getLobbyTier(8118431);
    expect(lt).toBeNull();
  });

  it("can get the tier", async () => {
    const tierFromGet = await lobbyTier.getTier();
    expect(tierFromGet).not.toBeNull();
    expect(tierFromGet instanceof Tier).toBe(true);
    expect(JSON.stringify(tierFromGet)).toEqual(JSON.stringify(tier));
  });

  it("can get the lobby", async () => {
    const lobbyFromGet = await lobbyTier.getLobby();
    expect(lobbyFromGet).not.toBeNull();
    expect(lobbyFromGet instanceof Lobby).toBe(true);
    expect(JSON.stringify(lobbyFromGet)).toEqual(JSON.stringify(lobby));
  });

  it("can insert the lobbyTier message", async () => {
    let messageFromGet = await lobbyTier.getMessage();
    expect(messageFromGet).toBeNull();

    const messageDiscordId = "48958";
    const message = await lobbyTier.insertMessage(messageDiscordId);

    expect(message).not.toBe(null);
    expect(message instanceof Message).toBe(true);
    expect(message.discordId).toBe(messageDiscordId);
    expect(message.type).toBe(MESSAGE_TYPES.LOBBY_TIER);
    expect(message.tierId).toBe(lobbyTier.tierId);
    expect(message.lobbyId).toBe(lobbyTier.lobbyId);

    // Test get
    messageFromGet = await lobbyTier.getMessage();
    expect(messageFromGet instanceof Message).toBe(true);
    expect(JSON.stringify(messageFromGet)).toEqual(JSON.stringify(message));
  });
});
