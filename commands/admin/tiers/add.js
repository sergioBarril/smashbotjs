const tierAPI = require("../../../api/tier");

const add = async (interaction) => {
  const name = interaction.options.getString("name");
  const weight = interaction.options.getInteger("weight");
  const threshold = interaction.options.getInteger("threshold");
  const color = interaction.options.getString("color");

  // Add tier role
  const guild = interaction.guild;

  const role = await guild.roles.create({
    name,
    color,
    mentionable: true,
    hoist: true,
  });

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
  await tierAPI.addTier(role.id, guild.id, channel.id, weight, threshold);

  await interaction.reply({
    content: `El rol ${role} ha sido creado y añadido a la base de datos.`,
    ephehemral: true,
  });
};

module.exports = { add };
