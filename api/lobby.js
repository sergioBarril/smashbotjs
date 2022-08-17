const { getGuild } = require("../models/guild");
const { getPlayer } = require("../models/player");
const { CannotSearchError } = require("../errors/cannotSearch");
const { AlreadySearchingError } = require("../errors/alreadySearching");
const { NotFoundError } = require("../errors/notFound");
const { getMessage, MESSAGE_TYPES } = require("../models/message");
const { NotSearchingError } = require("../errors/notSearching");
const { TooNoobError } = require("../errors/tooNoob");
const { NoCableError } = require("../errors/noCable");
const { MessageTypeError } = require("../errors/messageType");
const { NoYuzuError } = require("../errors/noYuzu");
const db = require("../models/db");

/**
 * Declines the match. If declined due to timeout, leaves the lobby in AFK
 * status for easily resuming the search.
 * @param {string} playerDiscordId Discord ID of the player that didn't accept
 * @param {boolean} isTimeout True if timed out, false if actively declined.
 * @returns An object with these properties:
 * - declined (Player) : Player that has declined
 * - otherPlayers (Array<Player>) : Players that don't have declined
 * - messages (Array<Message>) : Messages of all players in the lobby
 * - guild (Guild) : guild this lobby is/was in
 */
const matchNotAccepted = async (playerDiscordId, isTimeout) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) throw new NotFoundError("Lobby");

  const guild = await lobby.getGuild();

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Get all messages
    const allMessages = await lobby.getMessagesFromEveryone(null, client);

    // Get all LobbyPlayers
    const allLobbyPlayers = await lobby.getLobbyPlayers(client);
    const otherLps = allLobbyPlayers.filter((lp) => lp.playerId !== player.id);

    const declinerLp = await lobby.getLobbyPlayer(player.id, client);

    // Manage those who didn't decline
    for (let lp of otherLps) {
      // Remove all DMs from the DataBase
      await lp.removeMessages(client);
      const otherPlayer = await lp.getPlayer(client);
      const otherOwnLobby = await otherPlayer.getOwnLobby(client);

      await otherOwnLobby.removeMessages(MESSAGE_TYPES.LOBBY_TIER, client);

      const hasTier = await otherOwnLobby.hasAnyTier(client);
      if (!hasTier) await otherOwnLobby.remove(client);
      else {
        await otherOwnLobby.setStatus("SEARCHING", client);
        await otherOwnLobby.setLobbyPlayersStatus("SEARCHING", client);
      }
    }

    // Remove / AFK the lobby
    const declinedLobby = await player.getOwnLobby(client);

    if (isTimeout) {
      await declinedLobby.removeMessages(MESSAGE_TYPES.LOBBY_TIER, client);

      const afkMessage = await declinerLp.getMessage(client);
      await afkMessage.setLobby(declinedLobby.id, client);
      await afkMessage.setType(MESSAGE_TYPES.LOBBY_PLAYER_AFK, client);

      const hasAnyTier = await declinedLobby.hasAnyTier(client);
      if (hasAnyTier) {
        await declinedLobby.setStatus("AFK", client);
        await declinedLobby.setLobbyPlayersStatus("AFK", client);
      } else await declinedLobby.remove(client);
    } else {
      await declinerLp.removeMessages(client);
      await declinedLobby.remove(client);
    }

    // Remove Lobby Players from the "CONFIRMATION" lobby
    await lobby.removeOtherPlayers(lobby.createdBy, client);

    await client.query("COMMIT");

    const otherPlayers = await Promise.all(otherLps.map(async (lp) => await lp.getPlayer()));
    return {
      declinedPlayer: player,
      otherPlayers,
      messages: allMessages,
      guild,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Check if the player is searching
 * @param {string} playerDiscordId Discord ID of the player
 * @returns true if searching, false otherwise
 */
const isSearching = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getOwnLobby();
  if (!lobby) return false;

  return ["SEARCHING", "AFK"].includes(lobby.status) && lobby.hasAnyTier();
};

const canSearchRanked = async (playerId, guildId) => {
  const rating = await ratingDB.getByPlayerGuild(playerId, guildId);
  return rating?.tier_id != null;
};

