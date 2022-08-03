const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");

const { getPlayer, insertPlayer } = require("../../models/player");
const { Rating, getRating } = require("../../models/rating");
const { insertTier, getTier, Tier } = require("../../models/tier");
const { getGuild, insertGuild } = require("../../models/guild");

afterAll(async () => await db.close());

describe("test rating methods", () => {
  let player;
  let guild;
  let tier;

  const mockPlayerDiscordId = "147258369";
  const mockGuildDiscordId = "843516697";
  const mockTierDiscordId = "812381231";
  const mockChannelDiscordId = "81238189191";

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    tier = await getTier(mockTierDiscordId);
    if (!tier)
      tier = await insertTier(mockTierDiscordId, mockChannelDiscordId, guild.id, 1, 2100, false);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new rating", async () => {
    const rating = await player.insertRating(guild.id, tier.id, 1200);

    expect(rating).not.toBeNull();
    expect(rating instanceof Rating).toBe(true);

    expect(rating.id).not.toBeNull();
    expect(rating.playerId).toBe(player.id);
    expect(rating.tierId).toBe(tier.id);
    expect(rating.guildId).toBe(guild.id);

    await rating.remove();
  });

  it("gets a rating by ratingId", async () => {
    const rating = await player.insertRating(guild.id, tier.id, 1200);
    const ratingFromGet = await getRating(rating.id);

    expect(ratingFromGet instanceof Rating).toBe(true);
    expect(ratingFromGet.id).toEqual(rating.id);
    expect(ratingFromGet.guildId).toEqual(rating.guildId);
    expect(ratingFromGet.tierId).toEqual(rating.tierId);
    expect(ratingFromGet.score).toEqual(rating.score);
  });

  it("gets a rating by player and guildId", async () => {
    let rating = await player.getRating(guild.id);
    expect(rating).toBeNull();

    rating = await player.insertRating(guild.id, tier.id, 1200);
    const ratingFromGet = await player.getRating(guild.id);

    expect(ratingFromGet instanceof Rating).toBe(true);
    expect(JSON.stringify(ratingFromGet)).toEqual(JSON.stringify(rating));
  });

  it("removes the rating on player removal", async () => {
    const rating = await player.insertRating(guild.id, tier.id, 1500);
    expect(await getRating(rating.id)).not.toBeNull();

    await player.remove();

    expect(await getRating(rating.id)).toBeNull();
  });

  it("can set the tier", async () => {
    let rating = await player.insertRating(guild.id, tier.id, 1200);
    expect(rating.tierId).toEqual(tier.id);

    const tier2 = await insertTier("123818", "994319", guild.id, 3, 1500);
    await rating.setTier(tier2.id);
    expect(rating.tierId).toEqual(tier2.id);

    rating = await player.getRating(guild.id);
    expect(rating.tierId).toEqual(tier2.id);

    await tier2.remove();
    await rating.remove();
  });

  it("Score setters for rating", async () => {
    let rating = await player.insertRating(guild.id, tier.id, 1200);
    expect(rating.score).toEqual(1200);

    const newScore = 1848;
    await rating.setScore(newScore);
    expect(rating.score).toEqual(newScore);

    rating = await getRating(rating.id);
    expect(rating.score).toEqual(newScore);
  });

  it("can get rating tier from player", async () => {
    let rating = await player.insertRating(guild.id, tier.id, 1200);
    let tierFromGet = await player.getTier(guild.id);
    expect(tierFromGet instanceof Tier).toBe(true);
    expect(JSON.stringify(tierFromGet)).toEqual(JSON.stringify(tier));

    await rating.remove();

    rating = await player.insertRating(guild.id, null, null);
    tierFromGet = await player.getTier(guild.id);
    expect(tierFromGet).toBeNull();
  });
});
