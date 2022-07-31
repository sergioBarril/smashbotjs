const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertTier, getTier, Tier, getTierByChannel, getTierByRole } = require("../../models/tier");
const { insertGuild, getGuild } = require("../../models/guild");
const { insertMessage, Message } = require("../../models/message");

afterAll(async () => await db.close());

describe("test Tier methods", () => {
  let tier;
  let guild;

  const mockTierDiscordId = "8484813";
  const mockGuildDiscordId = "843516697";

  const mockChannelId = "9104810";
  const mockWeight = 1;
  const mockThreshold = 2100;

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    tier = await getTierByRole(mockTierDiscordId);
    if (!tier)
      tier = await insertTier(
        mockTierDiscordId,
        mockChannelId,
        guild.id,
        mockWeight,
        mockThreshold,
        false
      );
  });

  afterEach(async () => {
    tier = await getTierByRole(mockTierDiscordId);
    if (tier) await tier.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new tier", async () => {
    expect(tier).not.toBeNull();
    expect(tier instanceof Tier).toBe(true);

    expect(tier.roleId).toEqual(mockTierDiscordId);
    expect(tier.channelId).toEqual(mockChannelId);
    expect(tier.guildId).toEqual(guild.id);
    expect(tier.weight).toEqual(mockWeight);
    expect(tier.threshold).toEqual(mockThreshold);
    expect(tier.yuzu).toEqual(false);
    expect(tier.matchmakingMessageId).toBeNull();
    expect(tier.rankedRoleId).toBeNull();
  });

  it("can be removed", async () => {
    const numRows = await db.countRows("tier");
    await tier.remove();
    const finalNumRows = await db.countRows("tier");
    expect(finalNumRows).toBe(numRows - 1);
  });

  it("can be get from role discordId", async () => {
    const tierFromGet = await getTierByRole(mockTierDiscordId);

    expect(tierFromGet instanceof Tier).toBe(true);
    expect(tierFromGet.id).toBe(tier.id);
  });

  it("can be get from tier id", async () => {
    const tierFromGet = await getTier(tier.id);

    expect(tierFromGet instanceof Tier).toBe(true);
    expect(tierFromGet.id).toBe(tier.id);
  });

  it("can be get from the assigned #tier channel", async () => {
    const tierFromGet = await getTierByChannel(mockChannelId);

    expect(tierFromGet instanceof Tier).toBe(true);
    expect(tierFromGet.id).toBe(tier.id);
  });

  it("can set the search message", async () => {
    expect(tier.matchmakingMessageId).toBeNull();

    const message = await insertMessage("85271", tier.id, "84884", null, false, guild.id, null);
    expect(message instanceof Message).toBe(true);

    await tier.setMatchmakingMessage(message.id);
    expect(tier.matchmakingMessageId).toEqual(message.id);
    tier = await getTier(tier.id);
    expect(tier.matchmakingMessageId).toEqual(message.id);

    // Message cleanup
    await message.remove();
  });

  it("can set the ranked role", async () => {
    const rankedRoleId = "85481290";
    expect(tier.rankedRoleId).toBeNull();
    await tier.setRankedRole(rankedRoleId);

    expect(tier.rankedRoleId).toEqual(rankedRoleId);
    tier = await getTier(tier.id);
    expect(tier.rankedRoleId).toEqual(rankedRoleId);
  });

  it("can set channel ID", async () => {
    const newChannel = "48591";
    expect(tier.channelId).toBe(mockChannelId);
    await tier.setChannel(newChannel);

    expect(tier.channelId).toEqual(newChannel);
    tier = await getTier(tier.id);
    expect(tier.channelId).toEqual(newChannel);
  });

  it("can set threshold", async () => {
    const newThreshold = 3520;
    expect(tier.threshold).toBe(mockThreshold);
    await tier.setThreshold(newThreshold);

    expect(tier.threshold).toEqual(newThreshold);
    tier = await getTier(tier.id);
    expect(tier.threshold).toEqual(newThreshold);
  });

  it("can set weight", async () => {
    const newWeight = 5;
    expect(tier.weight).toBe(mockWeight);
    await tier.setWeight(newWeight);

    expect(tier.weight).toEqual(newWeight);
    tier = await getTier(tier.id);
    expect(tier.weight).toEqual(newWeight);
  });

  it("compares two tiers", async () => {
    const secondTier = await insertTier("949192", "931", guild.id, 2, 1800, false);
    const nullWeightTier = await insertTier("4371727", "919", guild.id, null, null, false);

    expect(secondTier instanceof Tier).toBe(true);
    expect(nullWeightTier instanceof Tier).toBe(true);

    expect(tier.canSearchIn(secondTier)).toBe(true);
    expect(tier.canSearchIn(nullWeightTier)).toBe(true);
    expect(secondTier.canSearchIn(tier)).toBe(false);

    expect(nullWeightTier.canSearchIn(tier)).toBe(false);

    expect(secondTier.canSearchIn(nullWeightTier)).toBe(true);
    expect(nullWeightTier.canSearchIn(secondTier)).toBe(false);

    await secondTier.remove();
    await nullWeightTier.remove();
  });

  it("can get tiers from a guild", async () => {
    const tier2DiscordId = "22222";
    const tier2ChannelId = "2222201";

    const tier2 = await insertTier(tier2DiscordId, tier2ChannelId, guild.id, 2, 1800, false);

    const tiers = await guild.getTiers();
    expect(tiers.length).toEqual(2);
    expect(JSON.stringify(tiers[0])).toEqual(JSON.stringify(tier));
    expect(JSON.stringify(tiers[1])).toEqual(JSON.stringify(tier2));
  });

  it("can get the yuzu Tier from a guild", async () => {
    // If no yuzu tier, returns null
    let yuzuTierFromGet = await guild.getYuzuTier();
    expect(yuzuTierFromGet).toBeNull();

    const yuzuTier = await insertTier(null, "9819191", guild.id, null, null, true);
    expect(yuzuTier instanceof Tier).toBe(true);
    yuzuTierFromGet = await guild.getYuzuTier();

    expect(yuzuTierFromGet instanceof Tier).toBe(true);
    expect(JSON.stringify(yuzuTierFromGet)).toEqual(JSON.stringify(yuzuTier));
  });
});
