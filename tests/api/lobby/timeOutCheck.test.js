const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");

const { NotFoundError } = require("../../../errors/notFound");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { acceptMatch, timeOutCheck } = require("../../../api/lobby");
const { Player } = require("../../../models/player");

afterAll(async () => await db.close());

describe("test LobbyAPI.timeOutCheck()", () => {
  let guild;
  const guildDiscordId = "4851785";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "8514781";

  let lobby;

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "CONFIRMATION");
    await lobby.addPlayer(player2.id, "CONFIRMATION");
    await lobby.setLobbyPlayersStatus("CONFIRMATION");

    await acceptMatch(player.discordId);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  test("if player not found, returns false", async () => {
    const lp = await lobby.getLobbyPlayer(player.id);
    const result = await timeOutCheck(null, lp.acceptedAt);
    expect(result).toBe(false);
  });

  test("if no lobby in confirmation found, returns false", async () => {
    await lobby.setStatus("PLAYING");
    const lp = await lobby.getLobbyPlayer(player.id);
    const result = await timeOutCheck(player.discordId, lp.acceptedAt);
    expect(result).toBe(false);
  });

  test("if the accepted date is not the same, returns false", async () => {
    const lp = await lobby.getLobbyPlayer(player.id);
    const newDate = new Date(lp.acceptedAt.getTime() + 5 * 60000);
    const result = await timeOutCheck(player.discordId, newDate);
    expect(result).toBe(false);
  });

  test("return true if there's still someone that hasn't accepted", async () => {
    const lp = await lobby.getLobbyPlayer(player.id);
    const result = await timeOutCheck(player.discordId, lp.acceptedAt);
    expect(result).toBe(true);
  });
});
