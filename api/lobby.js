const { getGuild, getGuildOrThrow } = require("../models/guild");
const { getPlayer, getPlayerOrThrow } = require("../models/player");
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
const { InvalidMessageTypeError } = require("../errors/invalidMessageType");
const { InvalidLobbyStatusError } = require("../errors/invalidLobbyStatus");
const { SamePlayerError } = require("../errors/samePlayer");
const { IncomaptibleYuzuError } = require("../errors/incompatibleYuzu");
const { CustomError } = require("../errors/customError");
const { InGamesetError } = require("../errors/inGameset");
const { RejectedPlayerError } = require("../errors/rejectedPlayer");
const {
  getLobbyByTextChannel,
  getLobby,
  getLobbyByTextChannelOrThrow,
} = require("../models/lobby");
const { getTier } = require("../models/tier");

const winston = require("winston");
const { AlreadyAcceptedError } = require("../errors/alreadyAccepted");

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
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) throw new NotFoundError("Lobby", "MATCH_NOT_ACCEPTED");

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

      const guildMessageOtherPlayer = await lp.getMessage(MESSAGE_TYPES.LOBBY_PLAYER_GUILD, client);
      if (guildMessageOtherPlayer) {
        guildMessageOtherPlayer.remove(client);
      }

      const otherOwnLobby = await otherPlayer.getOwnLobbyOrThrow(client);

      await otherOwnLobby.removeMessages(MESSAGE_TYPES.LOBBY_TIER, client);

      const hasTier = await otherOwnLobby.hasAnyTier(client);
      if (!hasTier && !lobby.ranked) await otherOwnLobby.remove(client);
      else {
        await otherOwnLobby.setStatus("SEARCHING", client);
        await otherOwnLobby.setLobbyPlayersStatus("SEARCHING", client);
      }
    }

    // Remove / AFK the lobby
    const declinedLobby = await player.getOwnLobbyOrThrow(client);

    if (isTimeout) {
      await declinedLobby.removeMessages(MESSAGE_TYPES.LOBBY_TIER, client);
      let afkMessage = await declinerLp.getMessage(MESSAGE_TYPES.LOBBY_PLAYER, client);
      if (afkMessage) {
        await afkMessage.setLobby(declinedLobby.id, client);
        await afkMessage.setType(MESSAGE_TYPES.LOBBY_PLAYER_AFK, client);

        const hasAnyTier = await declinedLobby.hasAnyTier(client);
        if (hasAnyTier || declinedLobby.ranked) {
          await declinedLobby.setStatus("AFK", client);
          await declinedLobby.setLobbyPlayersStatus("AFK", client);
        } else await declinedLobby.remove(client);
      } else {
        await declinerLp.removeMessages(client);
        await declinedLobby.remove(client);
      }
    } else {
      await declinerLp.removeMessages(client);
      await declinedLobby.remove(client);
    }

    // Remove Lobby Players from the "CONFIRMATION" lobby
    await lobby.removeOtherPlayers(lobby.createdBy, client);

    await client.query("COMMIT");

    const otherPlayers = await Promise.all(otherLps.map(async (lp) => await lp.getPlayer()));

    // Reject player
    if (!isTimeout) {
      const REJECT_TIME = 45;
      for (let rejectedPlayer of otherPlayers) {
        await player.rejectPlayer(rejectedPlayer.id, REJECT_TIME);
      }
    }

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
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getOwnLobby();
  if (!lobby) return false;

  const hasAnyTier = await lobby.hasAnyTier();
  return ["SEARCHING", "AFK"].includes(lobby.status) && (hasAnyTier || lobby.ranked);
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

  const guild = await getGuildOrThrow(guildDiscordId, true);
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const message = await getMessage(messageDiscordId, true);
  if (!message && !isSearchAll) throw new NotFoundError("TierMessage");

  const isRanked = message?.type === MESSAGE_TYPES.GUILD_RANKED_SEARCH;

  if (message && message.type !== MESSAGE_TYPES.GUILD_TIER_SEARCH && !isRanked)
    throw new MessageTypeError();

  let targetTier = null;
  if (message && !isRanked) {
    targetTier = await message.getTier();
    if (!targetTier) throw new NotFoundError("Tier");
  }

  const isYuzu = !isSearchAll && !isRanked && targetTier.yuzu;

  let targetTiers = [];
  const allTiers = await guild.getTiers();
  const playerTier = await player.getTier(guild.id);

  if (!playerTier && ((targetTier && targetTier.weight !== null) || isSearchAll))
    throw new NotFoundError("Tier", "SEARCH_NO_TIER_ASSIGNED");

  // Check if player is allowed to search here
  if (isYuzu) {
    // Yuzu
    const canSearch = await player.canSearchYuzu(guild.id);
    if (!canSearch) throw new NoYuzuError(guild.yuzuRoleId, guild.parsecRoleId);
    else targetTiers.push(targetTier);
  } else if (isRanked) {
    // Ranked
    const playerRating = await player.getRating(guild.id);
    if (!playerRating) throw new NotFoundError("Rating");
    if (playerRating.score === null) throw new NotFoundError("RankedTier");
  } else {
    let canSearch = false;
    // One tier
    if (targetTier && (targetTier.weight === null || playerTier.canSearchIn(targetTier))) {
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
  const isAfk = lobby?.status === "AFK";

  const searchingTiers = lobby == null ? [] : await lobby.getLobbyTiers();
  const searchingTiersIds = searchingTiers.map((tier) => tier.tierId);

  // Is already searching all those tiers?
  const newTiers = targetTiers.filter((tier) => !searchingTiersIds.includes(tier.id));

  if (!lobby && !existsLobbyPlayer) {
    lobby = await player.insertLobby(guild.id);
    winston.info(`Lobby creado por ${player.discordId}: Lobby (${lobby.id})`);
    if (isRanked) {
      await lobby.setRanked(true);
      winston.info(`Lobby (${lobby.id}) es a partir de ahora Ranked.`);
    } else await lobby.addTiers(targetTiers);
  } else if (!isSearching || (!lobby && existsLobbyPlayer)) {
    if (!lobby) throw new CannotSearchError("PLAYING", "SEARCH");
    else if (!isAfk) throw new CannotSearchError(lobby.status, "SEARCH");
  } else if (!isRanked && newTiers.length === 0) {
    throw new AlreadySearchingError(targetTiers[0].roleId, isYuzu);
  } else if (isRanked && lobby.ranked) throw new AlreadySearchingError(null, false);
  else if (isRanked) await lobby.setRanked(true);
  else await lobby.addTiers(newTiers);

  if (isAfk) {
    await lobby.setStatus("SEARCHING");
    await lobby.setLobbyPlayersStatus("SEARCHING");
  }

  const { rivalPlayer, foundRanked } = await matchmaking(player.discordId);

  // Remove afk messages (from the person that clicked the button)
  const afkMessages = await lobby.getMessagesFromEveryone(MESSAGE_TYPES.LOBBY_PLAYER_AFK);
  for (let afkMessage of afkMessages) {
    const author = await afkMessage.getPlayer();
    afkMessage.authorId = author.discordId;
    afkMessage.remove();
  }
  return {
    matched: rivalPlayer != null,
    tiers: newTiers,
    players: [player, rivalPlayer],
    afkMessages,
    searchedRanked: isRanked,
    foundRanked,
  };
};

/**
 * Assuming the Player has tiers to search, searches in them
 * @param {string} playerDiscordId Discord ID of the player
 * @returns The opponent if a match is found, null otherwise
 */
const matchmaking = async (playerDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getOwnLobbyOrThrow();

  if (lobby?.status !== "SEARCHING") throw new CannotSearchError(lobby.status, "SEARCH");

  const rating = await player.getRating(lobby.guildId);

  let rivalPlayer;
  let foundRanked = false;
  let searchedRanked = false;

  if (lobby.ranked) {
    const playerTier = await getTier(rating.tierId);

    rivalPlayer = await lobby.rankedMatchmaking(
      playerTier.weight,
      rating.promotion,
      rating.promotionWins,
      rating.promotionLosses
    );
    searchedRanked = true;
    foundRanked = rivalPlayer != null;

    /** Allow for bonus in promo too */
    if (!rivalPlayer) {
      rivalPlayer = await lobby.rankedMatchmaking(
        playerTier.weight,
        rating.promotion,
        rating.promotionWins,
        rating.promotionLosses,
        false
      );

      foundRanked = rivalPlayer != null;
    }
  }

  if (!rivalPlayer) rivalPlayer = await lobby.matchmaking();

  if (rivalPlayer) {
    winston.info(`Match ${foundRanked ? "ranked " : ""}encontrado con ${rivalPlayer.discordId}`);
    await lobby.setupMatch(rivalPlayer, foundRanked);
  }

  return { rivalPlayer, foundRanked, searchedRanked };
};

/**
 *
 * @param {string} playerDiscordId Discord ID of the player that clicked the button
 * @param {string} messageDiscordId Discord ID of the message whose button was clicked
 * @returns
 */
const directMatch = async (playerDiscordId, messageDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobbyTierMessage = await getMessage(messageDiscordId, true);
  if (!lobbyTierMessage) throw new NotFoundError("Message");
  else if (lobbyTierMessage.type !== MESSAGE_TYPES.LOBBY_TIER)
    throw new InvalidMessageTypeError(lobbyTierMessage.type, MESSAGE_TYPES.LOBBY_TIER);

  // Checks rival lobby
  const rivalLobby = await lobbyTierMessage.getLobby();
  if (!rivalLobby) throw new NotFoundError("Lobby");
  if (rivalLobby.status != "SEARCHING")
    throw new InvalidLobbyStatusError(rivalLobby.status, "SEARCHING");
  if (rivalLobby.createdBy === player.id) {
    throw new SamePlayerError();
  }

  const guild = await rivalLobby.getGuild();

  // Check tier in case of yuzu
  const tier = await lobbyTierMessage.getTier();
  const playerTier = await player.getTier(guild.id);
  if (!playerTier && !tier.wifi) throw new NotFoundError("Tier");
  if (playerTier && !tier.yuzu && !playerTier.canSearchIn(tier))
    throw new TooNoobError(playerTier.roleId, tier.roleId);

  const rivalPlayer = await getPlayer(rivalLobby.createdBy, false);
  if (tier.yuzu) {
    const yp = await player.getYuzuPlayer(guild.id);
    const rivalYp = await rivalPlayer.getYuzuPlayer(guild.id);
    if (!yp || !rivalYp) throw new NotFoundError("YuzuPlayer");
    if (!yp.yuzu && !yp.parsec) throw new NoYuzuError(guild.yuzuRoleId, guild.parsecRoleId);
    if (!((yp.parsec && rivalYp.yuzu) || (yp.yuzu && rivalYp.parsec))) {
      if (rivalYp.yuzu) throw new IncomaptibleYuzuError(guild.yuzuRoleId, guild.parsecRoleId);
      else throw new IncomaptibleYuzuError(guild.parsecRoleId, guild.yuzuRoleId);
    }
  }

  // Check rejects
  const isRejected = await rivalPlayer.hasRejected(player.id);
  if (isRejected) {
    throw new RejectedPlayerError(rivalPlayer.discordId);
  }

  const rejecter = await player.getRejected(rivalPlayer.id);
  if (rejecter) await rejecter.remove();

  // Checks player lobby
  let playerLobby = await player.getOwnLobby();
  const lobbyPlaying = await player.getLobby("PLAYING");

  if (playerLobby || lobbyPlaying) {
    if (playerLobby.status == "PLAYING" || lobbyPlaying)
      throw new CannotSearchError("PLAYING", "SEARCH");
    if (["CONFIRMATION", "WAITING"].includes(playerLobby.status))
      throw new CannotSearchError(playerLobby.status, "SEARCH");
  } else {
    playerLobby = await player.insertLobby(guild.id, "FRIENDLIES", "WAITING");
  }

  // Remove afk messages (from the person that clicked the button)
  const afkMessages = await playerLobby.getMessagesFromEveryone(MESSAGE_TYPES.LOBBY_PLAYER_AFK);
  for (let afkMessage of afkMessages) {
    const author = await afkMessage.getPlayer();
    afkMessage.authorId = author.discordId;
    afkMessage.remove();
  }

  await rivalLobby.setupMatch(player);
  return {
    matched: true,
    players: [player, rivalPlayer],
    afkMessages,
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

  const player = await getPlayerOrThrow(playerDiscordId, true);

  let lobby = await player.getOwnLobby();
  if (lobby?.status !== "SEARCHING") {
    lobby = await player.getLobby("PLAYING");
    if (lobby) throw new CannotSearchError(lobby.status, "CANCEL");

    lobby = await player.getLobby("CONFIRMATION");
    if (lobby) throw new CannotSearchError(lobby.status, "CANCEL");

    throw new NotFoundError("Lobby", "STOP_SEARCH");
  }

  const message = await getMessage(messageDiscordId, true);
  if (!message && !isStopAll) throw new NotFoundError("TierMessage");

  const isRanked = message?.type === MESSAGE_TYPES.GUILD_RANKED_SEARCH;

  if (message && !isRanked && message.type !== MESSAGE_TYPES.GUILD_TIER_SEARCH)
    throw new MessageTypeError();

  // Tiers to Stop
  let tiersToStop = [];

  let targetTier = null;
  if (message && !isRanked) {
    targetTier = await message.getTier();
    if (!targetTier) throw new NotFoundError("Tier");
  }
  const searchingTiers = await lobby.getLobbyTiers();

  if (targetTier) {
    if (searchingTiers.some((lt) => lt.tierId === targetTier.id)) tiersToStop.push(targetTier);
    else throw new NotSearchingError(targetTier.roleId, targetTier.yuzu);
  } else if (!isRanked) {
    const tiers = await Promise.all(searchingTiers.map(async (lt) => await lt.getTier()));
    tiersToStop = tiers.filter((tier) => tier.weight !== null);
  }

  if (!isRanked && tiersToStop.length === 0) throw new NotSearchingError(null, null);
  if (isRanked) {
    if (!lobby.ranked)
      throw new NotSearchingError(null, null, "¡No estabas buscando partida ranked!");
    await lobby.setRanked(false);
  }

  // Remove Tier
  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const messages = await Promise.all(
      tiersToStop.map(async (tier) => {
        const lt = await lobby.getLobbyTier(tier.id, client);
        const message = await lt.getMessage(client);
        await lt.remove(client);
        await message.remove();
        return message;
      })
    );

    if (isRanked) {
      const rankedMessage = await lobby.getRankedMessage(client);
      if (rankedMessage) {
        await rankedMessage.remove();
        messages.push(rankedMessage);
      }
    }

    // If it was the last tier, remove the lobby
    let hasTier = await lobby.hasAnyTier(client);
    hasTier = hasTier || lobby.ranked;
    if (!hasTier) await lobby.remove(client);
    await client.query("COMMIT");

    return {
      isSearching: hasTier,
      messages,
      tiers: tiersToStop,
      isRanked,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

const getSearchingTiers = async (playerDiscordId) => {
  // Given a player, returns all the Tiers where he's looking for games
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobby = await player.getOwnLobbyOrThrow();
  const lts = await lobby.getLobbyTiers();
  return await Promise.all(lts.map(async (lt) => await lt.getTier()));
};

/**
 * Return the players playing in this lobby
 * @param {string} textChannelId
 * @returns Players playing in this lobby
 */
const getPlayingPlayers = async (textChannelId) => {
  const lobby = await getLobbyByTextChannel(textChannelId);
  if (!lobby) throw new NotFoundError("Lobby", "DELETED_LOBBY");

  const lps = await lobby.getLobbyPlayers();
  return await Promise.all(lps.map(async (lp) => await lp.getPlayer()));
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
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobby = await player.getLobby("CONFIRMATION");
  if (!lobby) throw new NotFoundError("Lobby", "ALREADY_ACCEPTED_OR_REJECTED");

  const lp = await lobby.getLobbyPlayer(player.id);
  if (!lp) throw new NotFoundError("LobbyPlayer");
  if (lp.status === "ACCEPTED") throw new AlreadyAcceptedError();

  await lp.acceptMatch();
  const lps = await lobby.getLobbyPlayers();

  const notAcceptedPlayers = lps.filter((lp) => lp.status !== "ACCEPTED");
  const hasEveryoneAccepted = notAcceptedPlayers.length === 0;

  let players;
  if (hasEveryoneAccepted) players = await Promise.all(lps.map(async (lp) => await lp.getPlayer()));
  else players = await Promise.all(notAcceptedPlayers.map(async (lp) => await lp.getPlayer()));

  const guild = await lobby.getGuild();

  return {
    hasEveryoneAccepted,
    players,
    acceptedAt: lp.acceptedAt,
    guild,
    ranked: lobby.mode == "RANKED",
  };
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
  const acceptedPlayer = await getPlayerOrThrow(playerDiscordId, true);

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
    const player = await getPlayerOrThrow(playerDiscordId, true, client);
    const lobby = await player.getLobby("CONFIRMATION", client);

    await lobby.setChannels(textChannelId, voiceChannelId, client);
    await lobby.setLobbyForAllMessages(client);
    await lobby.removeOtherLobbies(client);

    await lobby.setStatus("PLAYING", client);
    await lobby.setLobbyPlayersStatus("PLAYING", client);
    await client.query("COMMIT");

    const messages = await lobby.getMessagesFromEveryone();
    return {
      directMessages: messages.filter(
        (message) =>
          message.type == MESSAGE_TYPES.LOBBY_PLAYER ||
          message.type == MESSAGE_TYPES.LOBBY_PLAYER_GUILD
      ),
      tierMessages: messages.filter((message) => message.type == MESSAGE_TYPES.LOBBY_TIER),
    };
  } catch (e) {
    client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Removes the status of "AFK" to the lobby, and starts searching again
 * @param {string} playerDiscordId Discord ID of the player that was AFK
 * @returns
 */
const searchAgainAfkLobby = async (playerDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getOwnLobbyOrThrow();

  if (lobby.status !== "AFK") throw new NotFoundError("AFKLobby");
  await lobby.setStatus("SEARCHING");
  await lobby.setLobbyPlayersStatus("SEARCHING");

  const players = [player];
  const { rivalPlayer, searchedRanked, foundRanked } = await matchmaking(player.discordId);

  const guild = await lobby.getGuild();

  if (rivalPlayer) players.push(rivalPlayer);

  // Remove afk messages (from the person that clicked the button)
  const afkMessages = await lobby.getMessagesFromEveryone(MESSAGE_TYPES.LOBBY_PLAYER_AFK);
  for (let afkMessage of afkMessages) {
    const author = await afkMessage.getPlayer();
    afkMessage.authorId = author.discordId;
    afkMessage.remove();
  }

  return {
    matched: rivalPlayer != null,
    players,
    guild,
    searchedRanked,
    foundRanked,
  };
};

/**
 * Removes the lobby of the player that was AFK
 * @param {string} playerDiscordId Discord ID of the player that declined the AFK search again
 */
const removeAfkLobby = async (playerDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobby = await player.getOwnLobby();
  if (!lobby) throw new NotFoundError("Lobby");

  if (lobby.status !== "AFK") throw new NotFoundError("AFKLobby");
  await lobby.remove();
};

/**
 * Closes the arena
 * @param {string} playerDiscordId Discord ID of the player that closes the arena
 * @returns Object with these properties:
 * - channels: discordIds of the text and voice channels
 * - guild: Guild model
 * - messages: all Messages with the extra property "message.playerDiscordId"
 */
const closeArena = async (playerDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobby = await player.getLobby("PLAYING");
  if (!lobby) throw new NotFoundError("Lobby", "CLOSE_ARENA");

  const gameset = await lobby.getGameset();
  if (gameset) throw new InGamesetError();

  const guild = await lobby.getGuild();
  const messages = await lobby.getMessagesFromEveryone();
  const lobbyPlayers = await lobby.getLobbyPlayers();
  const players = await Promise.all(lobbyPlayers.map(async (lp) => await lp.getPlayer()));
  const playersDiscordIds = players.map((p) => p.discordId);

  for (let message of messages)
    message.playerDiscordId = players.find((p) => p.id === message.playerId).discordId;

  await lobby.remove();
  return {
    channels: {
      text: lobby.textChannelId,
      voice: lobby.voiceChannelId,
    },
    guild,
    messages,
    playersDiscordIds,
  };
};

const avoidPlayer = async (playerDiscordId, playerDiscordId2, timeMargin) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const rejectedPlayer = await getPlayerOrThrow(playerDiscordId2, true);

  if (timeMargin == 0) {
    const pr = await player.getRejected(rejectedPlayer.id);
    if (pr) await pr.remove();
    return;
  } else await player.rejectPlayer(rejectedPlayer.id, timeMargin);
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
  if (!lp || !lp.acceptedAt || lp.acceptedAt.getTime() !== acceptedAt.getTime()) return false;

  const lps = await lobby.getLobbyPlayers();
  return lps.some((lp) => lp.status === "CONFIRMATION");
};

/**
 *
 * @param {string} playerDiscordId DiscordID of the player voting for cancel set
 * @param {string} textChannelId DiscordID of the textChannel of the lobby
 * @returns
 */
const voteCancelSet = async (playerDiscordId, textChannelId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);

  const lobby = await getLobbyByTextChannel(textChannelId);
  if (!lobby) throw new NotFoundError("Lobby");

  const lp = await lobby.getLobbyPlayer(player.id);
  await lp.setCancelSet(!lp.cancelSet);

  const decided = await lobby.isCancelSetDecided();

  const opponentLp = await lp.getOpponent();
  const opponent = await opponentLp.getPlayer();

  if (decided) {
    await lp.setCancelSet(false);
    await opponentLp.setCancelSet(false);
  }

  return { decided, status: lp.cancelSet, opponent };
};

const resetVoteCancel = async (playerDiscordId, textChannelId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await getLobbyByTextChannelOrThrow(textChannelId);

  const lp = await lobby.getLobbyPlayer(player.id);
  const opponentLp = await lp.getOpponent();

  await lp.setCancelSet(false);
  await opponentLp.setCancelSet(false);
};

/**
 * Checks if the passed channel is being used for the player's lobby
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} textChannelId DiscordId of the textChannel
 * @returns True if the textChannel is assigned to this lobby, else false.
 */
const isInCurrentLobby = async (playerDiscordId, textChannelId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);
  const lobby = await player.getLobby("PLAYING");

  return lobby && lobby.textChannelId == textChannelId;
};

/**
 * Checks if the player is in any lobby (as SEARCHING, PLAYING, WAITING, CONFIRMATION...)
 * @param {string} playerDiscordId DiscordID of the player
 * @param {string} textChannelId DiscordId of the textChannel
 * @returns True if the textChannel is assigned to this lobby, else false.
 */
const isInAnyLobby = async (playerDiscordId) => {
  const player = await getPlayerOrThrow(playerDiscordId, true);

  return await player.hasLobbyPlayer();
};

/**
 * Delete lobbies of a type. If an ID is provided, delete only that player's lobby
 *
 * If the lobby has an unfinished gameset, cancel it.
 * @param {string} guildDiscordId
 * @param {string} type
 * @param {string} playerDiscordId
 * @returns
 */
const deleteLobbies = async (guildDiscordId, type, playerDiscordId) => {
  const guild = await getGuildOrThrow(guildDiscordId, true);

  if (playerDiscordId) {
    const player = await getPlayerOrThrow(playerDiscordId, true);

    const lobby = await player.getLobby(type);
    if (!lobby) return 0;

    await lobby.remove();
    return 1;
  }

  let lobbies = await guild.getLobbies();
  if (type) lobbies = lobbies.filter((lobby) => lobby.status == type);

  let count = 0;
  for (let lobby of lobbies) {
    const gameset = await lobby.getGameset();

    if (gameset && !gameset.finishedAt) {
      await gameset.remove();
    }

    await lobby.remove();
    count++;
  }

  return count;
};

module.exports = {
  search,
  stopSearch,
  getSearchingTiers,
  isSearching,
  matchmaking,
  getPlayingPlayers,
  acceptMatch,
  matchNotAccepted,
  timeoutMatch,
  setupArena,
  directMatch,
  searchAgainAfkLobby,
  closeArena,
  timeOutCheck,
  voteCancelSet,
  resetVoteCancel,
  isInCurrentLobby,
  removeAfkLobby,
  deleteLobbies,
  isInAnyLobby,
  avoidPlayer,
};
