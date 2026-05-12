// =======================
//   IMPORTS & SETUP
// =======================
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
// Switch from local sqlite storage to MongoDB for contacts
const { connect, saveContacts: mongoSaveContacts, getContacts: mongoGetContacts } = require('./mongo');
require("dotenv").config();

// Global error diagnostics
process.on("uncaughtException", err => {
    console.error("UNCAUGHT EXCEPTION:", err.stack || err.message);
});
process.on("unhandledRejection", reason => {
    console.error("UNHANDLED REJECTION:", reason);
});

const sgMail = require("@sendgrid/mail");
const SENDGRID_KEY = process.env.SENDGRID_KEY;
let sendgridEnabled = false;
if (SENDGRID_KEY) {
    try {
        sgMail.setApiKey(SENDGRID_KEY);
        sendgridEnabled = true;
    } catch (e) {
        console.error("SendGrid init error:", e.message);
    }
} else {
    console.warn("SENDGRID_KEY not set; email sending disabled.");
}

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(bodyParser.json());

// =======================
//   TEST ROUTE
// =======================
app.get("/", (req, res) => {
    res.send("SendGrid SOS Backend Running ✔");
});

// ======================================================
//   1) SAVE EMERGENCY CONTACTS (EMAILS + PHONES)
// ======================================================
app.post("/contacts/save", async (req, res) => {
  try {
    const { userId, emails = [], phones = [] } = req.body || {};
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ success:false, message:'Missing userId' });
    }
    const cleanedEmails = emails.map(e => (e||'').trim()).filter(Boolean);
    const cleanedPhones = phones.map(p => (p||'').trim()).filter(Boolean);
    await mongoSaveContacts(userId.trim(), cleanedEmails, cleanedPhones);
    res.json({ success:true, message:'Contacts saved successfully!', counts:{ emails: cleanedEmails.length, phones: cleanedPhones.length } });
  } catch (e) {
    console.error('[contacts/save] error', e);
    res.status(500).json({ success:false, message:'Internal error' });
  }
});

// Fetch contacts for a user (debug/verification)
app.get('/contacts/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const rows = await mongoGetContacts(userId);
        const emails = rows.map(r=>r.email).filter(Boolean);
        const phones = rows.map(r=>r.phone).filter(Boolean);
        res.json({ success:true, userId, emails, phones });
    } catch (e) {
        console.error('[contacts:get] error', e);
        res.status(500).json({ success:false, message:'Internal error' });
    }
});

// ======================================================
//   2) SOS → SendGrid Email Alert (SMS removed)
// ======================================================
app.post("/sos", (req, res) => {
    const { userId, userName } = req.body;

    mongoGetContacts(userId).then(async rows => {
        if (!rows.length) return res.json({ success:false, message:'No contacts saved!' });
        const emails = rows.map(r=>r.email).filter(Boolean);
        const phones = rows.map(r=>r.phone).filter(Boolean);

        const msg = `🚨 SOS ALERT!\n${userName} is in danger and needs help immediately!`;

        // =========================
        //   SEND EMAIL USING SENDGRID
        // =========================
        if (sendgridEnabled && process.env.SENDGRID_FROM) {
            for (let email of emails) {
                try {
                    await sgMail.send({
                        to: email,
                        from: process.env.SENDGRID_FROM,
                        subject: "🚨 SOS Emergency Alert",
                        text: msg
                    });
                } catch (error) {
                    console.error("SendGrid Email Error:", error.response?.body || error);
                }
            }
            return res.json({ success: true, message: "SOS emails sent" });
        } else {
            console.warn("Skipping SendGrid email send (disabled or FROM missing).");
            return res.json({ success: false, message: "SendGrid not configured" });
        }
    }).catch(err => {
        console.error('[sos] mongo fetch error', err);
        res.json({ success:false, message:'Error fetching contacts' });
    });
});

// ======================================================
//   3) GPS DANGER → Email User Automatically
// ======================================================
app.post("/gps-danger", async (req, res) => {
    const { email, reason } = req.body;

    const text = `⚠️ WARNING!\nYour GPS detected danger.\nReason: ${reason}\nStay alert and take precautions.`;

    if (sendgridEnabled) {
        try {
            await sgMail.send({
                to: email,
                from: process.env.SENDGRID_FROM,
                subject: "⚠️ GPS Danger Alert",
                text
            });
            res.json({ success: true, message: "GPS danger alert sent to user!" });
        } catch (error) {
            console.error("SendGrid Error:", error.response?.body || error);
            res.json({ success: false, error: error.message });
        }
    } else {
        console.warn("Skipping GPS danger email (SendGrid disabled).");
        res.json({ success: false, message: "SendGrid not configured" });
    }
});

// =======================
//   START SERVER
// =======================
connect().then(()=>{
    app.listen(PORT, () => {
        console.log(`🚀 Tourist-Safety backend running with Mongo on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('[mongo] Connection failed, continuing with server startup but routes will error:', err.message);
    app.listen(PORT, () => {
        console.log(`🚀 Tourist-Safety backend (NO Mongo) running on http://localhost:${PORT}`);
    });
});