const rankedSearch = async (playerDiscordId, guildDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  if (!guild) throw { name: "GUILD_NOT_FOUND" };

  const player = await playerDB.get(playerDiscordId, true);
  if (!player) throw { name: "PLAYER_NOT_FOUND" };

  const canSearch = await canSearchRanked(player.id, guild.id);
  if (!canSearch) throw { name: "NO_LAN_TIER" };

  let lobby = await lobbyDB.getByPlayer(player.id);
  const existsLobbyPlayer = await lobbyPlayerDB.existsLobbyPlayer(player.id);
  const isSearching = lobby?.status === "SEARCHING";

  if (!lobby && !existsLobbyPlayer) {
    await lobbyDB.createRanked(guild.id, player.id);
    lobby = await lobbyDB.getByPlayer(player.id);
  } else if (!isSearching || (!lobby && existsLobbyPlayer)) {
    throw { name: "NOT_SEARCHING" };
  } else if (lobby.ranked) {
    throw { name: "ALREADY_SEARCHING" };
  } else await lobbyDB.setRanked(lobby.id, true);

  return true;
};

/**
 *  Search a friendlies match
 *
 * @param {string} playerDiscordId DiscordId of the player searching
 * @param {string} guildDiscordId DiscordId of the guild you are searching in
 * @param {string} messageDiscordId DiscordId of the message in #matchmaking
 * @returns Object with the properties:
 *  - matched (boolean)
 *  - players (Array<Player>) if matched
 *  - tiers (Array<Tier>) if not matched
 */
const search = async (playerDiscordId, guildDiscordId, messageDiscordId) => {
  const isSearchAll = messageDiscordId === null;

  const guild = await getGuild(guildDiscordId, true);
  if (!guild) throw new NotFoundError("Guild");

  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const message = await getMessage(messageDiscordId, true);
  if (!message && !isSearchAll) throw new NotFoundError("TierMessage");
  else if (message && message.type !== MESSAGE_TYPES.GUILD_TIER_SEARCH)
    throw new MessageTypeError();

  let targetTier = null;
  if (message) {
    targetTier = await message.getTier();
    if (!targetTier) throw new NotFoundError("Tier");
  }

  const isYuzu = !isSearchAll && targetTier.yuzu;

  let targetTiers = [];
  const allTiers = await guild.getTiers();
  const playerTier = await player.getTier(guild.id);

  if (!playerTier && targetTier && targetTier.weight !== null)
    throw new NotFoundError("Tier", "No tienes ninguna tier asignada: no puedes jugar aquí.");

  // Yuzu
  if (isYuzu) {
    const canSearch = await player.canSearchYuzu(guild.id);
    if (!canSearch) throw new NoYuzuError(guild.yuzuRoleId, guild.parsecRoleId);
    else targetTiers.push(targetTier);

    // Not yuzu
  } else {
    let canSearch = false;
    // One tier
    if (targetTier && playerTier.canSearchIn(targetTier)) {
      targetTiers.push(targetTier);
      canSearch = true;
    }
    // All tiers
    else if (isSearchAll) {
      targetTiers = allTiers.filter((tier) => tier.weight !== null && playerTier.canSearchIn(tier));
      canSearch = targetTiers.length > 0;
    }

    if (!canSearch && targetTier) throw new TooNoobError(playerTier.roleId, targetTier.roleId);
    else if (!canSearch) throw new NoCableError();
  }

  let lobby = await player.getOwnLobby();
  const existsLobbyPlayer = await player.hasLobbyPlayer();
  const isSearching = lobby?.status === "SEARCHING";

  const searchingTiers = lobby == null ? [] : await lobby.getLobbyTiers();
  const searchingTiersIds = searchingTiers.map((tier) => tier.tierId);

  // Is already searching all those tiers?
  const newTiers = targetTiers.filter((tier) => !searchingTiersIds.includes(tier.id));

  if (!lobby && !existsLobbyPlayer) {
    lobby = await player.insertLobby(guild.id);
    await lobby.addTiers(targetTiers);
  } else if (!isSearching || (!lobby && existsLobbyPlayer)) {
    if (!lobby) throw new CannotSearchError("PLAYING", "SEARCH");
    else throw new CannotSearchError(lobby.status, "SEARCH");
  } else if (newTiers.length === 0) {
    throw new AlreadySearchingError(targetTiers[0].roleId, isYuzu);
  } else await lobby.addTiers(newTiers);

  const rivalPlayer = await matchmaking(player.discordId);

  return {
    matched: rivalPlayer !== null,
    tiers: newTiers,
    players: [player, rivalPlayer],
  };
};

/**
 * Assuming the Player has tiers to search, searches in them
 * @param {string} playerDiscordId Discord ID of the player
 * @returns The opponent if a match is found, null otherwise
 */
const matchmaking = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getOwnLobby();
  if (!lobby) throw new NotFoundError("Lobby");
  if (lobby?.status !== "SEARCHING") throw new CannotSearchError(lobby.status, "SEARCH");
  const rivalPlayer = await lobby.matchmaking();

  if (!rivalPlayer) return null;

  await lobby.setupMatch(rivalPlayer);
  return rivalPlayer;
};

