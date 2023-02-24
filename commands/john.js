const { SlashCommandBuilder } = require("@discordjs/builders");
const { getGuild } = require("../api/guild");

const JOHNS = [
  "Has tenido suerte con ese lagazo justo al final.",
  "¿Seguro que vas por cable?",
  "Con un top tier como el tuyo yo también habría ganado.",
  "Esto offline no me lo haces.",
  "El bot no va bien, solo me toca contra gente campera.",
  "Si lo llego a saber no vengo...",
  "Joder el puto buffer.",
  "Ya, buena suerte techear eso online.",
  "Peleas como un granjero.",
];

const PREMIUM_JOHNS = [
  "Bueno, no lo he hecho mal para llevar solo 3 meses jugando.",
  "Voy a llamar a un admin para hacer lagtest.",
  "Mal MU, nada que hacer.",
  "Mi jungla no gankeaba.",
  "He perdido porque la música que ha tocado era una mierda.",
  "Grrrr.",
  "Te he leído TODO lo que ibas a hacer pero aun así he perdido. Mierda de juego.",
  "Vaya, parece que ha sido mi elección perder.",
  "Este MU online es como tirar una moneda.",
];

const BASIC_JOHNS = [
  "He perdido porque paso de campear.",
  "He perdido porque acabo de comer.",
  "He perdido porque estaba frío.",
  "He perdido porque hacía mucho que no jugaba.",
  "He perdido porque tengo sueño.",
  "He perdido porque juegas demasiado mal.",
  "Yo soy cola, tú pegamento.",
];

const FREE_JOHNS = ["He perdido porque no apoyo el bot en Ko-Fi: https://ko-fi.com/tropped"];

const data = new SlashCommandBuilder()
  .setName("john")
  .setDescription("Habrás perdido, pero aquí puedes activar tu carta trampa");

const execute = async (interaction) => {
  const guild = interaction.guild;

  const guildInfo = await getGuild(guild.id);
  const roles = interaction.member.roles.cache;

  let johnPool = [];

  if (!roles.has(guildInfo.supporterRoleId)) {
    johnPool = johnPool.concat(FREE_JOHNS);
  } else {
    johnPool = johnPool.concat(BASIC_JOHNS);

    if (
      roles.hasAny(
        guildInfo.grindSupporterRoleId,
        guildInfo.proSupporterRoleId,
        guildInfo.tryhardSupporterRoleId
      )
    ) {
      johnPool = johnPool.concat(JOHNS);
    }
    if (roles.hasAny(guildInfo.proSupporterRoleId, guildInfo.tryhardSupporterRoleId)) {
      johnPool = johnPool.concat(PREMIUM_JOHNS);
    }
  }

  const randomJohn = johnPool[Math.floor(Math.random() * johnPool.length)];

  await interaction.reply({ content: randomJohn });
};

module.exports = {
  data,
  execute,
};
