const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { isSearching } = require("../../../api/lobby");
const { Tier } = require("../../../models/tier");
const { NotFoundError } = require("../../../errors/notFound");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  getOrCreateTier,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");

afterAll(async () => await db.close());

describe("test lobbyAPI.isSearching() function", () => {
  let guild;
  const guildDiscordId = "4851785";

  let player;
  const playerDiscordId = "12489124";

  let lobby;

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  let tier4;
  const tier4RoleId = "814184";
  const tier4ChannelId = "89518518";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    lobby = await player.insertLobby(guild.id);

    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
    tier4 = await getOrCreateTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(isSearching(null)).rejects.toThrow(new NotFoundError("Player"));
    await player.remove();
    await expect(isSearching(playerDiscordId)).rejects.toThrow(new NotFoundError("Player"));
  });

  it("returns true if the player is searching", async () => {
    await lobby.addTiers([tier3, tier4]);

    const result = await isSearching(playerDiscordId);
    expect(result).toBe(true);
  });

  it("returns false if the player is not searching", async () => {
    await lobby.addTiers([tier3, tier4]);

    const result = await isSearching(playerDiscordId);
    expect(result).toBe(true);
  });
});
