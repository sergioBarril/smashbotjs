const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { search } = require("../../../api/lobby");
const { insertPlayer, getPlayer } = require("../../../models/player");
const { getGuild, insertGuild } = require("../../../models/guild");
const { getMessage, insertMessage, MESSAGE_TYPES } = require("../../../models/message");
const { getTierByRole, insertTier } = require("../../../models/tier");
const { NotFoundError } = require("../../../errors/notFound");
const { MessageTypeError } = require("../../../errors/messageType");

afterAll(async () => await db.close());

describe("test search method", () => {
  let guild;

  let player;
  let player2;

  let tier3;
  let tier4;

  let message;
  let message3;

  let rating;
  let rating2;

  const mockGuildDiscordId = "4851785";
  const searchChannelId = "89518951";

  const mockPlayerDiscordId = "12489124";
  const mockPlayer2DiscordId = "8514781";

  const tier4RoleId = "814184";
  const tier4ChannelId = "89518518";

  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  const searchMessageDiscordId = "85184149";
  const searchMessage3DiscordId = "451959442312";

  beforeEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    player2 = await getPlayer(mockPlayer2DiscordId, true);
    if (!player2) player2 = await insertPlayer(mockPlayer2DiscordId);

    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    guild.setMatchmakingChannel(searchChannelId);

    tier4 = await getTierByRole(tier4RoleId);
    if (!tier4) tier4 = await insertTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);

    tier3 = await getTierByRole(tier3RoleId);
    if (!tier3) tier3 = await insertTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);

    rating = await player.insertRating(guild.id, tier3.id, 1785);
    rating2 = await player2.insertRating(guild.id, tier4.id, 1300);

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
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    player2 = await getPlayer(mockPlayer2DiscordId, true);
    if (player2) await player2.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();

    message = await getMessage(searchMessageDiscordId, true);
    if (message) await message.remove();

    message3 = await getMessage(searchMessage3DiscordId, true);
    if (message3) await message3.remove();
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(search(null, guild.discordId, message.discordId)).rejects.toThrow(NotFoundError);
    await player.remove();
    await expect(search(player.discordId, guild.discordId, message.discordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws NotFoundError if guild's null / not found", async () => {
    await expect(search(player.discordId, null, message.discordId)).rejects.toThrow(NotFoundError);
    await guild.remove();
    await expect(search(player.discordId, guild.discordId, message.discordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws NotFoundError if message's tier isnot found", async () => {
    await message.remove();
    await expect(search(player.discordId, guild.discordId, message.discordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws MessageTypeError if the message is not from type GUILD_TIER_SEARCH", async () => {
    await message.remove();
    message = await insertMessage(searchMessageDiscordId, MESSAGE_TYPES.LOBBY_PLAYER);

    await expect(search(player.discordId, guild.discordId, message.discordId)).rejects.toThrow(
      MessageTypeError
    );
  });

  it("throw NotFoundError if the player doesn't have a tier and is searching for a tier", async () => {
    await rating.remove();
    await expect(search(player.discordId, guild.discordId, message.discordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("search works fine. no yuzu. no previous lobby created, no match", async () => {
    const result = await search(player.discordId, guild.discordId, message.discordId);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toEqual(1);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(tier4));
  });

  it("search. no yuzu. no previous lobby created, matched", async () => {
    await search(player.discordId, guild.discordId, message.discordId);

    const result = await search(player2.discordId, guild.discordId, message.discordId);
    expect(result.matched).toBe(true);
    expect(result.players.length).toBe(2);
    expect(JSON.stringify(result.players[0])).toEqual(JSON.stringify(player2));
    expect(JSON.stringify(result.players[1])).toEqual(JSON.stringify(player));
  });

  it("search. no yuzu. previous lobby created, no matched, added tier", async () => {
    await search(player.discordId, guild.discordId, message.discordId);
    const result = await search(player.discordId, guild.discordId, message3.discordId);

    expect(result.matched).toBe(false);
    expect(result.tiers.length).toEqual(1);
    expect(JSON.stringify(result.tiers[0])).toEqual(JSON.stringify(tier3));
  });

  it.todo("search, yuzu.");
  it.todo("search, already playing / confirmation");
});
