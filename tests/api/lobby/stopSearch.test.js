const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { search, stopSearch } = require("../../../api/lobby");
const { insertPlayer, getPlayer } = require("../../../models/player");
const { getGuild } = require("../../../models/guild");
const { getMessage, insertMessage, MESSAGE_TYPES, Message } = require("../../../models/message");
const { NotFoundError } = require("../../../errors/notFound");
const { MessageTypeError } = require("../../../errors/messageType");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  getOrCreateTier,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { Tier } = require("../../../models/tier");
const { CannotSearchError } = require("../../../errors/cannotSearch");
const { NotSearchingError } = require("../../../errors/notSearching");

afterAll(async () => await db.close());

describe("test search method", () => {
  let guild;
  const guildDiscordId = "4851785";
  const searchChannelId = "89518951";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "8514781";

  let lobby;

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  let tier4;
  const tier4RoleId = "814184";
  const tier4ChannelId = "89518518";

  let message;
  const searchMessageDiscordId = "85184149";

  let message3;
  const searchMessage3DiscordId = "451959442312";

  let ltMessage3;
  const ltMessage3DiscordId = "84134818";

  let ltMessage4;
  const ltMessage4DiscordId = "84134839438";

  let rating;

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    lobby = await player.insertLobby(guild.id);

    guild.setMatchmakingChannel(searchChannelId);

    tier4 = await getOrCreateTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);
    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);

    rating = await player.insertRating(guild.id, tier3.id, 1785);

    message = await getMessage(searchMessageDiscordId, true);
    if (!message)
      message = await insertMessage(
        searchMessageDiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        tier4.id
      );

    message3 = await getMessage(searchMessage3DiscordId, true);
    if (!message3)
      message3 = await insertMessage(
        searchMessage3DiscordId,
        MESSAGE_TYPES.GUILD_TIER_SEARCH,
        tier3.id
      );

    ltMessage3 = await getMessage(ltMessage3DiscordId, true);
    if (!ltMessage3)
      ltMessage3 = await insertMessage(
        ltMessage3DiscordId,
        MESSAGE_TYPES.LOBBY_TIER,
        tier3.id,
        tier3ChannelId,
        player.id,
        guild.id,
        lobby.id,
        false
      );

    ltMessage4 = await getMessage(ltMessage4DiscordId, true);
    if (!ltMessage4)
      ltMessage4 = await insertMessage(
        ltMessage4DiscordId,
        MESSAGE_TYPES.LOBBY_TIER,
        tier4.id,
        tier4ChannelId,
        player.id,
        guild.id,
        lobby.id,
        false
      );
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);

    message = await getMessage(searchMessageDiscordId, true);
    if (message) await message.remove();

    message3 = await getMessage(searchMessage3DiscordId, true);
    if (message3) await message3.remove();
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(stopSearch(null, message.discordId)).rejects.toThrow(new NotFoundError("Player"));
    await player.remove();
    await expect(stopSearch(player.discordId, message.discordId)).rejects.toThrow(
      new NotFoundError("Player", null, player.discordId)
    );
  });

  it("throws NotFoundError if message's tier isnot found", async () => {
    await message.remove();
    await expect(stopSearch(player.discordId, message.discordId)).rejects.toThrow(
      new NotFoundError("TierMessage")
    );
  });

  it("throws CannotSearchError('PLAYING', 'CANCEL') if already playing", async () => {
    await lobby.remove();

    const lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "PLAYING");
    await lobby2.addPlayer(player.id);
    await lobby2.setLobbyPlayersStatus("PLAYING");

    await expect(stopSearch(player2DiscordId, message3.discordId)).rejects.toThrow(
      new CannotSearchError("PLAYING", "CANCEL")
    );

    await expect(stopSearch(playerDiscordId, message3.discordId)).rejects.toThrow(
      new CannotSearchError("PLAYING", "CANCEL")
    );
  });

  it("throws CannotSearchError('CONFIRMATION', 'CANCEL') if already matched", async () => {
    await lobby.setStatus("CONFIRMATION");
    await lobby.addPlayer(player2.id);
    await lobby.setLobbyPlayersStatus("CONFIRMATION");

    const lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "WAITING");
    await lobby2.setLobbyPlayersStatus("WAITING");

    await expect(stopSearch(player2DiscordId, message3.discordId)).rejects.toThrow(
      new CannotSearchError("WAITING", "CANCEL")
    );

    await expect(stopSearch(playerDiscordId, message3.discordId)).rejects.toThrow(
      new CannotSearchError("CONFIRMATION", "CANCEL")
    );
  });

  it("throws NotSearchingError if trying to stop searching where not searching", async () => {
    await expect(stopSearch(playerDiscordId, message3.discordId)).rejects.toThrow(
      new NotSearchingError(tier3.roleId, tier3.yuzu)
    );

    await expect(stopSearch(playerDiscordId, null)).rejects.toThrow(
      new NotSearchingError(null, null)
    );
  });

  it("can stop one single tier", async () => {
    await lobby.addTiers([tier3, tier4]);

    const result = await stopSearch(playerDiscordId, message3.discordId);
    expect(result).not.toBeNull();

    expect(result.isSearching).toBe(true);
    expect(result.messages.length).toBe(1);
    const message = result.messages[0];
    expect(message instanceof Message).toBe(true);
    expect(JSON.stringify(message)).toEqual(JSON.stringify(ltMessage3));

    expect(result.tiers.length).toBe(1);
    const tier = result.tiers[0];
    expect(tier instanceof Tier).toBe(true);
    expect(JSON.stringify(tier)).toEqual(JSON.stringify(tier3));
  });

  it("can stop all tiers", async () => {
    await lobby.addTiers([tier3, tier4]);

    const result = await stopSearch(playerDiscordId, null);
    expect(result).not.toBeNull();

    expect(result.isSearching).toBe(false);
    expect(result.messages.length).toBe(2);
    expect(result.messages.every((message) => message instanceof Message)).toBe(true);
    expect(
      result.messages.some((message) => JSON.stringify(message) === JSON.stringify(ltMessage3))
    ).toBe(true);
    expect(
      result.messages.some((message) => JSON.stringify(message) === JSON.stringify(ltMessage4))
    ).toBe(true);

    expect(result.tiers.length).toBe(2);
    expect(result.tiers.every((tier) => tier instanceof Tier)).toBe(true);
    expect(result.tiers.some((tier) => JSON.stringify(tier) === JSON.stringify(tier3))).toBe(true);
    expect(result.tiers.some((tier) => JSON.stringify(tier) === JSON.stringify(tier4))).toBe(true);
  });
});
