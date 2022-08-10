const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { search } = require("../../../api/lobby");
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

afterAll(async () => await db.close());

describe("test search method", () => {
  let guild;
  const guildDiscordId = "4851785";
  const searchChannelId = "89518951";
  const yuzuRoleId = "81491912930";
  const parsecRoleId = "189141282";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "8514781";

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

  let message2;
  const searchMessage2DiscordId = "45195945123";
  let message3;
  const searchMessage3DiscordId = "451959442312";
  let message4;
  const searchMessage4DiscordId = "85184149";
  let messageYuzu;
  const searchMessageYuzuDiscordId = "851010323";
  let messageWifi;
  const searchMessageWifiDiscordId = "8144912";

  let rating;
  let rating2;

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
    rating2 = await player2.insertRating(guild.id, tier4.id, 1300);

    message2 = await getMessage(searchMessage2DiscordId, true);
    if (!message2)
      message2 = await insertMessage(
        searchMessage2DiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        tier2.id
      );

    message3 = await getMessage(searchMessage3DiscordId, true);
    if (!message3)
      message3 = await insertMessage(
        searchMessage3DiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        tier3.id
      );

    message4 = await getMessage(searchMessage4DiscordId, true);
    if (!message4)
      message4 = await insertMessage(
        searchMessage4DiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        tier4.id
      );

    messageYuzu = await getMessage(searchMessageYuzuDiscordId, true);
    if (!messageYuzu)
      messageYuzu = await insertMessage(
        searchMessageYuzuDiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        yuzuTier.id
      );

    messageWifi = await getMessage(searchMessageWifiDiscordId, true);
    if (!messageWifi)
      messageWifi = await insertMessage(
        searchMessageWifiDiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        wifiTier.id
      );
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);

    message2 = await getMessage(searchMessage2DiscordId, true);
    if (message2) await message2.remove();

    message3 = await getMessage(searchMessage3DiscordId, true);
    if (message3) await message3.remove();

    message4 = await getMessage(searchMessage4DiscordId, true);
    if (message4) await message4.remove();
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(search(null, guild.discordId, message4.discordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
    await player.remove();
    await expect(search(player.discordId, guild.discordId, message4.discordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
  });

  it("throws NotFoundError if guild's null / not found", async () => {
    await expect(search(player.discordId, null, message4.discordId)).rejects.toThrow(
      new NotFoundError("Guild")
    );
    await guild.remove();
    await expect(search(player.discordId, guild.discordId, message4.discordId)).rejects.toThrow(
      new NotFoundError("Guild")
    );
  });

  it("throws NotFoundError if message's tier isnot found", async () => {
    await message4.remove();
    await expect(search(player.discordId, guild.discordId, message4.discordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws MessageTypeError if the message is not from type GUILD_TIER_SEARCH", async () => {
    await message4.remove();
    message = await insertMessage(searchMessage4DiscordId, MESSAGE_TYPES.LOBBY_PLAYER);

    await expect(search(player.discordId, guild.discordId, message4.discordId)).rejects.toThrow(
      MessageTypeError
    );
  });

  it("throw NotFoundError if the player doesn't have a tier and is searching for a tier", async () => {
    await rating.remove();
    await expect(search(player.discordId, guild.discordId, message4.discordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throw TooNoobError if the player doesn't have a high enough tier", async () => {
    await expect(search(playerDiscordId, guildDiscordId, message2.discordId)).rejects.toThrow(
      TooNoobError
    );
  });

  it("throw NoCableError if the player has a rating, but without a Cabled tier, and searches All", async () => {
    await rating.remove();
    await player.insertRating(guild.id, wifiTier.id, null);

    await expect(search(playerDiscordId, guildDiscordId, null)).rejects.toThrow(NoCableError);
  });

  it("throw CannotSearchError('PLAYING', 'SEARCH') if already playing", async () => {
    const lobby = await player2.insertLobby(guild.id, "FRIENDLIES", "PLAYING");
    await lobby.addPlayer(player.id);
    await lobby.setLobbyPlayersStatus("PLAYING");

    await expect(search(playerDiscordId, guildDiscordId, message4.discordId)).rejects.toThrow(
      new CannotSearchError("PLAYING", "SEARCH")
    );
  });

  it("throw CannotSearchError('CONFIRMATION', 'SEARCH') if already matched", async () => {
    const lobby = await player.insertLobby(guild.id, "FRIENDLIES", "CONFIRMATION");
    const lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "WAITING");

    await lobby.addPlayer(player2.id);
    await lobby2.addPlayer(player.id);

    await lobby.setLobbyPlayersStatus("CONFIRMATION");
    await lobby.setLobbyPlayersStatus("WAITING");

    await expect(search(playerDiscordId, guildDiscordId, message4.discordId)).rejects.toThrow(
      new CannotSearchError("CONFIRMATION", "SEARCH")
    );

    await expect(search(player2DiscordId, guildDiscordId, message4.discordId)).rejects.toThrow(
      new CannotSearchError("WAITING", "SEARCH")
    );
  });

  it("search works fine. no yuzu. no previous lobby created, no match", async () => {
    const result = await search(player.discordId, guild.discordId, message4.discordId);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toEqual(1);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(tier4));
  });

  it("search. no yuzu. no previous lobby created, matched", async () => {
    await search(player.discordId, guild.discordId, message4.discordId);

    const result = await search(player2.discordId, guild.discordId, message4.discordId);
    expect(result.matched).toBe(true);
    expect(result.players.length).toBe(2);
    expect(JSON.stringify(result.players[0])).toEqual(JSON.stringify(player2));
    expect(JSON.stringify(result.players[1])).toEqual(JSON.stringify(player));
  });

  it("search. no yuzu. previous lobby created, no matched, added tier", async () => {
    await search(player.discordId, guild.discordId, message4.discordId);
    const result = await search(player.discordId, guild.discordId, message3.discordId);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toEqual(1);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(tier3));
  });

  it("search all", async () => {
    const result = await search(player.discordId, guild.discordId, null);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toEqual(2);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(tier3));
    expect(JSON.stringify(result.tiers[1])).toEqual(JSON.stringify(tier4));
  });

  it("throws an error if searching on a tier where already searching", async () => {
    await search(player.discordId, guild.discordId, message4.discordId);
    await expect(search(player.discordId, guild.discordId, message4.discordId)).rejects.toThrow(
      AlreadySearchingError
    );
  });

  it("throws NoYuzuError if the player doesn't have their YuzuPlayer with at least some role", async () => {
    await expect(search(player.discordId, guild.discordId, messageYuzu.discordId)).rejects.toThrow(
      new NoYuzuError(guild.yuzuRoleId, guild.parsecRoleId)
    );

    await player.insertYuzuPlayer(guild.id, false, false);

    await expect(search(player.discordId, guild.discordId, messageYuzu.discordId)).rejects.toThrow(
      new NoYuzuError(guild.yuzuRoleId, guild.parsecRoleId)
    );
  });

  it("searches in yuzu. no previous lobby", async () => {
    await player.insertYuzuPlayer(guild.id, false, true); // Only parsec
    const result = await search(player.discordId, guild.discordId, messageYuzu.discordId);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toBe(1);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(yuzuTier));
  });

  it("searches in yuzu, previous lobby", async () => {
    await player.insertYuzuPlayer(guild.id, false, true);

    await search(player.discordId, guild.discordId, message4.discordId);
    const result = await search(player.discordId, guild.discordId, messageYuzu.discordId);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toBe(1);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(yuzuTier));
  });
});
