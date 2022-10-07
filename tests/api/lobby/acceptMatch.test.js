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
const { acceptMatch } = require("../../../api/lobby");
const { Player } = require("../../../models/player");

afterAll(async () => await db.close());

describe("test LobbyAPI.acceptMatch()", () => {
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
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(acceptMatch(null)).rejects.toThrow(new NotFoundError("Player"));
    await player.remove();
    await expect(acceptMatch(player.discordId)).rejects.toThrow(
      new NotFoundError("Player", null, player.discordId)
    );
  });

  it("throws NotFoundError if there's no lobby in 'CONFIRMATION' status", async () => {
    await lobby.setStatus("SEARCHING");
    await expect(acceptMatch(player.discordId)).rejects.toThrow(new NotFoundError("Lobby"));
  });

  test("not all accepted", async () => {
    const result = await acceptMatch(player.discordId);
    expect(result.hasEveryoneAccepted).toBe(false);

    expect(result.players.length).toBe(1);
    expect(result.players[0] instanceof Player).toBe(true);
    expect(JSON.stringify(result.players[0])).toEqual(JSON.stringify(player2));

    expect(result.acceptedAt instanceof Date).toBe(true);
    expect(JSON.stringify(result.guild)).toEqual(JSON.stringify(guild));
  });

  test("all accepted", async () => {
    let result = await acceptMatch(player2.discordId);
    expect(result.hasEveryoneAccepted).toBe(false);

    result = await acceptMatch(player.discordId);
    expect(result.hasEveryoneAccepted).toBe(true);

    expect(result.players.length).toBe(2);
    expect(result.players.every((player) => player instanceof Player)).toBe(true);
  });
});
