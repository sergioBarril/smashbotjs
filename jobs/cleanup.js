const { DiscordAPIError } = require("discord.js");
const cron = require("node-cron");
const winston = require("winston");
const { getAllGuilds } = require("../api/guild");
const { cancelSet } = require("../api/gameSet");
const { getMessagesFromLobby } = require("../api/message");
const { CustomError } = require("../errors/customError");
const { MESSAGE_TYPES } = require("../models/message");
const { AlreadyFinishedError } = require("../errors/alreadyFinished");

async function deleteMessage(guild, message) {
  let channel;

  if (message.channelId) channel = await guild.channels.fetch(message.channelId);
  else {
    const member = await guild.members.fetch(message.authorId);
    channel = await member.user.createDM();
  }

  try {
    const discordMessage = await channel.messages.fetch(message.discordId);
    await discordMessage.delete();
    winston.info(`[Cleanup job] Mensaje eliminado: ${message.discordId} de tipo: ${message.type}`);
  } catch (err) {
    if (err instanceof DiscordAPIError)
      winston.info(
        `[Cleanup job] El mensaje ${message.discordId} de tipo: ${message.type} ya había sido eliminado.`
      );
    else throw err;
  }
}

async function deleteChannel(guild, channelId) {
  try {
    const channel = await guild.channels.fetch(channelId);
    await channel.delete();
    winston.info(`[Cleanup job] Canal eliminado: ${channelId}`);
  } catch (e) {
    if (e instanceof DiscordAPIError) {
      winston.info(`[Cleanup job] El canal ${channelId} no se ha encontrado.`);
    } else throw e;
  }
}

async function cancelGameset(textChannelId) {
  try {
    await cancelSet(textChannelId);
    winston.info(`[Cleanup job] El set en curso ha sido cancelado.`);
  } catch (e) {
    if (e instanceof AlreadyFinishedError) {
      winston.info(`[Cleanup job] No había ningún set en curso.`);
    } else throw e;
  }
}

/**
 * Job that checks cleans up all lobbies at 6.30 am
 */
function dailyCleanup(client) {
  cron.schedule("30 06 */1 * *", async () => {
    try {
      winston.info(`[Cleanup job] Start`);
      const guildModels = await getAllGuilds();
      for (let guildModel of guildModels) {
        const guild = await client.guilds.fetch(guildModel.discordId);
        const lobbies = await guildModel.getLobbies();
        for (let lobby of lobbies) {
          try {
            const messages = await getMessagesFromLobby(lobby.id);
            for (let message of messages) {
              await deleteMessage(guild, message);
            }

            if (lobby.status === "PLAYING") {
              await cancelGameset(lobby.textChannelId);
              await deleteChannel(guild, lobby.textChannelId);
              await deleteChannel(guild, lobby.voiceChannelId);
            }

            await lobby.remove();
            winston.info(`[Cleanup job] Lobby eliminado`);
          } catch (error) {
            if (error instanceof CustomError) {
              winston.warn(error.message);
            } else {
              winston.error(error.message);
              winston.error(error.stack);
            }
          }
        }
      }

      winston.info(`[Cleanup job] End`);
    } catch (e) {
      winston.error(e);
    }
  });
}
module.exports = { dailyCleanup };
