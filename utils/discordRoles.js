const smashCharacters = require("../params/smashCharacters.json");
const { normalizeCharacter } = require("./normalize");

const assignRole = async (interaction, name, type) => {
  if (["MAIN", "SECOND", "POCKET"].includes(type)) {
    const key = normalizeCharacter(name);
    if (!key)
      return await interaction.reply({
        content: `No he encontrado el personaje ${name}. ¿Lo has escrito bien?`,
        ephemeral: true,
      });

    return await interaction.reply({
      content: `Te he asignado a **${key}** ${
        smashCharacters[key].emoji
      } como ${type.toLowerCase()}.`,
      ephemeral: true,
    });
  }
};

module.exports = {
  assignRole,
};
