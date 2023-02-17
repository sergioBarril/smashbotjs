const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");

const { getPlayer, insertPlayer } = require("../../models/player");
const { getGuild, insertGuild } = require("../../models/guild");
const { YuzuPlayer } = require("../../models/yuzuPlayer");

afterAll(async () => await db.close());

describe("test yuzuPlayer methods", () => {
  let player;
  let guild;
  let yp;

  const mockPlayerDiscordId = "147258369";
  const mockGuildDiscordId = "843516697";

  const mockYuzu = true;
  const mockParsec = false;

  beforeEach(async () => {
    guild = await getGuild(mockGuildDiscordId, true);
    if (!guild) guild = await insertGuild(mockGuildDiscordId);

    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);

    yp = await player.insertYuzuPlayer(guild.id, mockYuzu, mockParsec);
  });

  afterEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player) await player.remove();

    guild = await getGuild(mockGuildDiscordId, true);
    if (guild) await guild.remove();
  });

  it("inserts a new yuzuplayer", async () => {
    expect(yp).not.toBeNull();
    expect(yp instanceof YuzuPlayer).toBe(true);

    expect(yp.id).not.toBeNull();
    expect(yp.guildId).toBe(guild.id);
    expect(yp.playerId).toBe(player.id);
    expect(yp.yuzu).toBe(mockYuzu);
    expect(yp.parsec).toBe(mockParsec);
  });

  it("can set yuzu", async () => {
    expect(yp.yuzu).toBe(mockYuzu);
    await yp.setYuzu(!mockYuzu);

    expect(yp.yuzu).toBe(!mockYuzu);
    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.yuzu).toBe(!mockYuzu);
  });

  it("can set parsec", async () => {
    expect(yp.parsec).toBe(mockParsec);
    await yp.setParsec(!mockParsec);

    expect(yp.parsec).toBe(!mockParsec);
    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.parsec).toBe(!mockParsec);
  });

  it("can set parsecName", async () => {
    expect(yp.parsecName).toBeNull();

    const parsecName = "tropped";
    await yp.setParsecName(parsecName);

    expect(yp.parsecName).toBe(parsecName);
    yp = await player.getYuzuPlayer(guild.id);
    expect(yp.parsecName).toBe(parsecName);
  });
});
