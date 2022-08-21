const tierAPI = require("../../../api/tier");
const guildAPI = require("../../../api/guild");
const { MessageActionRow, MessageButton } = require("discord.js");

const YUZU_EMOJI = "<:yuzu:945850935035441202>";
const PARSEC_EMOJI = "<:parsec:945853565405114510>";

const channelCommand = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;

  // Delete old channel
  let { rolesChannelId } = await guildAPI.getGuild(guild.id);
  if (rolesChannelId) {
    const channel = await guild.channels.fetch(rolesChannelId);
    await channel.delete();
  }

  // Add Channel
  await guild.fetch();
  const category = await guild.channels.cache.find(
    (chan) => chan.name === "PERFIL" && chan.type === "GUILD_CATEGORY"
  );

  let rolesChannel;
  if (category) {
    rolesChannel = await guild.channels.create("roles", {
      parent: category.id,
    });
  } else rolesChannel = await guild.channels.create("roles");

  // Set in DB
  await guildAPI.setRolesChannel(guild.id, rolesChannel.id);

  const yuzuButtons = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("yuzu-role")
      .setLabel("Yuzu (Host)")
      .setStyle("SECONDARY")
      .setEmoji(YUZU_EMOJI),
    new MessageButton()
      .setCustomId("parsec-role")
      .setLabel("Parsec (Client)")
      .setStyle("SECONDARY")
      .setEmoji(PARSEC_EMOJI)
  );

  // Send messages
  await rolesChannel.send({
    content:
      `**__YUZU__**\n` +
      `Para jugar partidas en Yuzu necesitaréis alguno de estos roles. ` +
      `Si podéis hostear partidas, dadle a **Yuzu** ${YUZU_EMOJI} y si podéis hacer de client dadle a **Parsec** ${PARSEC_EMOJI}.`,
    components: [yuzuButtons],
  });

  await interaction.editReply({
    content: `Listo: canal de roles creado en ${rolesChannel}`,
    ephehemral: true,
  });
};

module.exports = { channel: channelCommand };
