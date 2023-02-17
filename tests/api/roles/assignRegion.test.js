const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { NotFoundError } = require("../../../errors/notFound");

const {
  getOrCreatePlayer,
  getOrCreateRegion,
  deleteIfExistsPlayer,
  deleteIfExistsRegion,
  getOrCreateGuild,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { assignRegion, getRegions } = require("../../../api/roles");

afterAll(async () => await db.close());

describe("test rolesAPI.assignRegion() method", () => {
  let guild;
  const guildDiscordId = "85419049";

  let player;
  const playerDiscordId = "123456";

  let region1;
  const region1Name = "Testing 1";
  let region2;
  const region2Name = "Testing 2";
  let region3;
  const region3Name = "Testing 3";
  let region4;
  const region4Name = "Testing 4";

  let charRole1, charRole2, charRole3, charRole4;
  const charRole1Id = "851958129";
  const charRole2Id = "859159122";
  const charRole3Id = "851029032";
  const charRole4Id = "8510923028";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    guild = await getOrCreateGuild(guildDiscordId);

    region1 = await getOrCreateRegion(region1Name);
    region2 = await getOrCreateRegion(region2Name);
    region3 = await getOrCreateRegion(region3Name);
    region4 = await getOrCreateRegion(region4Name);

    charRole1 = await region1.insertRole(charRole1Id, guild.id);
    charRole2 = await region2.insertRole(charRole2Id, guild.id);
    charRole3 = await region3.insertRole(charRole3Id, guild.id);
    charRole4 = await region4.insertRole(charRole4Id, guild.id);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
    await deleteIfExistsRegion(region1Name);
    await deleteIfExistsRegion(region2Name);
    await deleteIfExistsRegion(region3Name);
    await deleteIfExistsRegion(region4Name);
  });

  test("add region", async () => {
    const previousRegions = await player.getAllRegions();
    expect(previousRegions.length).toBe(0);

    await assignRegion(player.discordId, region1Name, guild.discordId);

    const newRegions = await player.getAllRegions();
    expect(newRegions.length).toBe(1);
    expect(newRegions[0].id).toEqual(region1.id);
  });

  test("remove region", async () => {
    await assignRegion(player.discordId, region1Name, guild.discordId);
    const previousRegions = await player.getAllRegions();
    expect(previousRegions.length).toBe(1);
    await assignRegion(player.discordId, region1Name, guild.discordId);
    const newRegions = await player.getAllRegions();
    expect(newRegions.length).toBe(0);
  });

  test("throws NotFoundError if player not found", async () => {
    await player.remove();
    await expect(assignRegion(player.discordId, region1Name, guild.discordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
  });

  test("throws NotFoundError if guild not found", async () => {
    await guild.remove();
    await expect(assignRegion(player.discordId, region1Name, guild.discordId)).rejects.toThrow(
      new NotFoundError("Guild")
    );
  });

  test("throws NotFoundError if region not found", async () => {
    await expect(
      assignRegion(player.discordId, "Not valid region", guild.discordId)
    ).rejects.toThrow(new NotFoundError("Region"));
  });
});
