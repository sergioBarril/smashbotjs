const tierAPI = require("../../../api/tier");
const guildAPI = require("../../../api/guild");
const { MessageActionRow, MessageButton, Interaction } = require("discord.js");

const searchButtons = new MessageActionRow().addComponents(
  new MessageButton().setCustomId("search").setLabel("Jugar").setStyle("SUCCESS"),
  new MessageButton().setCustomId("cancel-search").setLabel("Cancelar").setStyle("DANGER")
);

const rankedButtons = new MessageActionRow().addComponents(
  new MessageButton().setCustomId("search").setLabel("Ranked").setStyle("PRIMARY").setEmoji("⚔️"),
  new MessageButton().setCustomId("cancel-search").setLabel("Cancelar").setStyle("DANGER")
);

const searchAllButtons = new MessageActionRow().addComponents(
  new MessageButton().setCustomId("search-all-tiers").setLabel("Jugar").setStyle("SUCCESS"),
  new MessageButton().setCustomId("cancel-search-all-tiers").setLabel("Cancelar").setStyle("DANGER")
);

const sendMessage = async (channel, name) => {
  return channel.send({
    content: `**${name}**`,
    components: [searchButtons],
  });
};

/**
 * Remakes the matchmaking channel
 * @param {Interaction} interaction DiscordJS interaction
 */
const matchmaking = async (interaction) => {
  await interaction.deferReply({ ephehemral: true });

  const guild = interaction.guild;
  const guildInfo = await guildAPI.getGuild(guild.id);

  const adminChannel = await guild.channels.fetch(guildInfo.adminChannelId);
  await adminChannel.send("Reset matchmaking channel");

  // Add Channel
  await guild.fetch();
  const category = guild.channels.cache.find(
    (chan) => chan.name === "MATCHMAKING" && chan.type === "GUILD_CATEGORY"
  );

  let matchmakingChannel;
  if (category) {
    matchmakingChannel = await guild.channels.create("matchmaking", {
      parent: category.id,
    });
  } else {
    // TODO: Create category
    matchmakingChannel = await guild.channels.create("matchmaking");
  }

  const { weighted, open } = await tierAPI.getTiers(interaction.guild.id);

  // Swap channels
  const oldMatchmakingChannel = await guild.channels.fetch(guildInfo.matchmakingChannelId);
  await oldMatchmakingChannel.delete();

  await guildAPI.setMatchmakingChannel(guild.id, matchmakingChannel.id);
  await guildAPI.removeAllGuildSearchMessages(guild.id);

  const rankedMessage = await matchmakingChannel.send({
    content: "__**RANKED**__",
    components: [rankedButtons],
  });

  await guildAPI.insertMatchmakingMessage(guild.id, rankedMessage.id, null, false, false, true);

  if (weighted.length > 0) await matchmakingChannel.send("__**CABLE LAN**__");
  for (let tier of weighted) {
    const role = await guild.roles.fetch(tier.roleId);
    const message = await sendMessage(matchmakingChannel, role.name);
    await guildAPI.insertMatchmakingMessage(guild.id, message.id, tier.roleId);
  }

  await matchmakingChannel.send({
    content: `**Todas las tiers**`,
    components: [searchAllButtons],
  });

  if (open.length > 0) await matchmakingChannel.send("__**OTROS**__");
  for (let tier of open) {
    if (tier.yuzu) {
      const message = await sendMessage(matchmakingChannel, "Yuzu");
      await guildAPI.insertMatchmakingMessage(guild.id, message.id, null, true);
    } else {
      const role = await guild.roles.fetch(tier.roleId);
      const message = await sendMessage(matchmakingChannel, role.name);
      await guildAPI.insertMatchmakingMessage(guild.id, message.id, tier.roleId);
    }
  }

  const listMessage = await matchmakingChannel.send("Lista");
  await guildAPI.insertListMessage(guild.id, listMessage.id);

  await interaction.editReply({
    content: `Canal de matchmaking actualizado`,
    ephehemral: true,
  });
};

module.exports = { matchmaking };
