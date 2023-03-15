const { SlashCommandBuilder } = require("@discordjs/builders");
const { getGuild } = require("../api/guild");

const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Resuelve las dudas habituales sobre el servidor o el bot.")
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("Pregunta frecuente")
      .setRequired(true)
      .setChoices([
        ["Sistema de puntuación", "SCORE"],
        ["Perfil", "PROFILE"],
        ["¿Cómo busco partida?", "SEARCH"],
        ["Rematch: ¡acabamos de jugar!", "REMATCH"],
        ["No me empareja con alguien", "NO_MATCH"],
        ["¡Rankeds y Tiers para gente sin cable!", "RANKED_WIFI"],
      ])
  )
  .addUserOption((option) =>
    option
      .setName("mention")
      .setDescription(
        "Si marcas esta opción, mencionarás a un usuario. De lo contrario el mensaje lo verás solo tú"
      )
      .setRequired(false)
  );

const SCORE_HELP =
  `Hay 5 tiers, siendo **Tier 1** la mejor y **Tier 4** la peor. En cada tier se empieza con una puntuación diferente:\n` +
  `- **Tier 1**: 2100 puntos\n- **Tier 2**: 1800 puntos\n- **Tier 3**: 1500 puntos\n- **Tier 4**: 1200 puntos.\n- **Tier 5**: 900 puntos.\n` +
  `Las rankeds se pueden jugar contra gente de **tu tier**, gente de **1 tier por encima** y **1 tier por debajo**.\n` +
  `**__Ranked con gente de tu tier__**\nSi juegas contra gente de tu tier, el ganador se llevará entre **25 y 35 puntos** según la racha de wins que lleve,` +
  ` y el perdedor perderá entre **25 y 35 puntos** según la racha de derrotas que lleve.\n` +
  `**__Ranked con gente de tier diferente__**\nPerder te quita 15 puntos. Ganar te da **15 puntos** si eres el que tiene más tier y **25** si eres el que menos tier tenías.\n` +
  `__**Rankeds de Tier 1**__\n` +
  `Para evitar que sus puntos lleguen hasta el infinito, la Tier 1 calcula sus puntos mediante el **algoritmo del ELO** normal y corriente.\n` +
  `__**Promoción**__\n` +
  `Cuando llegas al **límite de tu tier** (por ejemplo, a 1500 puntos siendo Tier 4), entrarás en promoción.` +
  ` A partir de entonces, solo se te emparejará con gente de la tier a la que quieres subir (en el ejemplo, Tier 3).` +
  ` Tendrás que ganar **3 de los próximos 5 sets**, cada win siendo contra una persona diferente. Si lo logras, pasarás a la Tier superior.` +
  ` Si no, te quedarás en la Tier que estabas, con los puntos: \`threshold - 50 + 20 * num wins en promo\`.\n` +
  `__**Descenso**__\n` +
  `Si tu puntuación baja **200 puntos del threshold**, pasarás a la Tier inferior. Es decir, si un Tier 3 con menos de 1300 puntos pasa a Tier 4`;

async function getSearchHelp(interaction) {
  const guild = interaction.guild;
  const guildInfo = await getGuild(guild.id);

  const mmChannel = await guild.channels.fetch(guildInfo.matchmakingChannelId);
  const rankedChannel = await guild.channels.fetch(guildInfo.rankedChannelId);

  const text =
    `Para buscar partida, podéis ir a ${mmChannel} y pulsar el botón de la lista donde querais buscar, teniendo en cuenta que:\n` +
    `\t- Solo podéis buscar en ranked o friendlies de Tier si tenéis cable.\n` +
    `\t- Solo podéis buscar friendlies en vuestra tier o tier peores.\n` +
    `En este canal también veréis **una lista con las partidas en curso** y la gente buscando.\n` +
    `\nTambién podéis buscar ranked en el canal dedicado ${rankedChannel}.\n` +
    `Finalmente, podéis encontrar friendlies también en los canales de cada tier, pulsando el en botón \`Jugar\` de alguien que ya esté buscando. `;

  return text;
}

