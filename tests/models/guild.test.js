const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");
const { getGuild, insertGuild, Guild } = require("../../models/guild");

afterAll(async () => await db.close());

describe("test Guild methods", () => {
  let guild;

  const mockGuildDiscordId = "47854211";

  const mockChannelId = "938381743";
  const mockRoleId = "1123561231";

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);
  });

  afterEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new guild", async () => {
    expect(guild instanceof Guild).toBe(true);
    expect(guild.discordId).toEqual(mockGuildDiscordId);
  });

  it("can set matchmaking channel", async () => {
    expect(guild.matchmakingChannelId).toBeNull();

    await guild.setMatchmakingChannel(mockChannelId);
    expect(guild.matchmakingChannelId).toBe(mockChannelId);
    guild = await getGuild(guild.id, false);

    expect(guild.matchmakingChannelId).toBe(mockChannelId);
  });

  it("can set ranked channel", async () => {
    expect(guild.rankedChannelId).toBeNull();

    await guild.setRankedChannel(mockChannelId);
    expect(guild.rankedChannelId).toBe(mockChannelId);

    guild = await getGuild(guild.id, false);
    expect(guild.rankedChannelId).toBe(mockChannelId);
  });

  it("can set roles channel", async () => {
    expect(guild.rolesChannelId).toBeNull();

    await guild.setRolesChannel(mockChannelId);
    expect(guild.rolesChannelId).toBe(mockChannelId);

    guild = await getGuild(guild.id, false);
    expect(guild.rolesChannelId).toBe(mockChannelId);
  });

  it("can set yuzu role", async () => {
    expect(guild.yuzuRoleId).toBeNull();

    await guild.setYuzuRole(mockRoleId);
    expect(guild.yuzuRoleId).toBe(mockRoleId);

    guild = await getGuild(guild.id, false);
    expect(guild.yuzuRoleId).toBe(mockRoleId);
  });

  it("can set parsec role", async () => {
    expect(guild.parsecRoleId).toBeNull();

    await guild.setParsecRole(mockRoleId);
    expect(guild.parsecRoleId).toBe(mockRoleId);

    guild = await getGuild(guild.id, false);
    expect(guild.parsecRoleId).toBe(mockRoleId);
  });
});
