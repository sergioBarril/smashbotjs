const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");

const { getAllGuilds } = require("../../models/guild");
const { getPlayer, insertPlayer, Player } = require("../../models/player");
const { Rating, getRating } = require("../../models/rating");

afterAll(async () => await db.close());

describe("test rating methods", () => {
  let player;
  let guild;
  let tier;

  const mockPlayerDiscordId = "147258369";

  beforeEach(async () => {
    if (!guild) {
      const guilds = await getAllGuilds();
      guild = guilds[0];
    }

    if (!tier) {
      const tiers = await guild.getTiers();
      tier = tiers[0];
    }

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);
  });

  afterEach(async () => {
    if (player) {
      await player.remove();
      player = null;
    }
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

  it("removes the rating on player removal", async () => {
    const rating = await player.insertRating(guild.id, tier.id, 1500);
    expect(await getRating(rating.id)).not.toBeNull();

    await player.remove();

    expect(await getRating(rating.id)).toBeNull();
  });
});
