const db = require("./db");

class PlayerReject {
  constructor({ rejected_at, rejected_player_id, rejecter_player_id }) {
    this.rejectedPlayerId = rejected_player_id;
    this.rejecterPlayerId = rejecter_player_id;
    this.rejectedAt = rejected_at;
  }

  setRejectedAt = async (client = null) => {
    await db.updateQuery(
      {
        text: `UPDATE player_reject
    SET rejected_at = NOW()
    WHERE rejected_player_id = $1
    AND rejecter_player_id = $2`,
        values: [this.rejectedPlayerId, this.rejecterPlayerId],
      },
      client
    );
  };

  remove = async (client = null) =>
    db.deleteQuery(
      {
        text: `DELETE FROM player_reject 
    WHERE rejected_player_id = $1 
    AND rejecter_player_id = $2`,
        values: [this.rejectedPlayerId, this.rejecterPlayerId],
      },
      client
    );
}

const removeOldRejects = async (timeMargin, client = null) => {
  const queryString = {
    text: `DELETE FROM player_reject
    WHERE rejected_at < (CURRENT_TIMESTAMP - ${timeMargin} * interval '1 minute')`,
  };

  await db.deleteQuery(queryString, client);
};

const countOldRejects = async (timeMargin, client = null) => {
  const queryString = {
    text: `SELECT COUNT(1) AS num_old FROM player_reject
    WHERE rejected_at < (CURRENT_TIMESTAMP - ${timeMargin} * interval '1 minute')`,
  };

  const result = await db.getQuery(queryString, client);
  return result.num_old;
};

module.exports = { PlayerReject, removeOldRejects, countOldRejects };
