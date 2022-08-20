const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { NotFoundError } = require("../../../errors/notFound");

const {
  getOrCreatePlayer,
  getOrCreateCharacter,
  deleteIfExistsPlayer,
  deleteIfExistsCharacter,
  getOrCreateGuild,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { assignCharacter, getCharacters, assignYuzu } = require("../../../api/roles");
const { CustomError } = require("../../../errors/customError");

afterAll(async () => await db.close());

describe("test rolesAPI.assignCharacter() method", () => {
  let guild;
  const guildDiscordId = "85419049";

  let player;
  const playerDiscordId = "123456";

  const yuzuRoleId = "58818951";
  const parsecRoleId = "94914912";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    guild = await getOrCreateGuild(guildDiscordId);

    await guild.setParsecRole(parsecRoleId);
    await guild.setYuzuRole(yuzuRoleId);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  test("no previous yuzuplayer, add yuzu", async () => {
    let yp = await player.getYuzuPlayer(guild.id);
    expect(yp).toBeNull();

    const result = await assignYuzu(player.discordId, guild.discordId, "YUZU");
    expect(result.newStatus).toBe(true);
    expect(result.roleId).toBe(guild.yuzuRoleId);

    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.yuzu).toBe(true);
    expect(yp.parsec).toBe(false);
  });

  test("remove yuzu", async () => {
    await assignYuzu(player.discordId, guild.discordId, "YUZU");
    const result = await assignYuzu(player.discordId, guild.discordId, "YUZU");

    expect(result.newStatus).toBe(false);
    expect(result.roleId).toBe(guild.yuzuRoleId);

    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.yuzu).toBe(false);
    expect(yp.parsec).toBe(false);
  });

  test("add parsec", async () => {
    const result = await assignYuzu(player.discordId, guild.discordId, "PARSEC");
    expect(result.newStatus).toBe(true);
    expect(result.roleId).toBe(guild.parsecRoleId);

    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.yuzu).toBe(false);
    expect(yp.parsec).toBe(true);
  });

  test("remove parsec", async () => {
    await assignYuzu(player.discordId, guild.discordId, "PARSEC");
    const result = await assignYuzu(player.discordId, guild.discordId, "PARSEC");
    expect(result.newStatus).toBe(false);
    expect(result.roleId).toBe(guild.parsecRoleId);

    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.yuzu).toBe(false);
    expect(yp.parsec).toBe(false);
  });

  test("throws NotFoundError if player not found", async () => {
    await player.remove();
    await expect(assignYuzu(player.discordId, guild.discordId, "YUZU")).rejects.toThrow(
      new NotFoundError("Player")
    );
  });

  test("throws NotFoundError if guild not found", async () => {
    await guild.remove();
    await expect(assignYuzu(player.discordId, guild.discordId, "YUZU")).rejects.toThrow(
      new NotFoundError("Guild")
    );
  });

  test("throws CustomError if wrong type", async () => {
    await expect(assignYuzu(player.discordId, guild.discordId, "YUZU2")).rejects.toThrow(
      CustomError
    );
  });
});
