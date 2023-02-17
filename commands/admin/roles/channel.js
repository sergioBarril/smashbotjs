const guildAPI = require("../../../api/guild");
const { MessageActionRow, MessageButton } = require("discord.js");
const winston = require("winston");

const YUZU_EMOJI = "<:yuzu:945850935035441202>";
const PARSEC_EMOJI = "<:parsec:945853565405114510>";
const WIFI_EMOJI = "<:wifi:945988666994602065>";

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

  const wifiButton = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId("wifi-role")
      .setLabel("Wifi")
      .setStyle("SECONDARY")
      .setEmoji(WIFI_EMOJI)
  );

  // Send messages
  await rolesChannel.send({
    content:
      `**__YUZU__**\n` +
      `Para jugar partidas en Yuzu necesitaréis alguno de estos roles. ` +
      `Si podéis hostear partidas, dadle a **Yuzu** ${YUZU_EMOJI} y si podéis hacer de client dadle a **Parsec** ${PARSEC_EMOJI}.`,
    components: [yuzuButtons],
  });

  await rolesChannel.send({
    content:
      `**__WIFI__**\n` +
      `Para que os notifique cuando alguien busque partida sin cable, necesitaréis el rol de **Wifi**. Os lo podéis poner/quitar dándole a este botón:`,
    components: [wifiButton],
  });

  winston.info(`[${interaction.user.username}] Canal de roles creado`);
  await interaction.editReply({
    content: `Listo: canal de roles creado en ${rolesChannel}`,
    ephehemral: true,
  });
};

module.exports = { channel: channelCommand };
