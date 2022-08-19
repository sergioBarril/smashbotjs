const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { search, directMatch } = require("../../../api/lobby");
const { getMessage, insertMessage, MESSAGE_TYPES } = require("../../../models/message");
const { NotFoundError } = require("../../../errors/notFound");
const { MessageTypeError } = require("../../../errors/messageType");
const { AlreadySearchingError } = require("../../../errors/alreadySearching");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  getOrCreateTier,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { TooNoobError } = require("../../../errors/tooNoob");
const { NoCableError } = require("../../../errors/noCable");
const { CannotSearchError } = require("../../../errors/cannotSearch");
const { NoYuzuError } = require("../../../errors/noYuzu");
const { InvalidMessageTypeError } = require("../../../errors/invalidMessageType");
const { InvalidLobbyStatusError } = require("../../../errors/invalidLobbyStatus");
const { SamePlayerError } = require("../../../errors/samePlayer");

afterAll(async () => await db.close());

describe("test lobbyAPI.directMatch() method", () => {
  let guild;
  const guildDiscordId = "4851785";
  const searchChannelId = "89518951";
  const yuzuRoleId = "81491912930";
  const parsecRoleId = "189141282";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "8514781";

  let lobby, lobby2;

  let wifiTier;
  const wifiRoleId = "814381";
  const wifiChannelId = "81954915";

  let yuzuTier;
  const yuzuChannelId = "85915010182";

  let tier2;
  const tier2RoleId = "8518519";
  const tier2ChannelId = "859100404";

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  let tier4;
  const tier4RoleId = "814184";
  const tier4ChannelId = "89518518";

  let messageLt2;
  const messageLt2DiscordId = "45195945123";
  let messageLt3;
  const messageLt3DiscordId = "451959442312";
  let messageLt4;
  const messageLt4DiscordId = "85184149";
  let messageLtYuzu;
  const messageLtYuzuDiscordId = "851010323";
  let messageLtWifi;
  const messageLtWifiDiscordId = "8144912";

  let rating;

  beforeEach(async () => {
    jest.setTimeout(55000);

    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    guild = await getOrCreateGuild(guildDiscordId);
    await guild.setMatchmakingChannel(searchChannelId);
    await guild.setYuzuRole(yuzuRoleId);
    await guild.setParsecRole(parsecRoleId);

    tier2 = await getOrCreateTier(tier2RoleId, tier2ChannelId, guild.id, 2, 2100, false);
    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
    tier4 = await getOrCreateTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);
    yuzuTier = await getOrCreateTier(null, yuzuChannelId, guild.id, null, null, true);
    wifiTier = await getOrCreateTier(wifiRoleId, wifiChannelId, guild.id, null, null, false);

    rating = await player.insertRating(guild.id, tier3.id, 1785);

    lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "SEARCHING", false);

    await lobby2.addTiers([tier2, tier3, wifiTier]);

    const lt2 = await lobby2.getLobbyTier(tier2.id);
    messageLt2 = await lt2.insertMessage(messageLt2DiscordId);

    const lt3 = await lobby2.getLobbyTier(tier3.id);
    messageLt3 = await lt3.insertMessage(messageLt3DiscordId);

    const ltWifi = await lobby2.getLobbyTier(wifiTier.id);
    messageLtWifi = await ltWifi.insertMessage(messageLtWifiDiscordId);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(directMatch(null, messageLt3.discordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
    await player.remove();
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
  });

  it("throws NotFoundError if message isnot found", async () => {
    await messageLt3.remove();
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new NotFoundError("Message")
    );
  });

  it("throws MessageTypeError if the message is not from type LOBBY_TIER", async () => {
    await messageLt3.setType(MESSAGE_TYPES.GUILD_TIER_SEARCH);
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new InvalidMessageTypeError(MESSAGE_TYPES.GUILD_TIER_SEARCH, MESSAGE_TYPES.LOBBY_TIER)
    );
  });

  test("throws InvalidLobbyStatusError if rival is not searching", async () => {
    await lobby2.setStatus("CONFIRMATION");
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new InvalidLobbyStatusError("CONFIRMATION", "SEARCHING")
    );
  });

  test("throws SamePlayerError if directMatching with the lobby creator", async () => {
    await expect(directMatch(player2.discordId, messageLt3.discordId)).rejects.toThrow(
      new SamePlayerError()
    );
  });

  test("throws NotFound(tier) if player has no rating", async () => {
    await rating.remove();
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new NotFoundError("Tier")
    );
  });

  test("throws TooNoobError if player doesn't have a high enough tier", async () => {
    await expect(directMatch(player.discordId, messageLt2.discordId)).rejects.toThrow(
      new TooNoobError(tier3.id, tier2.id)
    );
  });

  test("throws CannotSearchError if already playing or matching", async () => {
    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "PLAYING");
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new CannotSearchError("PLAYING", "SEARCH")
    );
    await lobby.setStatus("CONFIRMATION");
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new CannotSearchError("CONFIRMATION", "SEARCH")
    );
    await lobby.setStatus("WAITING");
    await expect(directMatch(player.discordId, messageLt3.discordId)).rejects.toThrow(
      new CannotSearchError("WAITING", "SEARCH")
    );
  });

  test("correctly matched", async () => {
    const result = await directMatch(player.discordId, messageLt3.discordId);
    expect(result.matched).toBe(true);
    expect(result.players.length).toBe(2);
    expect(result.players.some((p) => p.id == player.id)).toBe(true);
    expect(result.players.some((p) => p.id == player2.id)).toBe(true);
  });

  test("search while being AFK", async () => {
    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "AFK", false);
    const lp = await lobby.getLobbyPlayer(player.id);
    await lp.setStatus("AFK");

    const afkMessageId = "94194";
    const afkMessage = await lp.insertMessage(afkMessageId);
    await afkMessage.setType(MESSAGE_TYPES.LOBBY_PLAYER_AFK);

    const result = await directMatch(player.discordId, messageLt3.discordId);

    expect(result.afkMessage).not.toBeNull();
    expect(result.matched).toBe(true);

    const messageFromGet = await getMessage(afkMessageId, true);
    expect(messageFromGet).toBeNull();
  });
});
