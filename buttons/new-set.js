const setAPI = require("../api/gameSet");
const { setupCharacter } = require("../utils/discordGameset");

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

      await interaction.channel.send("__**Game 1**__");

      await Promise.all([
        members.map((member) => setupCharacter(channel, member, interaction.guild.id, 1)),
      ]);
    } catch (e) {
      await exceptionHandler(interaction, e);
    }
  },
};
