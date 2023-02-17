const { MessageActionRow, MessageButton } = require("discord.js");
const guildAPI = require("../../../api/guild");

const rankedButtons = () => {
  return [
    new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("search")
        .setLabel("Ranked")
        .setStyle("SUCCESS")
        .setEmoji("⚔️"),
      new MessageButton().setCustomId("cancel-search").setLabel("Cancelar").setStyle("DANGER")
    ),
  ];
};

const channel = async (interaction) => {
  const guild = interaction.guild;

  await guildAPI.removeRankedChannelMessages(guild.id);

  // Add Channel
  await guild.fetch();
  const category = await guild.channels.cache.find(
    (chan) => chan.name === "MATCHMAKING" && chan.type === "GUILD_CATEGORY"
  );

  // PERMISSIONS MISSING
  let rankedChannel;
  const name = "ranked";
  if (category) {
    rankedChannel = await guild.channels.create(name, { parent: category.id });
  } else rankedChannel = await guild.channels.create(name);

  // Add it to the DB
  const oldChannelId = await guildAPI.getRankedChannel(guild.id);

  // Swap channels
  if (oldChannelId) {
    const oldChannel = await guild.channels.fetch(oldChannelId);
    await oldChannel.delete();
  }
  await guildAPI.setRankedChannel(guild.id, rankedChannel.id);

  const rankedMessage = await rankedChannel.send({
    content: "__**RANKED**__",
    components: rankedButtons(),
  });

  await guildAPI.insertMatchmakingMessage(
    guild.id,
    rankedMessage.id,
    null,
    false,
    false,
    true,
    true
  );

  await interaction.reply({
    content: "¡Canal de ranked creado!",
    ephehemral: true,
  });
};

module.exports = { channel };