const directMatch = async (playerDiscordId, guildDiscordId, messageDiscordId) => {
  const guild = await guildDB.get(guildDiscordId, true);
  if (!guild) throw { name: "GUILD_NOT_FOUND" };

  const newPlayer = await playerDB.get(playerDiscordId, true);
  if (!newPlayer) throw { name: "PLAYER_NOT_FOUND" };

  // Checks rival lobby
  const rivalLobby = await lobbyDB.getByTierChannelMessage(messageDiscordId);
  if (!rivalLobby) throw { name: "NO_RIVAL_LOBBY" };
  if (rivalLobby.status != "SEARCHING") throw { name: "RIVAL_NOT_SEARCHING" };
  if (rivalLobby.created_by === newPlayer.id) throw { name: "SAME_PLAYER" };

  // Check tier in case of yuzu
  const tier = await tierDB.getByTierMessage(messageDiscordId);
  if (tier.yuzu) {
    const yp = await yuzuPlayerDB.get(newPlayer.id, guild.id);
    const rivalYp = await yuzuPlayerDB.get(rivalLobby.created_by, guild.id);
    if (!yp || !rivalYp) throw { name: "NO_YUZU_PLAYER" };
    if (!((yp.parsec && rivalYp.yuzu) || (yp.yuzu && rivalYp.parsec)))
      throw { name: "YUZU_INCOMPATIBLE" };
  }

  // Checks player lobby
  let newPlayerLobby = await lobbyDB.getByPlayer(newPlayer.id, false);
  if (newPlayerLobby) {
    if (newPlayerLobby.status == "PLAYING") throw { name: "ALREADY_PLAYING" };
    if (["CONFIRMATION", "WAITING"].includes(newPlayerLobby.status))
      throw { name: "IN_CONFIRMATION" };
  } else {
    newPlayerLobby = await lobbyDB.create(guild.id, newPlayer.id, null, "FRIENDLIES", "WAITING");
  }

  const player = { player_id: newPlayer.id, lobby_id: newPlayerLobby.id };
  await matchmaking(rivalLobby.created_by, rivalLobby.id, guild.id, null, player);

  const rivalPlayer = await playerDB.get(rivalLobby.created_by, false);

  return {
    matched: true,
    players: [newPlayer, rivalPlayer],
  };
};

/**
 * Stop the friendlies search
 * @param {string} playerDiscordId DiscordId of the player that stops playing
 * @param {string} messageDiscordId DiscordId of the message in #matchmaking
 * @returns An object with the following properties:
 *  - isSearching (boolean) : true if still searching on some tiers
 *  - messages (Array<Message>) : array of messages
 *  - tiers (Array<Tier>) : tiers to stop
 */
const stopSearch = async (playerDiscordId, messageDiscordId) => {
  const isStopAll = messageDiscordId === null;

  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  let lobby = await player.getOwnLobby();
  if (lobby?.status !== "SEARCHING") {
    lobby = await player.getLobby("PLAYING");
    if (lobby) throw new CannotSearchError(lobby.status, "CANCEL");

    lobby = await player.getLobby("CONFIRMATION");
    if (lobby) throw new CannotSearchError(lobby.status, "CANCEL");

    throw new NotFoundError("Lobby");
  }

  const message = await getMessage(messageDiscordId, true);
  if (!message && !isStopAll) throw new NotFoundError("TierMessage");
  else if (message && message.type !== MESSAGE_TYPES.GUILD_TIER_SEARCH)
    throw new MessageTypeError();

  // Tiers to Stop
  let tiersToStop = [];

  let targetTier = null;
  if (message) {
    targetTier = await message.getTier();
    if (!targetTier) throw new NotFoundError("Tier");
  }
  const searchingTiers = await lobby.getLobbyTiers();

  if (targetTier) {
    if (searchingTiers.some((lt) => lt.tierId === targetTier.id)) tiersToStop.push(targetTier);
    else throw new NotSearchingError(targetTier.roleId, targetTier.yuzu);
  } else {
    const tiers = await Promise.all(searchingTiers.map(async (lt) => await lt.getTier()));
    tiersToStop = tiers.filter((tier) => tier.weight !== null);
  }

  if (tiersToStop.length === 0) throw new NotSearchingError(null, null);

  // Remove Tier
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const messages = await Promise.all(
      tiersToStop.map(async (tier) => {
        const lt = await lobby.getLobbyTier(tier.id, client);
        const message = await lt.getMessage(client);
        await lt.remove(client);
        return message;
      })
    );

    // If it was the last tier, remove the lobby
    const hasTier = await lobby.hasAnyTier(client);
    if (!hasTier && !lobby.ranked) await lobby.remove(client);
    await client.query("COMMIT");

    return {
      isSearching: hasTier,
      messages: messages,
      tiers: tiersToStop,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const getMessages = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "PLAYING", false);

  const messages = await lobbyMessageDB.getMessages(lobby.id);
  return messages;
};

