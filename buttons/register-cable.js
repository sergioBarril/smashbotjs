const { MessageButton, MessageActionRow } = require("discord.js");

const WIFI_EMOJI = "<:wifi:945988666994602065>";

const cableResponseButtons = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId("register-cable-done")
    .setLabel("Todo respondido")
    .setStyle("SUCCESS")
    .setEmoji("✅"),
  new MessageButton()
    .setCustomId("register-cable-help")
    .setLabel("¡Ayuda!")
    .setStyle("PRIMARY")
    .setEmoji("\u2139"),
  new MessageButton()
    .setCustomId("register-wifi")
    .setLabel("No tengo cable")
    .setStyle("DANGER")
    .setEmoji(WIFI_EMOJI)
);

const execute = async (interaction) => {
  const messageText =
    `Vale, dices tener **cable LAN** para conectarte por cable a Internet en la Switch.\n` +
    `Así, tendrás acceso las partidas con Tiers, las rankeds, etc. ¡Y espero que partidas con menos lag!\n\n` +
    `Ahora voy a pedirte unas pocas cosas para poder darte el rol adecuado:\n` +
    `\t1. **(Obligatorio)** Necesitaré que me mandes una foto (por este canal mismo) donde se vea que en efecto posees conexión por cable en la Switch.` +
    ` No haré nada con esa foto, y se borrará cuando borre este canal, pero es para garantizar unas mejores condiciones de online.\n` +
    `\t2. Tu **apodo** en smash.gg (si no tienes o no has jugado ningún torneo nunca, ¡ningún problema!)\n` +
    `\t3. ¿Vives en España?\n` +
    `\t4. **Comentarios sobre tu nivel**. ¿Alguien a quien hayas ganado que merezca la pena destacar? ¿Has ido a pocos torneos y eres principiante? ¿Mejores posiciones en torneos?\n` +
    `\tEso me ayudará a determinar mejor en qué Tier ponerte :)\n\n` +
    `Una vez hayas respondido a esto, pulsa el botón verde de **"Todo respondido"** para avisar a un Admin y te asigne el rol adecuado.\n` +
    `Si tienes alguna duda, pulsa el botón azul de **"Ayuda"**\n` +
    `Si realmente no tienes cable o te da pereza responder a todo esto y` +
    ` con jugar con gente por Wifi te vale, pulsa el botón rojo de **"No tengo cable"**`;

  const message = interaction.message;

  // Disable first message buttons
  message.components[0].components.forEach((button) => button.setDisabled(true));
  await interaction.message.edit({
    content: message.content,
    components: message.components,
  });

  // Reply with new text + buttons
  await interaction.reply({ content: messageText, components: [cableResponseButtons] });
};

module.exports = {
  data: { name: "register-cable" },
  execute,
};
