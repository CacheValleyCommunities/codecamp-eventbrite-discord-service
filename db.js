const Database = require('better-sqlite3');
const db = new Database('./data/attendees.db');

// Schema definition
const createTableSql = `
  CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    order_id TEXT UNIQUE,
    discord_user_id TEXT UNIQUE,
    role_redeemed INTEGER DEFAULT 0
  )
`;
db.prepare(createTableSql).run();

// Migration: Add discord_user_id column if it doesn't exist
try {
    db.prepare('SELECT discord_user_id FROM attendees LIMIT 1').get();
} catch (e) {
    if (e.message.includes('no such column') || e.message.includes('has no column named discord_user_id')) {
        console.log('Adding column: discord_user_id');
        db.prepare('ALTER TABLE attendees ADD COLUMN discord_user_id TEXT').run();
    } else {
        // Don't throw an error here if it's something else, just log it.
        // The table might be empty, causing a different kind of benign error on SELECT.
        console.warn('Pre-check for discord_user_id column failed, but not necessarily an error:', e.message);
    }
}

// Migration: Add role_redeemed column if it doesn't exist
try {
    db.prepare('SELECT role_redeemed FROM attendees LIMIT 1').get();
} catch (e) {
    if (e.message.includes('no such column') || e.message.includes('has no column named role_redeemed')) {
        console.log('Adding column: role_redeemed');
        db.prepare('ALTER TABLE attendees ADD COLUMN role_redeemed INTEGER DEFAULT 0').run();
    } else {
        console.warn('Pre-check for role_redeemed column failed, but not necessarily an error:', e.message);
    }
}


function saveAttendee(email, orderId) {
    try {
        db.prepare(`
      INSERT OR IGNORE INTO attendees (email, order_id)
      VALUES (?, ?)
    `).run(email.toLowerCase(), orderId);
    } catch (err) {
        console.error('DB Save Error:', err);
    }
}

function verifyAttendee(emailOrOrderId, callback) {
    try {
        const row = db.prepare(`
      SELECT id, email, order_id, role_redeemed, discord_user_id FROM attendees
      WHERE email = ? OR order_id = ?
    `).get(emailOrOrderId.toLowerCase(), emailOrOrderId);

        if (!row || row.role_redeemed) {
            return callback(null, { verified: false, message: 'Invalid request.' });
        }
        return callback(null, { verified: true, attendeeId: row.id });
    } catch (err) {
        console.error('DB Verify Error:', err);
        callback(err, { verified: false, message: 'Database error during verification.' });
    }
}

function markRoleAsRedeemed(attendeeId, discordUserId, callback) {
    try {
        const result = db.prepare(`
      UPDATE attendees
      SET role_redeemed = 1, discord_user_id = ?
      WHERE id = ? AND role_redeemed = 0
    `).run(discordUserId, attendeeId);

        if (result.changes > 0) {
            callback(null, true);
        } else {
            callback(null, false, 'Could not mark as redeemed. Already redeemed or attendee not found.');
        }
    } catch (err) {
        console.error('DB Mark Redeemed Error:', err);
        callback(err, false, 'Database error while marking role as redeemed.');
    }
}

module.exports = {
    saveAttendee,
    verifyAttendee,
    markRoleAsRedeemed
};