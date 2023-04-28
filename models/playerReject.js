const db = require("./db");

class PlayerReject {
  constructor({ rejected_at, rejected_player_id, rejecter_player_id, time_margin }) {
    this.rejectedPlayerId = rejected_player_id;
    this.rejecterPlayerId = rejecter_player_id;
    this.rejectedAt = rejected_at;
    this.timeMargin = time_margin;
  }

  setTimeMargin = async (timeMargin, client = null) => {
    await db.updateQuery(
      {
        text: `UPDATE player_reject SET time_margin = $1 
      WHERE rejected_player_id = $2
      AND rejecter_player = $3`,
        values: [timeMargin, this.rejectedPlayerId, this.rejecterPlayerId],
      },
      client
    );
  };

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

const removeOldRejects = async (client = null) => {
  const queryString = {
    text: `DELETE FROM player_reject
    WHERE rejected_at < (CURRENT_TIMESTAMP - time_margin * interval '1 minute')`,
  };

  await db.deleteQuery(queryString, client);
};

const countOldRejects = async (client = null) => {
  const queryString = {
    text: `SELECT COUNT(1) AS num_old FROM player_reject
    WHERE rejected_at < (CURRENT_TIMESTAMP - time_margin * interval '1 minute')`,
  };

  const result = await db.getQuery(queryString, client);
  return result.num_old;
};

module.exports = { PlayerReject, removeOldRejects, countOldRejects };
