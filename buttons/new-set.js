const setAPI = require("../api/gameSet");
const rolesAPI = require("../api/roles");

const smashCharacters = require("../params/smashCharacters.json");

const { MessageActionRow, MessageButton } = require("discord.js");

const exceptionHandler = async (interaction, exception) => {
  EXCEPTION_MESSAGES = {
    NO_LOBBY: "No estás en ninguna arena... ¡no puedes jugar un set aquí!",
    EXISTING_GAMESET: "¡Ya estás jugando un set aquí! Acabadlo, o canceladlo primero.",
  };
  const { name } = exception;

  // Get message
  let response = EXCEPTION_MESSAGES[name];
  if (!response) throw exception;

  // Send reply
  return await interaction.reply({
    content: response,
    ephemeral: true,
  });
};

const askChar = async (channel, player, guildId) => {
  const { mains, seconds, pockets } = await rolesAPI.getCharacters(player.id, guildId);

  const characters = mains.concat(seconds).concat(pockets);

  const rows = [];
  let i = 0;
  let row;

  for (character of characters) {
    const emoji = smashCharacters[character.name].emoji;
    if (i % 5 === 0) {
      if (row) rows.push(row);
      row = new MessageActionRow();
    }
    row.addComponents(
      new MessageButton()
        .setCustomId(`play-character-${player.id}-${i}`)
        .setLabel(character.name)
        .setStyle(character.type === "MAIN" ? "PRIMARY" : "SECONDARY")
        .setEmoji(emoji)
    );
    i++;
  }
  rows.push(row);

  const message = await channel.send({
    content: `${player}, selecciona el personaje que quieras jugar (con botones o usando \`/play\`).`,
    components: [...rows],
  });

  await setAPI.setCharMessage(player.id, message.id);
};

module.exports = {
  data: { name: "new-set" },
  async execute(interaction) {
    const channel = interaction.channel;

    try {
      const { players } = await setAPI.newSet(channel.id);

      const members = [];

      for (player of players) {
        const member = await interaction.guild.members.fetch(player.discord_id);
        members.push(member);
      }

      const memberFormatter = new Intl.ListFormat("es");
      const memberNames = memberFormatter.format(
        members.map((member) => `**${member.displayName}**`)
      );

      await interaction.reply({
        content: `¡Marchando un set BO5 entre ${memberNames}!`,
        components: [],
      });

      await Promise.all([members.map((member) => askChar(channel, member, interaction.guild.id))]);
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
