const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./attendees.db');

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      order_id TEXT UNIQUE
    );
  `);
});

function saveAttendee(email, orderId) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO attendees (email, order_id) VALUES (?, ?)`);
    stmt.run(email.toLowerCase(), orderId);
    stmt.finalize();
}

function verifyAttendee(emailOrOrderId, callback) {
    db.get(
        `SELECT * FROM attendees WHERE email = ? OR order_id = ?`,
        [emailOrOrderId.toLowerCase(), emailOrOrderId],
        (err, row) => {
            if (err) return callback(err);
            callback(null, !!row);
        }
    );
}

module.exports = {
    saveAttendee,
    verifyAttendee,
};
