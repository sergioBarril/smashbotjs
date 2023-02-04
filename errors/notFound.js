const { CustomError } = require("./customError");

const messages = {
  LOBBY: {
    STOP_SEARCH: "¡No estabas buscando partida!",
    MATCH_NOT_ACCEPTED:
      "Este match ya había sido cancelado. ¿Quizá le has dado varias veces al botón? Si no es así, contacta con un admin.",
    DELETED_LOBBY:
      "Este lobby ya había sido eliminado. Contacta con un admin si crees que esto es un bug.",
    ALREADY_ACCEPTED_OR_REJECTED:
      "Este lobby ya había sido aceptado o rechazado. Contacta con un admin si no ha sido así.",
    CLOSE_ARENA: "Esta arena ya estaba cerrada. ¡Hasta pronto!",
    GAMESET: "La arena donde estuvieras ya cerró. ¡Busca partida de nuevo!",
    SURRENDER:
      "El comando /surrender tiene que ser usado en el canal de la arena donde estás jugando.",
    REMAKE: "El comando /remake tiene que ser usado en el canal de la arena donde estás jugando.",
  },
  GAMESET: {
    SURRENDER: "¡No estás jugando ningún set! No te puedes rendir si no estás jugando.",
    REMAKE: "¡No estás jugando ningún set! No hay nada a remakear si no estás jugando.",
  },
};

class NotFoundError extends CustomError {
  constructor(type, context = null, id = null) {
    super(null);

    const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
    let message;

    this.name = `${capitalized}NotFoundError`;

    const typeUpper = type.toUpperCase();

    if (typeUpper in messages) message = messages[typeUpper][context];

    if (type == "Tier") {
      if (context == "SEARCH_NO_TIER_ASSIGNED")
        message = "No tienes ninguna tier asignada: no puedes jugar aquí.";
    }

    if (!message) {
      const idMessage = id ? ` con ID _${id}_` : "";
      message = `No se ha encontrado: **${capitalized}**${idMessage}. Contacta con un administrador.`;
      this.log = true;
    }

    this.message = message;
  }
}

module.exports = { NotFoundError };
