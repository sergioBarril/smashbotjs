const adminAPI = require("../../../api/admin");

const smashCharacters = require("../../../params/smashCharacters.json");
const spanishRegions = require("../../../params/spanishRegions.json");

const upsert = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;

  // Get type
  const type = interaction.options.getString("type");

  // Get admin channel
  const adminChannelId = await adminAPI.getAdminChannel(guild.id);
  const adminChannel = await interaction.guild.channels.fetch(adminChannelId);

  await adminChannel.send(
    `**Role Update:** ${type}\n` + `**Triggered by**: ${interaction.member.displayName}`
  );

  // Get current roles
  await guild.roles.fetch();
  let currentRoles = guild.roles.cache;

  let inserted = 0;
  let updated = 0;

  // Guild role update
  let targetObject;
  switch (type) {
    case "CHARACTERS":
      targetObject = smashCharacters;
      break;
    case "REGIONS":
      targetObject = spanishRegions;
      break;
  }

  const keyNames = Object.keys(targetObject);

  for (key of keyNames) {
    const role = currentRoles.find((role) => role.name === key);

    const value = targetObject[key];

    if (role) {
      if (role.color != value.color) {
        await role.edit({
          name: key,
          color: value.color,
          mentionable: false,
        });
        updated++;
      }
    } else {
      await guild.roles.create({
        name: key,
        color: value.color,
        mentionable: false,
      });
      inserted++;
    }
  }

  await adminChannel.send(
    `**Guild roles summary:**\n` +
      `**Roles inserted:** ${inserted}\n` +
      `**Roles updated:** ${updated}`
  );

  // Database Role update
  await guild.roles.fetch();
  currentRoles = guild.roles.cache.filter((role) => keyNames.includes(role.name));

  const roleList = Array.from(currentRoles.values());
  const { baseInserted, rolesInserted, rolesUpdated } = await adminAPI.upsertRoles(roleList, type);

  // Output results
  await adminChannel.send(
    `**Database Summary:**\n` +
      `**Base elements inserted:** ${baseInserted}\n` +
      `**Roles inserted:** ${rolesInserted}\n` +
      `**Roles updated:** ${rolesUpdated}`
  );

  await interaction.editReply("Roles imported successfully.");
};

module.exports = { upsert };
