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

describe("test getSearchTierMessages function", () => {
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

    await lobby.addTiers([tier3]);
    await saveSearchTierMessage(playerDiscordId, tier3RoleId, messageDiscordId, false);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("retrieves the message", async () => {
    const messages = await lobby.getMessagesFromEveryone(MESSAGE_TYPES.LOBBY_TIER);
    expect(messages).not.toBeNull();
    expect(messages.length).toBe(1);

    const message = messages[0];
    expect(message instanceof Message).toBe(true);
    expect(message.type).toEqual(MESSAGE_TYPES.LOBBY_TIER);
    expect(message.playerId).toEqual(player.id);
    expect(message.lobbyId).toEqual(lobby.id);
  });

  it("retrieves the message of a non-owner", async () => {
    const player2DiscordId = "8585132";
    const player2 = await getOrCreatePlayer(player2DiscordId);
    const lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "WAITING", false);

    await lobby2.addTiers([tier3]);
    await lobby.addPlayer(player2.id);

    const secondMessageDiscordId = "84184190";
    await saveSearchTierMessage(player2DiscordId, tier3RoleId, secondMessageDiscordId, false);

    const messages = await lobby.getMessagesFromEveryone(MESSAGE_TYPES.LOBBY_TIER);
    expect(messages).not.toBeNull();
    expect(messages.length).toBe(2);

    for (let message of messages) {
      expect(message instanceof Message).toBe(true);
      expect(message.type).toEqual(MESSAGE_TYPES.LOBBY_TIER);
      expect(message.playerId).not.toBeNull();

      const messagePlayer = message.playerId === player.id ? player : player2;
      const ownLobby = await messagePlayer.getOwnLobby();
      expect(message.lobbyId).toEqual(ownLobby.id);
    }

    await deleteIfExistsPlayer(player2DiscordId);
  });
});
