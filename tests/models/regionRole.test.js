const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { insertRegion, getRegionByName } = require("../../models/region");
const { RegionRole, getRegionRole } = require("../../models/regionRole");
const { getGuild, insertGuild } = require("../../models/guild");

afterAll(async () => await db.close());

describe("test regionRole methods", () => {
  let region;
  let guild;
  let regionRole;

  const mockGuildDiscordId = "843516697";

  const mockRoleDiscordId = "123456";
  const secondRoleDiscordId = "654321";

  const regionName = "Narnia";
  const regionName2 = "Barcelona";

  beforeEach(async () => {
    region = await getRegionByName(regionName);
    if (!region) region = await insertRegion(regionName);

    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    regionRole = await region.insertRole(mockRoleDiscordId, guild.id);
  });

  afterEach(async () => {
    region = await getRegionByName(regionName);
    if (region) await region.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new regionRole", async () => {
    expect(regionRole).not.toBeNull();
    expect(regionRole instanceof RegionRole).toBe(true);
    expect(regionRole.roleId).toBe(mockRoleDiscordId);
    expect(regionRole.regionId).toBe(region.id);
    expect(regionRole.guildId).toBe(guild.id);
  });

  it("doesnt allow two regionRoles in the same guild", async () => {
    await expect(region.insertRole(secondRoleDiscordId, guild.id)).rejects.toThrow();
  });

  it("doesnt allow two regionRoles with the same discordId", async () => {
    const secondReg = await insertRegion(regionName2);
    expect(secondReg).not.toBeNull();

    await expect(secondReg.insertRole(mockRoleDiscordId, guild.id)).rejects.toThrow();

    // Cleanup
    await secondReg.remove();
  });

  it("can get a region role by region and guild", async () => {
    const regRole = await region.getRole(guild.id);
    expect(regRole).not.toBeNull();
    expect(regRole instanceof RegionRole).toBe(true);
  });

  it("can get a region role by role discordId", async () => {
    let regRole = await getRegionRole(mockRoleDiscordId);
    expect(regRole).not.toBeNull();
    expect(regRole instanceof RegionRole).toBe(true);
    expect(regRole.id).toBe(regionRole.id);

    regRole = await getRegionRole(0);
    expect(regRole).toBeNull();
  });

  it("removes region roles when region is deleted", async () => {
    const beforeRows = await db.countRows("region_role");
    await region.remove();
    const afterRows = await db.countRows("region_role");
    expect(afterRows).toEqual(beforeRows - 1);
  });

  it("can get the regionrole by name in the guild", async () => {
    let rr = await guild.getRegionRoleByName("TEST123");
    expect(rr).toBeNull();

    rr = await guild.getRegionRoleByName(regionName);
    expect(rr instanceof RegionRole).toBe(true);

    expect(JSON.stringify(rr)).toEqual(JSON.stringify(regionRole));
  });

  it("gets region roles for the guild", async () => {
    let rrs = await guild.getRegionRoles();
    expect(rrs.length).toBe(1);
    const regionRoleFromGet = rrs[0];
    expect(regionRoleFromGet instanceof RegionRole).toBe(true);
    expect(JSON.stringify(regionRoleFromGet)).toEqual(JSON.stringify(regionRole));
  });

  it("region.getRole() returns null if it has no role", async () => {
    await regionRole.remove();
    expect(await region.getRole(guild.id)).toBeNull();
  });

  it("can set the role discord Id", async () => {
    expect(regionRole.roleId).toEqual(mockRoleDiscordId);

    const newRoleId = "8911939";
    await regionRole.setRoleId(newRoleId);
    expect(regionRole.roleId).toEqual(newRoleId);

    regionRole = await guild.getRegionRoleByName(regionName);
    expect(regionRole.roleId).toEqual(newRoleId);
  });
});
