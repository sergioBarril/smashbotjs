const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { getSearchingTiers } = require("../../../api/lobby");
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

describe("test search method", () => {
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
    await expect(getSearchingTiers(null)).rejects.toThrow(NotFoundError);
    await player.remove();
    await expect(getSearchingTiers(playerDiscordId)).rejects.toThrow(NotFoundError);
  });

  it("returns a list of the tiers where the player is searching", async () => {
    await lobby.addTiers([tier3, tier4]);

    const tiers = await getSearchingTiers(playerDiscordId);
    expect(tiers.length).toEqual(2);
    expect(tiers.every((tier) => tier instanceof Tier)).toEqual(true);
  });

  it("returns an empty list if not searching anywhere", async () => {
    const tiers = await getSearchingTiers(playerDiscordId);
    expect(tiers.length).toEqual(0);
  });
});
