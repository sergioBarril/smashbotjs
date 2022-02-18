const tierAPI = require("../../../api/tier");
const guildAPI = require("../../../api/guild");
const { MessageActionRow, MessageButton } = require("discord.js");

const searchButtons = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("friendlies")
    .setLabel("Friendlies")
    .setStyle("SUCCESS"),
  new MessageButton()
    .setCustomId("cancel-friendlies")
    .setLabel("Cancel")
    .setStyle("DANGER")
);
const sendMessage = async (channel, name) => {
  return await channel.send({
    content: `**${name}**`,
    components: [searchButtons],
  });
};

const matchmaking = async (interaction) => {
  await interaction.deferReply({ ephehemral: true });
  // Remake the matchmaking channel
  const guild = interaction.guild;
  const guildInfo = await guildAPI.getGuild(guild.id);

  const adminChannel = await guild.channels.fetch(guildInfo.admin_channel_id);
  await adminChannel.send("Reset matchmaking channel");

  // Add Channel
  await guild.fetch();
  const category = await guild.channels.cache.find(
    (chan) => chan.name === "MATCHMAKING" && chan.type === "GUILD_CATEGORY"
  );

  // PERMISSIONS MISSING
  let searchChannel;
  if (category) {
    searchChannel = await guild.channels.create("matchmaking", {
      parent: category.id,
    });
  } else searchChannel = await guild.channels.create("matchmaking");

  const { weighted, open } = await tierAPI.getTiers(interaction.guild.id);

  // Swap channels
  const oldSearchChannel = await guild.channels.fetch(
    guildInfo.search_channel_id
  );
  await oldSearchChannel.delete();
  await guildAPI.setMatchmakingChannel(guild.id, searchChannel.id);

  if (weighted.length > 0) await searchChannel.send("__**CABLE LAN**__");
  for (tierInfo of weighted) {
    const tier = await guild.roles.fetch(tierInfo.discord_id);
    const message = await sendMessage(searchChannel, tier.name);
    await tierAPI.setSearchMessage(tier.id, message.id);
  }

  if (open.length > 0) await searchChannel.send("__**OTROS**__");
  for (tierInfo of open) {
    const tier = await guild.roles.fetch(tierInfo.discord_id);
    const message = await sendMessage(searchChannel, tier.name);
    await tierAPI.setSearchMessage(tier.id, message.id);
  }

  await interaction.editReply({
    content: `Canal de matchmaking actualizado`,
    ephehemral: true,
  });
};

module.exports = { matchmaking };