async function getProfileHelp(interaction) {
  const guild = interaction.guild;
  await guild.commands.fetch();
  const mainCommand = guild.commands.cache.find((command) => command.name === "main");
  const secondCommand = guild.commands.cache.find((command) => command.name === "second");
  const pocketCommand = guild.commands.cache.find((command) => command.name === "pocket");

  const regionCommand = guild.commands.cache.find((command) => command.name === "region");
  const profileCommand = guild.commands.cache.find((command) => command.name === "profile");

  const messageText =
    `__**Asignar personajes**__\n` +
    `Asígnate personajes a tu perfil, y así te será mucho más cómodo seleccionarlos cuando juegues sets en el servidor.\n` +
    `\t- Usa el comando </main:${mainCommand.id}> para asignarte tus personajes principales (máximo 2). Por ejemplo, /main mario.\n` +
    `\t- Usa el comando </second:${secondCommand.id}> para asignarte tus personajes secundarios (máximo 3). Por ejemplo, /second lucina.\n` +
    `\t- Usa el comando </pocket:${pocketCommand.id}> para asignarte hasta 5 personajes más. Por ejemplo, /pocket cloud.\n` +
    `No hace falta que uséis que os asignéis tantos personajes, lo normal sería que jugarais 1, 2 o 3 personajes.\n\n` +
    `__**Asignar regiones**__\n\t- Usa el comando </region:${regionCommand.id}> para asignarte tu región (máximo 2). Por ejemplo, /region madrid\n` +
    `Las regiones disponibles a día de hoy son las siguientes: \`Albacete, Alicante, Andalucía, Aragón, Asturias, Baleares, Canarias, Cantabria, Catalunya, ` +
    `Castellón, Ciudad Real, Euskadi, Extremadura, Galicia, Guadalajara, León, Madrid, Murcia, La Rioja, Salamanca, Toledo, Valencia, Valladolid\`\n\n` +
    `__**Mostrar el perfil**__\n` +
    `Para poder ver tu perfil, usa el comando </profile:${profileCommand.id}>.\n\t- Si rellenas el parámetro \`player\`, mostrarás le perfil de ese jugador.` +
    `\n\t- Si rellenas el parámetro \`personal\`, el mensaje será privado y solo lo verás tú.`;
  return messageText;
}

const REMATCH_HELP =
  `Si jugáis un set de ranked con alguien y volvéis a lanzar búsqueda Ranked, **os puede volver a tocar**. Si queréis cancelar ese segundo set, adelante.\n` +
  `Si jugáis **2 sets de ranked** en un mismo día con una misma persona, **no volveréis a hacer match con ella hasta el día siguiente**. ¡Así que quizá os renta hacer un BO5 más y ya!`;

const NO_MATCH_HELP =
  `Si veis a alguien buscando partida y no os matchea, estos son los posibles motivos:\n` +
  `\t- Si ya habéis jugado **2 sets de ranked hoy**, no os volverá a emparejar con esa persona hasta mañana.\n` +
  `\t- Si estáis en **promoción**, solo jugaréis ranked contra gente de la tier a la que esperáis subir.\n` +
  `\t- Si el rival está en **promoción**, solo jugará ranked contra gente de la tier a la que quiere subir.\n` +
  `\t- Si estáis en promoción y ya habéis ganado a alguien, no podréis volver a hacer match ranked **hasta que acabe la promoción**.\n` +
  `\t- Si rechazas un match, no volveréis a matchear **hasta aprox. 45 minutos después**.`;

const RANKED_WIFI_HELP =
  `De momento **no voy a hacer ni tiers ni ranked para Wifi**, lo siento. Las razones:\n` +
  `\t- Tendría que poneros tier inicial y la mayoría o no os conozco, no habéis asistido a torneos, etc.` +
  `\t- Las condiciones del Online son peores, más inestables. Freeplays da más igual, pero en ranked habría muchas más cancelaciones y malos rollos.` +
  `\t- Es tiempo que preferiría emplear en otras cosas.\n` +
  `En su lugar... ¡compraos vosotros el cable!`;

const FAQ_TEXTS = {
  SCORE: async (interaction) => SCORE_HELP,
  PROFILE: getProfileHelp,
  REMATCH: async (interaction) => REMATCH_HELP,
  NO_MATCH: async (interaction) => NO_MATCH_HELP,
  RANKED_WIFI: async (interaction) => RANKED_WIFI_HELP,
  SEARCH: getSearchHelp,
};

module.exports = {
  data: data,
  async execute(interaction) {
    const faq = interaction.options.getString("question");
    const member = interaction.options.getMember("mention");
    const mentionText = member ? `_Este mensaje puede serle útil a: ${member}_\n\n` : "";

    const text = await FAQ_TEXTS[faq](interaction);
    await interaction.reply({ content: mentionText + text, ephemeral: member == null });
  },
};