const getSearchingTiers = async (playerDiscordId) => {
  // Given a player, returns all the Tiers where he's looking for games
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getOwnLobby();
  const lts = await lobby.getLobbyTiers();
  return await Promise.all(lts.map(async (lt) => await lt.getTier()));
};

const getPlayingPlayers = async (playerDiscordId) => {
  const lobby = await lobbyDB.getByPlayerStatus(playerDiscordId, "PLAYING", true);
  if (!lobby) throw { name: "NOT_PLAYING" };

  const lobbyPlayers = await lobbyPlayerDB.getLobbyPlayers(lobby.id);
  return lobbyPlayers;
};

const saveRankedMessage = async (playerDiscordId, rankedRoleId, messageId) => {
  const lobby = await lobbyDB.getByPlayer(playerDiscordId, true);
  const tier = await tierDB.getByRankedRole(rankedRoleId);
  const guild = await guildDB.get(tier.guild_id, false);

  await lobbyMessageDB.insert(lobby.id, messageId, guild.ranked_channel_id, true);
  return true;
};

/**
 * Accepts the match
 * @param {string} playerDiscordId DiscordId of the player
 * @returns An object with two properties:
 * - hasEveryoneAccepted (boolean)
 * - acceptedAt (Date) timestamp of accepting
 * - players (Array<Player>) If not all have accepted it's only those missing.
 * Otherwise all players from this lobby are returned
 * - guild (Guild) Guild where this lobby is from
 *
 */
const acceptMatch = async (playerDiscordId) => {
  const player = await getPlayer(playerDiscordId, true);
  if (!player) throw new NotFoundError("Player");

  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) throw new NotFoundError("Lobby");

  const lp = await lobby.getLobbyPlayer(player.id);
  if (!lp) throw new NotFoundError("LobbyPlayer");

  await lp.acceptMatch();
  const lps = await lobby.getLobbyPlayers();

  const notAcceptedPlayers = lps.filter((lp) => lp.status !== "ACCEPTED");
  const hasEveryoneAccepted = notAcceptedPlayers.length === 0;

  let players;
  if (hasEveryoneAccepted) players = await Promise.all(lps.map(async (lp) => await lp.getPlayer()));
  else players = await Promise.all(notAcceptedPlayers.map(async (lp) => await lp.getPlayer()));

  const guild = await lobby.getGuild();

  return { hasEveryoneAccepted, players, acceptedAt: lp.acceptedAt, guild };
};

/**
 * If a player has accepted, and after a while the opponent hasn't said anything,
 * the player can cancels the match.
 * @param {string} playerDiscordId Discord ID of the player that accepted
 * @returns An object with these properties:
 * - declined (Player) : Player that has declined
 * - otherPlayers (Array<Player>) : Players that don't have declined
 * - messages (Array<Message>) : Messages of all players in the lobby
 * - guild (Guild) : guild this lobby is/was in
 */
const timeoutMatch = async (playerDiscordId) => {
  const acceptedPlayer = await getPlayer(playerDiscordId, true);

  const lobby = await acceptedPlayer.getLobby("CONFIRMATION");
  const lobbyPlayers = await lobby.getLobbyPlayers();

  const rejectedLobbyPlayer = lobbyPlayers.find((player) => player.status != "ACCEPTED");
  if (!rejectedLobbyPlayer) throw new NotFoundError("RejectedPlayer");

  const rejectedPlayer = await rejectedLobbyPlayer.getPlayer();

  return await matchNotAccepted(rejectedPlayer.discordId, true);
};

/**
 * Sets the channels and all the necessary status
 * for a fresh new friendlies arena
 *
 * @param {string} playerDiscordId Discord ID of the Player
 * @param {string} textChannelId Discord ID of the text Channel
 * @param {string} voiceChannelId Discord ID of the voice Channel
 * @returns
 */
