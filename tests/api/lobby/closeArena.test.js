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
const { closeArena } = require("../../../api/lobby");
const { Player } = require("../../../models/player");
const { Guild } = require("../../../models/guild");
const { Message, MESSAGE_TYPES, getMessage } = require("../../../models/message");
const { getLobby } = require("../../../models/lobby");
const { InGamesetError } = require("../../../errors/inGameset");

afterAll(async () => await db.close());

describe("test LobbyAPI.closeArena()", () => {
  let guild;
  const guildDiscordId = "4851785";

  let player;
  const playerDiscordId = "12489124";

  let player2;
  const player2DiscordId = "8514781";

  let lobby;
  const textChannelId = "98519519";
  const voiceChannelId = "915915782";

  let tier3;
  const tier3RoleId = "9159159175";
  const tier3ChannelId = "18951759734";

  let tier4;
  const tier4RoleId = "814184";
  const tier4ChannelId = "89518518";

  let ltier3, ltier4;
  let messageLt3, messageLt4;
  const messageLt3Id = "184181";
  const messageLt4Id = "13919301";

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

    lobby = await player.insertLobby(guild.id, "FRIENDLIES", "PLAYING");
    await lobby.setChannels(textChannelId, voiceChannelId);

    lp = await lobby.getLobbyPlayer(player.id);
    await lp.setStatus("PLAYING");
    lp2 = await lobby.addPlayer(player2.id, "PLAYING");

    await lobby.addTiers([tier3, tier4]);

    ltier3 = await lobby.getLobbyTier(tier3.id);
    ltier4 = await lobby.getLobbyTier(tier4.id);

    messageLt3 = await ltier3.insertMessage(messageLt3Id);
    messageLt4 = await ltier4.insertMessage(messageLt4Id);

    messageLp = await lp.insertMessage(messageLpId);
    messageLp2 = await lp2.insertMessage(messageLp2Id);
  });
  afterEach(async () => {
    await deleteIfExistsPlayer(playerDiscordId);
    await deleteIfExistsPlayer(player2DiscordId);
    await deleteIfExistsGuild(guildDiscordId);
  });

  test("if player not found, throw NotFoundError", async () => {
    await expect(closeArena(null)).rejects.toThrow(new NotFoundError("Player"));
    await player.remove();
    await expect(closeArena(player.discordId)).rejects.toThrow(
      new NotFoundError("Player", null, player.discordId)
    );
  });

  test("if not playing, throw NotFoundError", async () => {
    await lobby.setStatus("SEARCHING");
    await expect(closeArena(player.discordId)).rejects.toThrow(
      new NotFoundError("Lobby", "CLOSE_ARENA")
    );
    await lobby.remove();
    await expect(closeArena(player.discordId)).rejects.toThrow(
      new NotFoundError("Lobby", "CLOSE_ARENA")
    );
  });

  test("if in the middle of a set, throw InGameSet Error", async () => {
    await lobby.newGameset();
    await expect(closeArena(player.discordId)).rejects.toThrow(new InGamesetError());
  });

  test("lobby removed correctly", async () => {
    const result = await closeArena(player.discordId);
    expect(result.channels.text).toEqual(textChannelId);
    expect(result.channels.voice).toEqual(voiceChannelId);
    expect(JSON.stringify(result.guild)).toEqual(JSON.stringify(guild));
    expect(result.messages.every((m) => m.playerDiscordId != null)).toBe(true);
    expect(result.messages.length).toBe(4);
    expect(result.messages.filter((m) => m.type === MESSAGE_TYPES.LOBBY_PLAYER).length).toBe(2);
    expect(result.messages.filter((m) => m.type === MESSAGE_TYPES.LOBBY_TIER).length).toBe(2);

    expect(await getLobby(lobby.id)).toBeNull();
  });
});
