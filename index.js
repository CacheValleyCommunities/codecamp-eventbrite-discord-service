require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { saveAttendee, verifyAttendee } = require('./db');
const { assignRole } = require('./discord');

const app = express();
app.use(bodyParser.json());

// Eventbrite Webhook Endpoint
app.post('/eventbrite-webhook', (req, res) => {
    try {
        const webhook = req.body;

        console.log('Received webhook:', webhook);

        if (
            webhook.config?.action === 'order.placed' &&
            webhook.config?.endpoint_url
        ) {
            const email = webhook.merchant?.email || webhook.email;
            const orderId = webhook.config?.id;

            if (email && orderId) {
                saveAttendee(email, orderId);
                console.log(`✅ Saved attendee: ${email}`);
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook error:', err);
        res.sendStatus(500);
    }
});

// Discord Role Assignment
app.post('/api/assign-role', (req, res) => {
    const { discordTag, emailOrOrderId } = req.body;

    if (!discordTag || !discordTag.includes('#') || !emailOrOrderId) {
        return res.status(400).json({ error: 'Invalid input.' });
    }

    verifyAttendee(emailOrOrderId, async (err, isVerified) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!isVerified) return res.status(403).json({ error: 'Not verified with Eventbrite.' });

        try {
            await assignRole(discordTag);
            return res.json({ success: true, message: 'Role assigned.' });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    });
});

app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on port ${process.env.PORT}`);
});
