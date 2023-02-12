const { MessageActionRow, MessageButton, Permissions } = require("discord.js");
const winston = require("winston");
const playerAPI = require("../api/player");
const { CustomError } = require("../errors/customError");
const { NotFoundError } = require("../errors/notFound");

const WIFI_EMOJI = "<:wifi:945988666994602065>";

const cableButtons = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("register-cable")
    .setLabel("Sí (te pediré que lo demuestres más adelante)")
    .setStyle("SECONDARY")
    .setEmoji("🔌"),
  new MessageButton()
    .setCustomId("register-wifi")
    .setLabel("No, voy por Wifi pero me va bien")
    .setStyle("SECONDARY")
    .setEmoji(WIFI_EMOJI)
);

const execute = async (interaction) => {
  // Check if player already registered
  const player = interaction.member;
  const alreadyRegistered = await playerAPI.isRegistered(player.id);
  if (alreadyRegistered)
    throw new CustomError("¡Ya estás registrado, o tienes un proceso de registro abierto ya!");

  // Create private channel
  const guild = interaction.guild;
  await guild.fetch();
  const category = await guild.channels.cache.find(
    (chan) => chan.name === "REGISTROS" && chan.type === "GUILD_CATEGORY"
  );

  let registerChannel;
  const name = "canal-de-registro";
  if (category) {
    registerChannel = await guild.channels.create(name, {
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [Permissions.FLAGS.VIEW_CHANNEL],
        },
        { id: player.id, allow: [Permissions.FLAGS.VIEW_CHANNEL] },
      ],
    });
  } else throw new NotFoundError("Category", "No se ha encontrado la categoría REGISTROS");

  // Register the player
  await playerAPI.register(player.id, guild.id);

  // Send message
  let messageText =
    `¡Hola, **${player.displayName}**! Voy a hacerte unas pocas preguntas para darte los roles adecuados.\n\n` +
    `**Primera pregunta**: ¿tienes adaptador de cable LAN para conectarte a Internet por cable en la Switch?\n`;

  winston.info(`Canal de registro creado para ${player.displayName}`);

  await registerChannel.send({
    content: messageText,
    components: [cableButtons],
  });

  await interaction.reply({
    content: `¡Perfecto, dirígete a ${registerChannel} para completar el registro!`,
    ephemeral: true,
  });
};

module.exports = {
  data: { name: "register" },
  execute,
};
