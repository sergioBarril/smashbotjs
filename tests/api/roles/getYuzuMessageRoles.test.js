const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { getSearchingTiers } = require("../../../api/lobby");
const { Tier } = require("../../../models/tier");
const { NotFoundError } = require("../../../errors/notFound");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { getYuzuRolesForMessage } = require("../../../api/roles");

afterAll(async () => await db.close());

describe("test search method", () => {
  let guild;
  const guildDiscordId = "4851785";
  const yuzuRoleId = "84181";
  const parsecRoleId = "99494";

  let player;
  const playerDiscordId = "12489124";

  let yuzuPlayer;

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    guild = await getOrCreateGuild(guildDiscordId);

    await guild.setYuzuRole(yuzuRoleId);
    await guild.setParsecRole(parsecRoleId);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(getYuzuRolesForMessage(null, guildDiscordId)).rejects.toThrow(NotFoundError);
    await player.remove();
    await expect(getYuzuRolesForMessage(playerDiscordId, guildDiscordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws NotFoundError if guild's null / not found", async () => {
    await expect(getYuzuRolesForMessage(playerDiscordId, null)).rejects.toThrow(NotFoundError);
    await guild.remove();
    await expect(getYuzuRolesForMessage(playerDiscordId, guildDiscordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws NotFoundError if there's no yuzuPlayer", async () => {
    await expect(getYuzuRolesForMessage(playerDiscordId, guildDiscordId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("returns an empty array if yuzuPlayer has no roles", async () => {
    yuzuPlayer = await player.insertYuzuPlayer(guild.id, false, false);
    let result = await getYuzuRolesForMessage(playerDiscordId, guildDiscordId);
    expect(result.length).toBe(0);
  });

  it("returns an array with the opposite role than assigned yuzu -> parsec", async () => {
    yuzuPlayer = await player.insertYuzuPlayer(guild.id, true, false);
    let result = await getYuzuRolesForMessage(playerDiscordId, guildDiscordId);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(guild.parsecRoleId);
  });

  it("returns an array with the opposite role than assigned parsec -> yuzu", async () => {
    yuzuPlayer = await player.insertYuzuPlayer(guild.id, false, true);
    let result = await getYuzuRolesForMessage(playerDiscordId, guildDiscordId);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(guild.yuzuRoleId);
  });

  it("returns an array with both roles", async () => {
    yuzuPlayer = await player.insertYuzuPlayer(guild.id, true, true);
    let result = await getYuzuRolesForMessage(playerDiscordId, guildDiscordId);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(guild.yuzuRoleId);
    expect(result[1]).toBe(guild.parsecRoleId);
  });
});
