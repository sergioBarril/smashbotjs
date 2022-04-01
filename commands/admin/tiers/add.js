const tierAPI = require("../../../api/tier");

const add = async (interaction) => {
  const name = interaction.options.getString("name");
  const weight = interaction.options.getInteger("weight");
  const threshold = interaction.options.getInteger("threshold");
  const color = interaction.options.getString("color");
  const yuzu = interaction.options.getBoolean("yuzu");

  const guild = interaction.guild;

  // Add tier role
  let parsecRole;
  let yuzuRole;
  let role;

  if (yuzu) {
    parsecRole = await guild.roles.create({
      name: "Parsec",
      color: "0xF50049",
      mentionable: true,
      hoist: false,
    });
    yuzuRole = await guild.roles.create({
      name: "Yuzu",
      color: "0x02BAE7",
      mentionable: true,
      hoist: false,
    });
  }
  if (!yuzu) {
    role = await guild.roles.create({
      name,
      color,
      mentionable: true,
      hoist: true,
    });
  }

  // Add Channel
  await guild.fetch();
  const category = await guild.channels.cache.find(
    (chan) => chan.name === "MATCHMAKING" && chan.type === "GUILD_CATEGORY"
  );

  // PERMISSIONS MISSING
  let channel;
  if (category) {
    channel = await guild.channels.create(name, { parent: category.id });
  } else channel = await guild.channels.create(name);

  // Add it to the DB
  let responseText = "";
  if (yuzu) {
    await tierAPI.addYuzuTier(yuzuRole.id, parsecRole.id, guild.id, channel.id);
    responseText = `Los roles ${yuzuRole} y ${parsecRole} han sido creados y guardados en la BDD.`;
  } else {
    await tierAPI.addTier(role.id, guild.id, channel.id, weight, threshold);
    responseText += `El rol ${role} ha sido creado y guardado en la BDD.`;

    if (weight || weight === 0) {
      const rankedRole = await guild.roles.create({
        name: `${name} (Ranked)`,
        color,
        mentionable: true,
        hoist: true,
      });
      await tierAPI.addRankedTier(role.id, rankedRole.id);
      responseText += `El rol ${rankedRole} ha sido creado y guardado en la BDD.`;
    }
  }

  await interaction.reply({
    content: responseText,
    ephehemral: true,
  });
};

module.exports = { add };
