require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const mailgun = require('mailgun-js'); // Add this line
const { saveAttendee, verifyAttendee, markRoleAsRedeemed } = require('./db'); // Updated to include markRoleAsRedeemed
const { assignRole, getDiscordUser } = require('./discord'); // Assuming getDiscordUser might be added later

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Add this line

// Explicitly serve index.html for the root path
app.get('/', (req, res) => {
    console.log(`GET request for root path: ${req.method} ${req.originalUrl}`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Mailgun
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN }); // Add this line

// Function to send a modern HTML email
async function sendWelcomeEmail(recipientEmail, orderDetails) {
    const emailSubject = 'Welcome to Code Camp! Your Order Confirmation';
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${emailSubject}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f0f2f5;
            color: #333;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
            border: 1px solid #e0e0e0;
        }
        .email-header {
            background-color: #5865F2; /* Discord-like blue */
            color: #ffffff;
            padding: 30px 40px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px 40px;
        }
        .email-body p {
            margin-bottom: 1em;
            font-size: 16px;
        }
        .email-body .greeting {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 1.5em;
        }
        .order-details {
            margin-top: 2em;
            padding: 1.5em;
            background-color: #f9f9f9;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .order-details h2 {
            margin-top: 0;
            margin-bottom: 1em;
            font-size: 18px;
            color: #2c3e50;
        }
        .order-details p {
            font-size: 15px;
            margin-bottom: 0.5em;
        }
        .button-container {
            text-align: center;
            margin-top: 2em;
        }
        .button {
            display: inline-block;
            background-color: #5865F2;
            color: #ffffff!important;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 16px;
        }
        .email-footer {
            text-align: center;
            padding: 20px 40px;
            font-size: 12px;
            color: #777;
            background-color: #f0f2f5;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Welcome to CodeCamp: Bridgerland!</h1>
        </div>
        <div class="email-body">
            <p class="greeting">Hi ${orderDetails.name || 'there'},</p>
            <p>Thank you for your order for CodeCamp: Bridgerland! We're excited to have you.</p>

            <div class="order-details">
                <h2>Your Order Summary</h2>
                <p><strong>Order ID:</strong> ${orderDetails.id}</p>
                <p><strong>Email:</strong> ${recipientEmail}</p>
            </div>

            <p>If you haven't already, you can get your Discord role assigned by visiting our verification page:</p>
            <div class="button-container">
                <a href="https://link-discord-codecamp.cachevalley.co/" class="button">Verify for Discord Role</a>
            </div>
            <p>If you have any questions, feel free to reply to this email.</p>
            <p>See you at CodeCamp: Bridgerland!</p>
        </div>
        <div class="email-footer">
            <p>&copy; ${new Date().getFullYear()} CodeCamp: Bridgerland. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;

    const data = {
        from: `Code Camp <noreply@${process.env.MAILGUN_DOMAIN}>`,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml
    };

    try {
        const body = await mg.messages().send(data);
        console.log(`✅ Email sent to ${recipientEmail}:`, body);
    } catch (error) {
        console.error(`Error sending email to ${recipientEmail}:`, error);
    }
}

// webhook body
// api_url: 'https://www.eventbriteapi.com/v3/orders/12674429023/',
// config: {
// action: 'order.placed',
// endpoint_url: 'https://link-discord-codecamp.cachevalley.co/eventbrite-webhook/eventbrite-webhook',
// webhook_id: '14637573',
// user_id: '2727453340181'
// }

// Eventbrite Webhook Endpoint
app.post('/eventbrite-webhook', (req, res) => {
    try {
        const webhook = req.body;

        console.log('Received webhook:', webhook);

        if (
            webhook.config?.action === 'order.placed' &&
            webhook.config?.endpoint_url
        ) {
            fetch(webhook.api_url, {
                headers: {
                    Authorization: `Bearer ${process.env.EVENTBRITE_API_PRIVATE_TOKEN}` // Corrected variable name
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(orderDetails => {
                    console.log('Order details:', orderDetails);
                    const email = orderDetails.email;
                    // Assuming orderId is part of orderDetails or can be derived. Eventbrite API usually provides id for the order.
                    const orderId = orderDetails.id;

                    if (email && orderId) {
                        saveAttendee(email, orderId.toString());
                        console.log(`✅ Saved attendee: ${email}`);
                        // Send welcome email
                        sendWelcomeEmail(email, orderDetails);
                    } else {
                        console.error('Could not extract email or orderId from orderDetails:', orderDetails);
                    }
                })
                .catch(err => {
                    console.error('Error fetching order details:', err);
                });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook error:', err);
        res.sendStatus(500);
    }
});

app.post('/api/assign-role', async (req, res) => {
    const { discordTag, emailOrOrderId } = req.body;

    if (!discordTag || !emailOrOrderId) {
        return res.status(400).json({ error: 'Discord tag and email/order ID are required.' });
    }

    verifyAttendee(emailOrOrderId, async (err, verificationResult) => {
        if (err) {
            console.error('Verification DB error:', err);
            return res.status(500).json({ error: 'An error occurred while processing your request.' });
        }

        if (!verificationResult.verified) {
            return res.status(400).json({ error: 'Invalid request.' });
        }

        let discordUserId = discordTag;

        try {
            await assignRole(discordTag);

            markRoleAsRedeemed(verificationResult.attendeeId, discordUserId, (redeemErr, success, redeemMessage) => {
                if (redeemErr) {
                    console.error('DB Mark Redeemed Error:', redeemErr);
                    return res.status(500).json({ error: 'Role assigned, but failed to mark as redeemed in database. Please contact support.' });
                }
                if (!success) {
                    console.warn('Failed to mark role as redeemed after assignment:', redeemMessage);
                    return res.status(500).json({ error: 'Role assigned, but status update failed.' });
                }
                return res.json({ success: true, message: 'Role assigned successfully.' });
            });

        } catch (e) {
            console.error('Role assignment error:', e);
            if (e.message && e.message.toLowerCase().includes('already has role')) {
                markRoleAsRedeemed(verificationResult.attendeeId, discordUserId, (redeemErr, success, redeemMessage) => {
                    if (redeemErr || !success) {
                        console.error('Error marking role as redeemed for user who already had it:', redeemErr || redeemMessage);
                        return res.status(500).json({ error: 'An error occurred while processing your request.' });
                    }
                    return res.status(200).json({ success: true, message: 'Role assigned successfully.' });
                });
            } else {
                return res.status(500).json({ error: 'Failed to assign Discord role.' });
            }
        }
    });
});

app.use((req, res, next) => {
    console.log(`404 - Path not found: ${req.method} ${req.originalUrl}`);
    res.status(404).send("Sorry, can't find that!");
});

app.listen(process.env.PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${process.env.PORT} and listening on 0.0.0.0`);
});
