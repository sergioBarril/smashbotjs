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
const { saveConfirmationDM } = require("../../../api/message");
const { getMessage, Message, MESSAGE_TYPES } = require("../../../models/message");
const { getLobby } = require("../../../models/lobby");

afterAll(async () => await db.close());

describe("test search method", () => {
  let guild;
  const guildDiscordId = "4851785";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "895195";

  let lobby;

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  const messageDiscordId = "8518198";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "CONFIRMATION");

    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("throws NotFoundError if player's null / not found", async () => {
    await expect(saveConfirmationDM(null, messageDiscordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
    await player.remove();
    await expect(saveConfirmationDM(playerDiscordId, messageDiscordId)).rejects.toThrow(
      new NotFoundError("Player")
    );
  });

  it("throws NotFoundError if message's null", async () => {
    await expect(saveConfirmationDM(playerDiscordId, null)).rejects.toThrow(
      new NotFoundError("Message")
    );
  });

  it("throws NotFoundError if lobby's null", async () => {
    await lobby.remove();
    await expect(saveConfirmationDM(playerDiscordId, messageDiscordId)).rejects.toThrow(
      new NotFoundError("Lobby")
    );
  });

  it("adds the message", async () => {
    await saveConfirmationDM(playerDiscordId, messageDiscordId);

    const message = await getMessage(messageDiscordId, true);
    expect(message).not.toBeNull();
    expect(message instanceof Message).toBe(true);
    expect(message.type).toEqual(MESSAGE_TYPES.LOBBY_PLAYER);
    expect(message.playerId).toEqual(player.id);
    expect(message.lobbyId).toEqual(lobby.id);
  });
});
