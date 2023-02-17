const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertRegion, getRegionByName, Region } = require("../../models/region");
const { getPlayer, insertPlayer, Player } = require("../../models/player");
const { RegionPlayer } = require("../../models/regionPlayer");

afterAll(async () => await db.close());

describe("test regionPlayer methods", () => {
  let region;
  let player;
  let regPlayer;

  const regionName = "Narnia";
  const mockPlayerDiscordId = "147258369";

  beforeEach(async () => {
    region = await getRegionByName(regionName);
    if (!region) region = await insertRegion(regionName);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    regPlayer = await player.insertRegion(region.id);
  });

  afterEach(async () => {
    region = await getRegionByName(regionName);
    if (region) await region.remove();

    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();
  });

  it("inserts a new regionPlayer", async () => {
    expect(regPlayer).not.toBeNull();
    expect(regPlayer instanceof RegionPlayer).toBe(true);
    expect(regPlayer.playerId).toBe(player.id);
    expect(regPlayer.regionId).toBe(region.id);
  });

  it("enforces (region, player) uniqueness", async () => {
    await regPlayer.remove();
    await expect(player.insertRegion(region.id)).resolves.not.toBeNull();
    await expect(player.insertRegion(region.id)).rejects.toThrow();
  });

  it("deleting the player deletes the regionPlayer", async () => {
    const beforeRows = await db.countRows("region_player");
    await player.remove();
    const afterRows = await db.countRows("region_player");
    expect(afterRows).toEqual(beforeRows - 1);
  });

  it("deleting the region deletes the regionPlayer", async () => {
    const beforeRows = await db.countRows("region_player");
    await region.remove();
    const afterRows = await db.countRows("region_player");
    expect(afterRows).toEqual(beforeRows - 1);
  });

  it("can get the region name", async () => {
    const regName = await regPlayer.getRegionName();
    expect(regName).toEqual(regionName);
  });

  it("can get the region", async () => {
    const reg = await regPlayer.getRegion();

    expect(reg instanceof Region).toBe(true);
    expect(reg.id).toEqual(region.id);
    expect(reg.name).toEqual(region.name);
  });

  it("can get the player", async () => {
    const p = await regPlayer.getPlayer();

    expect(p instanceof Player).toBe(true);
    expect(p.id).toEqual(player.id);
    expect(p.discordId).toEqual(player.discordId);
  });
});
