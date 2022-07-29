const mockCredentials = require("../config.json");
jest.mock("../../models/config.json", () => mockCredentials);
const db = require("../../models/db");

const { getPlayer, insertPlayer, Player } = require("../../models/player");

afterAll(async () => await db.close());

describe("test player methods", () => {
  let player;

  const mockPlayerDiscordId = "147258369";

  beforeEach(async () => {
    player = await getPlayer(mockPlayerDiscordId, true);
    if (!player) player = await insertPlayer(mockPlayerDiscordId);
  });

  afterEach(async () => {
    if (player) {
      await player.remove();
      player = null;
    }
  });

  it("inserts a new player", async () => {
    // Before
    player = await getPlayer(mockPlayerDiscordId, true);
    if (player != null) await player.remove();

    const numRows = await db.countRows("player");
    player = await insertPlayer(mockPlayerDiscordId);
    const newNumRows = await db.countRows("player");

    expect(newNumRows).toBe(numRows + 1);

    expect(player).not.toBeNull();
    expect(player instanceof Player).toBe(true);
    expect(player.discordId).toBe(mockPlayerDiscordId);

    // Cleanup
    await player.remove();
    const finalNumRows = await db.countRows("player");
    expect(finalNumRows).toBe(numRows);
  });

  it("can't have two players with the same discordId", async () => {
    await expect(insertPlayer(mockPlayerDiscordId)).rejects.toThrow();
  });
});
