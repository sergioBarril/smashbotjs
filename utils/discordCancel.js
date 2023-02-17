const lobbyAPI = require("../api/lobby");
const { Guild } = require("discord.js");
const { Message, MESSAGE_TYPES } = require("../models/message");
const winston = require("winston");

/**
 * Edits the direct messages sent to the players
 * @param {Guild} guild DiscordJS Guild object
 * @param {Array<Message>} messages Direct messages to edit (will only edit LOBBY_PLAYERs)
 * @returns List of display names of the players
 */
const editDirectMessages = async (guild, messages) => {
  const discordMessages = [];

  const dms = messages.filter((m) => m.type === MESSAGE_TYPES.LOBBY_PLAYER);

  for (let dm of dms) {
    const member = await guild.members.fetch(dm.playerDiscordId);
    const dmChannel = await member.user.createDM();
    const message = await dmChannel.messages.fetch(dm.discordId);
    discordMessages.push({ member, message });
  }

  for (let { member, message } of discordMessages) {
    const opponent = discordMessages.find((dm) => dm.member.id !== member.id).member;
    message.edit({
      content: `Jugaste con **${opponent.displayName}**. GGs!`,
    });
  }

  return discordMessages.map((dm) => dm.member.displayName);
};

/**
 * Edits the LOBBY_TIER messages
 * @param {Guild} guild DiscordJs guild object
 * @param {Array<Message>} messages List of Message to edit
 * @param {Array<string>} playerNames List of displayName of all the players
 */
const editTierMessages = async (guild, messages, playerNames) => {
  const memberFormatter = new Intl.ListFormat("es", {
    style: "long",
    type: "conjunction",
  });
  const playerString = memberFormatter.format(playerNames.map((name) => `**${name}**`));

  const timestamp = new Date();

  const ltMessages = messages.filter((m) => m.type === MESSAGE_TYPES.LOBBY_TIER);

  for (messageInfo of ltMessages) {
    const channel = await guild.channels.fetch(messageInfo.channelId);
    const message = await channel.messages.fetch(messageInfo.discordId);

    const hours = timestamp.getHours();
    const minutes = timestamp.getMinutes();

    const hoursText = String(hours).padStart(2, "0");
    const minutesText = String(minutes).padStart(2, "0");

    message.edit({
      content: `${playerString} han terminado de jugar a las ${hoursText}:${minutesText}`,
      components: [],
    });
  }
};

/**
 * Deletes the channels of this lobby
 * @param {Guild} guild DiscordJS Guild
 * @param {Object} channels Channels of this lobby
 */
const channelsRemoval = async (guild, channels) => {
  const textChannel = await guild.channels.fetch(channels.text);
  const voiceChannel = await guild.channels.fetch(channels.voice);

  await new Promise((r) => setTimeout(r, 600000));

  textChannel.delete();
  voiceChannel.delete();
};

/**
 *
 * @param {User} player DiscordJS User
 * @param {Guild} guild DiscordJS Guild
 */
const cancelLobby = async (player, guild) => {
  const { channels, messages } = await lobbyAPI.closeArena(player.id);
  channelsRemoval(guild, channels);

  const playerNames = await editDirectMessages(guild, messages);
  await editTierMessages(guild, messages, playerNames);

  winston.info(`Se ha cerrado la arena de ${playerNames}`);
};

module.exports = {
  cancelLobby,
};
