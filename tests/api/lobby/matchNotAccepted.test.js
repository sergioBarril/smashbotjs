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
const { acceptMatch, matchNotAccepted } = require("../../../api/lobby");
const { Player } = require("../../../models/player");
const { Guild } = require("../../../models/guild");
const { Message, MESSAGE_TYPES, getMessage } = require("../../../models/message");
const { getLobby } = require("../../../models/lobby");

afterAll(async () => await db.close());

describe("test LobbyAPI.matchNotAccepted()", () => {
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

  beforeEach(async () => {
    player = await getOrCreatePlayer(playerDiscordId);
    player2 = await getOrCreatePlayer(player2DiscordId);

    guild = await getOrCreateGuild(guildDiscordId);

    tier3 = await getOrCreateTier(tier3RoleId, tier3ChannelId, guild.id, 3, 1800, false);
    tier4 = await getOrCreateTier(tier4RoleId, tier4ChannelId, guild.id, 4, 1500, false);

    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "CONFIRMATION");
    lobby2 = await player2.insertLobby(guild.id, "FRIENDLIES", "WAITING");

    lp = await lobby.getLobbyPlayer(player.id);
    await lp.setStatus("WAITING");

    lp2 = await lobby.addPlayer(player2.id, "CONFIRMATION");

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

  test("throws NotFoundError if not player", async () => {
    await expect(matchNotAccepted(null, false)).rejects.toThrow(new NotFoundError("Player"));
    await player.remove();
    await expect(matchNotAccepted(playerDiscordId, false)).rejects.toThrow(
      new NotFoundError("Player")
    );
  });

  test("throws NotFoundError if there's no lobby in CONFIRMATION", async () => {
    await lobby.setStatus("PLAYING");
    await expect(matchNotAccepted(playerDiscordId, false)).rejects.toThrow(
      new NotFoundError("Lobby")
    );
  });

  const testLobbyPlayerMessagesRemoved = async () => {
    const lp1MessageFromGet = await getMessage(messageLp.id, false);
    const lp2MessageFromGet = await getMessage(messageLp2.id, false);

    if (lp1MessageFromGet) expect(lp1MessageFromGet.type).toEqual(MESSAGE_TYPES.LOBBY_PLAYER_AFK);
    else expect(lp1MessageFromGet).toBeNull();

    if (lp2MessageFromGet) expect(lp2MessageFromGet.type).toEqual(MESSAGE_TYPES.LOBBY_PLAYER_AFK);
    else expect(lp2MessageFromGet).toBeNull();
  };

  const testDeclinedPlayerIs = (declinedPlayer, player) => {
    expect(declinedPlayer instanceof Player).toBe(true);
    expect(JSON.stringify(declinedPlayer)).toEqual(JSON.stringify(player));
  };

  const testOtherPlayers = (otherPlayers, player2) => {
    expect(otherPlayers.length).toBe(1);
    expect(otherPlayers[0] instanceof Player).toBe(true);
    expect(JSON.stringify(otherPlayers[0])).toEqual(JSON.stringify(player2));
  };

  const testResultMessages = (messages) => {
    expect(messages.length).toBe(5);
    expect(messages.every((m) => m instanceof Message)).toBe(true);
  };

  /**
   * Lobby Tier messages from all lobbies have been removed from DB
   */
  const testLobbyTierMessagesRemoved = async () => {
    const messagelt3FromGet = await getMessage(messageLt3.id, false);
    const message2lt3FromGet = await getMessage(message2Lt3.id, false);

    expect(messagelt3FromGet).toBeNull();
    expect(message2lt3FromGet).toBeNull();
  };

  test("declines match in his own lobby", async () => {
    const result = await matchNotAccepted(playerDiscordId, false);
    testDeclinedPlayerIs(result.declinedPlayer, player);
    testOtherPlayers(result.otherPlayers, player2);
    testResultMessages(result.messages);

    await testLobbyPlayerMessagesRemoved();
    await testLobbyTierMessagesRemoved();

    lobby = await getLobby(lobby.id);
    expect(lobby).toBeNull();

    lobby2 = await getLobby(lobby2.id);
    expect(lobby2.status).toEqual("SEARCHING");

    let lps = await lobby2.getLobbyPlayers();
    expect(lps.length).toBe(1);

    expect(result.guild instanceof Guild).toBe(true);
    expect(JSON.stringify(result.guild)).toBe(JSON.stringify(guild));
  });

  test("declines match in the other lobby", async () => {
    const result = await matchNotAccepted(player2DiscordId, false);
    testDeclinedPlayerIs(result.declinedPlayer, player2);
    testOtherPlayers(result.otherPlayers, player);

    testResultMessages(result.messages);
    await testLobbyPlayerMessagesRemoved();
    await testLobbyTierMessagesRemoved();

    lobby2 = await getLobby(lobby2.id);
    expect(lobby2).toBeNull();

    lobby = await getLobby(lobby.id);
    expect(lobby.status).toEqual("SEARCHING");
    let lps = await lobby.getLobbyPlayers();
    expect(lps.length).toBe(1);

    expect(result.guild instanceof Guild).toBe(true);
    expect(JSON.stringify(result.guild)).toBe(JSON.stringify(guild));
  });

  test("timeout in own lobby", async () => {
    await lp2.setStatus("ACCEPTED");
    const result = await matchNotAccepted(playerDiscordId, true);

    testDeclinedPlayerIs(result.declinedPlayer, player);
    testOtherPlayers(result.otherPlayers, player2);
    testResultMessages(result.messages);

    await testLobbyPlayerMessagesRemoved();
    await testLobbyTierMessagesRemoved();

    lobby = await getLobby(lobby.id);
    expect(lobby.status).toEqual("AFK");
    const afkLobbyMessages = await lobby.getMessagesFromEveryone(null);
    expect(afkLobbyMessages.length).toBe(1);
    expect(afkLobbyMessages[0].type).toEqual(MESSAGE_TYPES.LOBBY_PLAYER_AFK);

    lobby2 = await getLobby(lobby2.id);
    expect(lobby2.status).toEqual("SEARCHING");
    let lps = await lobby2.getLobbyPlayers();
    expect(lps.length).toBe(1);

    expect(result.guild instanceof Guild).toBe(true);
    expect(JSON.stringify(result.guild)).toBe(JSON.stringify(guild));
  });

  test("timeout in other lobby", async () => {
    await lp.setStatus("ACCEPTED");
    const result = await matchNotAccepted(player2DiscordId, true);

    testDeclinedPlayerIs(result.declinedPlayer, player2);
    testOtherPlayers(result.otherPlayers, player);
    testResultMessages(result.messages);

    await testLobbyPlayerMessagesRemoved();
    await testLobbyTierMessagesRemoved();

    lobby2 = await getLobby(lobby2.id);
    expect(lobby2.status).toEqual("AFK");
    const afkLobbyMessages = await lobby2.getMessagesFromEveryone(null);
    expect(afkLobbyMessages.length).toBe(1);
    expect(afkLobbyMessages[0].type).toEqual(MESSAGE_TYPES.LOBBY_PLAYER_AFK);

    lobby = await getLobby(lobby.id);
    expect(lobby.status).toEqual("SEARCHING");
    let lps = await lobby.getLobbyPlayers();
    expect(lps.length).toBe(1);

    expect(result.guild instanceof Guild).toBe(true);
    expect(JSON.stringify(result.guild)).toBe(JSON.stringify(guild));
  });

  test("timeout without searching tiers", async () => {
    await l2tier3.remove();
    await l2tier4.remove();
    await matchNotAccepted(player2DiscordId, true);

    lobby2 = await getLobby(lobby2.id);
    expect(lobby2).toBeNull();
  });

  test(" get rejected without searching tiers (direct match)", async () => {
    await ltier3.remove();
    await matchNotAccepted(player2DiscordId, false);

    lobby = await getLobby(lobby.id);
    expect(lobby).toBeNull();
  });
});