const setupArena = async (playerDiscordId, textChannelId, voiceChannelId) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const player = await getPlayer(playerDiscordId, true, client);
    const lobby = await player.getLobby("CONFIRMATION", client);

    await lobby.setChannels(textChannelId, voiceChannelId, client);
    await lobby.setLobbyForAllMessages(client);
    await lobby.removeOtherLobbies(client);

    await lobby.setStatus("PLAYING", client);
    await lobby.setLobbyPlayersStatus("PLAYING", client);
    await client.query("COMMIT");

    const messages = await lobby.getMessagesFromEveryone();
    return {
      directMessages: messages.filter((message) => message.type == MESSAGE_TYPES.LOBBY_PLAYER),
      tierMessages: messages.filter((message) => message.type == MESSAGE_TYPES.LOBBY_TIER),
    };
  } catch (e) {
    client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const unAFK = async (playerDiscordId) => {
  // Removes the status of "AFK" to the lobby, and starts searching again
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayer(player.id, false);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.updateStatus(lobby.id, player.id, "SEARCHING", client);
    await lobbyDB.updateStatus(lobby.id, "SEARCHING");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const rivalPlayer = await matchmaking(player.id, lobby.id, lobby.guild_id);
  const guild = await guildDB.get(lobby.guild_id, false);

  return { rival: rivalPlayer, guild: guild.discord_id };
};

const closeArena = async (playerDiscordId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "PLAYING", false);

  if (!lobby) throw { name: "NOT_PLAYING" };
  const gameset = await gameSetDB.getByLobby(lobby.id);
  if (gameset) throw { name: "IN_GAMESET" };

  const client = await db.getClient();

  // Send guild discord Id
  const guild = await guildDB.get(lobby.guild_id, false);
  lobby.guild_id = guild.discord_id;

  try {
    await client.query("BEGIN");
    await lobbyDB.remove(lobby.id, false, client);
    await client.query("COMMIT");
    return lobby;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

/**
 *  Checks if the opponent still hasn't accepted
 * @param {string} acceptedPlayerId DiscordId of the player who accepted
 * @param {Date} acceptedAt Timestamp when the player accepted
 * @returns True if opponent's AFK, false otherwise
 */
const timeOutCheck = async (acceptedPlayerId, acceptedAt) => {
  const player = await getPlayer(acceptedPlayerId, true);
  if (!player) return false;

  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) return false;

  const lp = await lobby.getLobbyPlayer(player.id);
  if (!lp || lp.acceptedAt.getTime() !== acceptedAt.getTime()) return false;

  const lps = await lobby.getLobbyPlayers();
  return lps.some((lp) => lp.status === "CONFIRMATION");
};

const voteNewSet = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(textChannelId);
  const lobbyPlayer = await lobbyPlayerDB.get(lobby.id, player.id);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.setNewSet(lobby.id, player.id, !lobbyPlayer.new_set, client);
    const decided = await lobbyPlayerDB.isNewSetDecided(lobby.id, client);

    if (decided) {
      const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id, client);
      await lobbyPlayerDB.setNewSet(lobby.id, player.id, false, client);
      await lobbyPlayerDB.setNewSet(lobby.id, opponent.id, false, client);
    }

    await client.query("COMMIT");
    return { decided, status: !lobbyPlayer.new_set };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const voteCancelSet = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(textChannelId);
  const lobbyPlayer = await lobbyPlayerDB.get(lobby.id, player.id);

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await lobbyPlayerDB.setCancelSet(lobby.id, player.id, !lobbyPlayer.cancel_set, client);
    const decided = await lobbyPlayerDB.isCancelSetDecided(lobby.id, client);

    if (decided) {
      const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id, client);
      await lobbyPlayerDB.setCancelSet(lobby.id, player.id, false, client);
      await lobbyPlayerDB.setCancelSet(lobby.id, opponent.id, false, client);
    }

    await client.query("COMMIT");
    return { decided, status: !lobbyPlayer.cancel_set };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const getOpponent = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByTextChannel(textChannelId);

  const opponent = await lobbyPlayerDB.getOpponent(lobby.id, player.id);
  return opponent;
};

const isInCurrentLobby = async (playerDiscordId, textChannelId) => {
  const player = await playerDB.get(playerDiscordId, true);
  const lobby = await lobbyDB.getByPlayerStatus(player.id, "PLAYING", false);

  return lobby && lobby.text_channel_id == textChannelId;
};

module.exports = {
  search,
  stopSearch,
  getSearchingTiers,
  isSearching,
  matchmaking,
  rankedSearch,
  getPlayingPlayers,
  getMessages,
  acceptMatch,
  matchNotAccepted,
  timeoutMatch,
  setupArena,
  directMatch,
  unAFK,
  closeArena,
  timeOutCheck,
  voteNewSet,
  voteCancelSet,
  getOpponent,
  isInCurrentLobby,
};
