const mockCredentials = require("../../config.json");
jest.mock("../../../models/config.json", () => mockCredentials);
const db = require("../../../models/db");

const { NotFoundError } = require("../../../errors/notFound");
const {
  getOrCreatePlayer,
  getOrCreateGuild,
  deleteIfExistsPlayer,
  deleteIfExistsGuild,
  getOrCreateTier,
} = require("../../utils/testingUtils");
const { acceptMatch, setupArena } = require("../../../api/lobby");
const { Player } = require("../../../models/player");
const { Message, MESSAGE_TYPES } = require("../../../models/message");

afterAll(async () => await db.close());

describe("test LobbyAPI.setupArena()", () => {
  let guild;
  const guildDiscordId = "4851785";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "8514781";

  let lobby;
  let lobby2;

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  let tier4;
  const tier4RoleId = "814184";
  const tier4ChannelId = "89518518";

  let ltier3, l2tier4, l2tier3;
  let messageLt3, message2Lt4, message2Lt3;
  const messageLt3Id = "184181";
  const message2Lt4Id = "13919301";
  const message2Lt3Id = "94191492";

  let lp, lp2;
  let messageLp, messageLp2;
  const messageLpId = "1841904";
  const messageLp2Id = "9015241";

  const lobbyTextChannel = "85185195";
  const lobbyVoiceChannel = "1519919013";

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
    tier4 = await getOrCreateTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);

    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "CONFIRMATION");
    lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "WAITING");

    lp = await lobby.getLobbyPlayer(player.id);
    lp2 = await lobby.addPlayer(player2.id, "ACCEPTED");

    await lobby.setLobbyPlayersStatus("ACCEPTED");

    await lobby2.addTiers([tier3, tier4]);
    await lobby.addTiers([tier3]);

    ltier3 = await lobby.getLobbyTier(tier3.id);
    l2tier3 = await lobby2.getLobbyTier(tier3.id);
    l2tier4 = await lobby2.getLobbyTier(tier4.id);

    messageLt3 = await ltier3.insertMessage(messageLt3Id);
    message2Lt3 = await l2tier3.insertMessage(message2Lt3Id);
    message2Lt4 = await l2tier4.insertMessage(message2Lt4Id);

    messageLp = await lp.insertMessage(messageLpId);
    messageLp2 = await lp2.insertMessage(messageLp2Id);
  });

  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  it("sets up the arena", async () => {
    expect(message2Lt3.lobbyId).toEqual(lobby2.id);
    expect(message2Lt4.lobbyId).toEqual(lobby2.id);
    expect(messageLt3.lobbyId).toEqual(lobby.id);

    const { directMessages, tierMessages } = await setupArena(
      player.discordId,
      lobbyTextChannel,
      lobbyVoiceChannel
    );

    // All messages instances
    expect(directMessages.every((message) => message instanceof Message)).toBe(true);
    expect(tierMessages.every((message) => message instanceof Message)).toBe(true);

    // Well separated
    expect(directMessages.every((message) => message.type === MESSAGE_TYPES.LOBBY_PLAYER)).toBe(
      true
    );
    expect(tierMessages.every((message) => message.type === MESSAGE_TYPES.LOBBY_TIER)).toBe(true);

    // All messages rewired to lobby
    expect(directMessages.every((message) => message.lobbyId === lobby.id)).toBe(true);
    expect(tierMessages.every((message) => message.lobbyId === lobby.id)).toBe(true);
  });
});
