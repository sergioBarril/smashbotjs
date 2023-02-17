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
const { removeAfkLobby } = require("../../../api/lobby");

afterAll(async () => await db.close());

describe("test LobbyAPI.removeAfkLobby()", () => {
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

    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "AFK");
    await lobby.setLobbyPlayersStatus("AFK");
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(removeAfkLobby(null)).rejects.toThrow(new NotFoundError("Player"));
    await player.remove();
    await expect(removeAfkLobby(player.discordId)).rejects.toThrow(
      new NotFoundError("Player", null, player.discordId)
    );
  });

  it("throws NotFoundError if there's no lobby in 'AFK' status", async () => {
    await lobby.setStatus("SEARCHING");
    await expect(removeAfkLobby(player.discordId)).rejects.toThrow(new NotFoundError("AFKLobby"));
    await lobby.remove();
    await expect(removeAfkLobby(player.discordId)).rejects.toThrow(new NotFoundError("Lobby"));
  });

  test("remove the lobby", async () => {
    await removeAfkLobby(player.discordId);
    const lobbyFromGet = await player.getOwnLobby();
    expect(lobbyFromGet).toBeNull();
  });
});
