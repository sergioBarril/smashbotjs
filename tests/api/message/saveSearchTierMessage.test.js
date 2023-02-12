const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");
const { NotFoundError } = require("../../../errors/notFound");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  getOrCreateTier,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
} = require("../../utils/testingUtils");
const { saveSearchTierMessage } = require("../../../api/message");
const { getMessage, Message, MESSAGE_TYPES } = require("../../../models/message");

afterAll(async () => await db.close());

describe("test search method", () => {
  let guild;
  const guildDiscordId = "4851785";

  let player;
  const playerDiscordId = "12489124";

  let lobby;

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  const messageDiscordId = "8518198";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    lobby = await player.insertLobby(guild.id);

    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(saveSearchTierMessage(null, tier3RoleId, messageDiscordId, false)).rejects.toThrow(
      new NotFoundError("Player")
    );
    await player.remove();
    await expect(
      saveSearchTierMessage(playerDiscordId, tier3RoleId, messageDiscordId, false)
    ).rejects.toThrow(new NotFoundError("Player"));
  });

  it("throws NotFoundError if tier's null / not found", async () => {
    await expect(
      saveSearchTierMessage(playerDiscordId, null, messageDiscordId, false)
    ).rejects.toThrow(new NotFoundError("Tier"));
    await tier3.remove();
    await expect(
      saveSearchTierMessage(playerDiscordId, tier3RoleId, messageDiscordId, false)
    ).rejects.toThrow(new NotFoundError("Tier"));
  });

  it("throws NotFoundError if lobby not found", async () => {
    await lobby.remove();
    await expect(
      saveSearchTierMessage(playerDiscordId, tier3RoleId, messageDiscordId, false)
    ).rejects.toThrow(new NotFoundError("Lobby"));
  });

  it("throws NotFoundError if lobbyTier not found", async () => {
    await expect(
      saveSearchTierMessage(playerDiscordId, tier3RoleId, messageDiscordId, false)
    ).rejects.toThrow(new NotFoundError("LobbyTier"));
  });

  it("adds the message", async () => {
    await lobby.addTiers([tier3]);
    await saveSearchTierMessage(playerDiscordId, tier3RoleId, messageDiscordId, false);

    const message = await getMessage(messageDiscordId, true);
    expect(message).not.toBeNull();
    expect(message instanceof Message).toBe(true);
    expect(message.type).toEqual(MESSAGE_TYPES.LOBBY_TIER);
    expect(message.playerId).toEqual(player.id);
    expect(message.lobbyId).toEqual(lobby.id);
  });
});
