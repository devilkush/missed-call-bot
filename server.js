require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const { OpenAI } = require("openai");
const { MongoClient } = require("mongodb");
const db_helpers = require("./db");
const optout = require("./optout");
const ratelimit = require("./ratelimit");
const emailService = require("./email");
const { initScheduler } = require("./scheduler");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let db;
MongoClient.connect(process.env.MONGODB_URI)
  .then((client) => {
    db = client.db("zeromisscall");
    db_helpers.ensureIndexes(db);
    initScheduler(app, db, db_helpers, emailService);
    console.log("✅ MongoDB connected");
    console.log("✅ MongoDB indexes ensured");
  })
  .catch((err) => console.error("❌ MongoDB error:", err));

// ─────────────────────────────────────────────
// EMERGENCY KEYWORDS
// ─────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
  "burst", "flooding", "flooded", "flood",
  "leak", "leaking", "pipe burst", "broken pipe",
  "no hot water", "no water", "gas leak", "gas smell",
  "sewage", "overflow", "overflowing", "emergency",
  "urgent", "asap", "immediately", "help",
  "water everywhere", "ceiling leaking", "ceiling dripping",
  "water damage", "cant turn off", "can't turn off",
  "valve stuck", "pipe cracked", "pipe broken",
];

function isEmergency(text) {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────
// DEDUPLICATION
// ─────────────────────────────────────────────
const recentMissedCalls = new Map();

function isDuplicate(callSid) {
  const WINDOW_MS = 60_000;
  const now = Date.now();
  if (recentMissedCalls.has(callSid)) return true;
  recentMissedCalls.set(callSid, now);
  if (recentMissedCalls.size > 200) {
    for (const [sid, ts] of recentMissedCalls) {
      if (now - ts > WINDOW_MS) recentMissedCalls.delete(sid);
    }
  }
  return false;
}

// ─────────────────────────────────────────────
// BUILD SYSTEM PROMPT FOR OPENAI
// ─────────────────────────────────────────────
function buildSystemPrompt(plumber) {
  const faqBlock =
    plumber.customFaqs && plumber.customFaqs.length > 0
      ? `\n\nCUSTOM FAQs FOR THIS BUSINESS:\n` +
        plumber.customFaqs
          .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
          .join("\n\n")
      : "";

  const servicesBlock =
    plumber.services && plumber.services.length > 0
      ? `\nSERVICES OFFERED: ${plumber.services.join(", ")}`
      : "";

  return `You are a friendly, professional AI assistant for ${plumber.businessName}, a plumbing business in the US. You handle text conversations with customers who just called and didn't get through.

YOUR GOAL: Keep the customer engaged, answer their questions, and capture three things:
1. What they need (describe the problem or job)
2. Their zip code (to confirm we cover their area)
3. When they'd like someone to come out

BUSINESS DETAILS:
- Business: ${plumber.businessName}
- Owner: ${plumber.ownerName}
- Service area: ${plumber.serviceArea}
- Hours: ${plumber.hours}
- Emergency 24/7: ${plumber.emergencyAvailable ? "Yes" : "No — for genuine emergencies refer to 911 or a 24hr service"}${servicesBlock}

PLUMBING KNOWLEDGE (use naturally when relevant):
- Common jobs: drain unblocking, boiler servicing/repair, water heater replacement (tank & tankless), bathroom/kitchen installs, leak detection and repair, pipe repair/replacement, radiator issues, outside tap installs, water pressure problems, toilet/cistern repairs, stopcock and valve issues.
- For active leaks: advise customer to locate and shut off the main stop valve — usually under the kitchen sink or near the water meter.
- Pricing: NEVER quote specific prices. Always say the owner will provide a clear, no-obligation quote before any work starts. No surprises.
- Licensing: if asked, confirm the business is fully licensed and insured in their state (unless a customFaq says otherwise).

TONE AND STYLE:
1. Warm, human, and concise. This is SMS — aim for 2-3 sentences per message unless more is genuinely needed.
2. Never start two consecutive replies the same way.
3. If asked whether you're a bot: be honest. Say you're an AI assistant for ${plumber.businessName} and that ${plumber.ownerName} will follow up personally.
4. Never mention competitors or compare prices.
5. No robotic sign-offs like "Best regards" or "Sincerely".
6. If the job sounds complex or needs a site visit, say ${plumber.ownerName} will call them back shortly.
7. Once you have all three pieces of info (what they need, zip code, preferred time) — confirm you have it and tell them ${plumber.ownerName} will be in touch to confirm. Don't keep asking unnecessary questions after that.
8. You are texting on behalf of ${plumber.businessName} — stay in character at all times.${faqBlock}`;
}

// ─────────────────────────────────────────────
// SEND SMS HELPER
// ─────────────────────────────────────────────
async function sendSMS(to, from, body) {
  return twilioClient.messages.create({ to, from, body });
}

// ─────────────────────────────────────────────
// WEBHOOK 1: /voice
// ─────────────────────────────────────────────
app.post("/voice", async (req, res) => {
  const twilioNumber = req.body.To;
  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  const businessName = plumber ? plumber.businessName : "us";
  const ownerName    = plumber ? plumber.ownerName    : "the team";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: "Polly.Joanna-Neural" },
    `Hey, thanks for calling ${businessName}! ${ownerName} is probably out on a job right now. ` +
      `We're sending you a text right now so we can get you sorted fast. Talk soon!`
  );

  twiml.hangup();
  res.type("text/xml");
  res.send(twiml.toString());
});

// ─────────────────────────────────────────────
// WEBHOOK 2: /missed-call
// ─────────────────────────────────────────────
app.post("/missed-call", async (req, res) => {
  const callerNumber = req.body.From;
  const twilioNumber = req.body.To;
  const callStatus   = req.body.CallStatus;
  const callSid      = req.body.CallSid;

  console.log(`📞 ${callStatus} | From: ${callerNumber} | To: ${twilioNumber} | SID: ${callSid}`);

  const missedStatuses = ["no-answer", "busy", "failed", "canceled"];
  if (!missedStatuses.includes(callStatus)) {
    return res.status(200).send("Call was answered — no action needed.");
  }

  if (callSid && isDuplicate(callSid)) {
    console.log(`⏭️  Duplicate callback for ${callSid} — skipping.`);
    return res.status(200).send("Duplicate — skipped.");
  }

  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  if (!plumber) {
    console.warn(`⚠️  No plumber config found for: ${twilioNumber}`);
    return res.status(200).send("No config found.");
  }

  const openingMessage =
    `Hey! Thanks for calling ${plumber.businessName} — sorry we missed you, ` +
    `we're probably out on a job. I can help you right now over text. What do you need?`;

  try {
    // ── OPT-OUT GATE ─────────────────────────────────────────
    const blocked = await optout.isBlockedFromSending(
      db_helpers, db, twilioNumber, callerNumber
    );
    if (blocked) {
      console.log(`🚫 Skipping opening text — ${callerNumber} has opted out.`);
      return res.status(200).send("Opted out — no message sent.");
    }

    await sendSMS(callerNumber, twilioNumber, openingMessage);
    await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", openingMessage);

    if (plumber.ownerPhone) {
      await sendSMS(
        plumber.ownerPhone,
        twilioNumber,
        `📞 Missed call from ${callerNumber}. Auto-reply sent — conversation started.`
      );
    }

    console.log(`✅ Opening text sent to ${callerNumber}`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error sending opening message:", err.message);
    res.status(500).send("Error");
  }
});

// ─────────────────────────────────────────────
// WEBHOOK 3: /incoming-sms
// ─────────────────────────────────────────────
app.post("/incoming-sms", async (req, res) => {
  const callerNumber = req.body.From;
  const twilioNumber = req.body.To;
  const incomingText = req.body.Body?.trim();

  if (!incomingText) {
    return res.status(200).send("Empty message — ignored.");
  }

  console.log(`💬 SMS | ${callerNumber} → ${twilioNumber}: "${incomingText}"`);

  // Acknowledge Twilio immediately (must be within 15 seconds)
  res.status(200).send("OK");

  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  if (!plumber) {
    console.warn(`⚠️  No plumber config for: ${twilioNumber}`);
    return;
  }

  // ── COMPLIANCE KEYWORDS (STOP / START / HELP) ────────────
  const compliance = await optout.handleComplianceKeyword(
    db_helpers, db, sendSMS,
    twilioNumber, callerNumber, incomingText, plumber
  );
  if (compliance.handled) return;

  // ── OPT-OUT GATE ─────────────────────────────────────────
  const blocked = await optout.isBlockedFromSending(
    db_helpers, db, twilioNumber, callerNumber
  );
  if (blocked) return;

  // ── RATE LIMIT CHECK ─────────────────────────────────────
  const limitCheck = ratelimit.checkRateLimit(twilioNumber, callerNumber);
  if (limitCheck.limited) {
    console.log(`⚠️  RATE LIMITED: ${callerNumber} | Reason: ${limitCheck.reason}`);
    try {
      await sendSMS(callerNumber, twilioNumber, ratelimit.getRateLimitReply(plumber));
    } catch (err) {
      console.error("❌ Failed to send rate limit reply:", err.message);
    }
    return;
  }

  // ── EMERGENCY DETECTION ──────────────────────────────────
  const emergency = isEmergency(incomingText);
  if (emergency && plumber.ownerPhone) {
    console.log(`🚨 EMERGENCY detected from ${callerNumber}`);
    try {
      await sendSMS(
        plumber.ownerPhone,
        twilioNumber,
        `🚨 EMERGENCY — ${callerNumber} needs urgent help: "${incomingText}". Call them back NOW.`
      );
    } catch (alertErr) {
      console.error("❌ Failed to send emergency alert:", alertErr.message);
    }
  }

  // ── SAVE INCOMING MESSAGE ─────────────────────────────────
  await db_helpers.saveMessage(db, twilioNumber, callerNumber, "user", incomingText, { emergency });

  // ── LOAD CONVERSATION HISTORY ─────────────────────────────
  const history = await db_helpers.getConversation(db, twilioNumber, callerNumber);

  const messages = [
    { role: "system", content: buildSystemPrompt(plumber) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  if (emergency) {
    messages.push({
      role: "system",
      content:
        "URGENT: This customer has a plumbing emergency. " +
        "Acknowledge it immediately and with empathy. " +
        "If water is involved, tell them to shut off the main stop valve right away. " +
        "Let them know the owner has been alerted and will call them back very shortly. " +
        "Keep your reply short, calm, and focused on their safety.",
    });
  }

  try {
    // ── CALL OPENAI ───────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 180,
      temperature: 0.72,
    });

    const aiReply = completion.choices[0].message.content.trim();

    // ── RECORD FOR RATE LIMITING ──────────────────────────────
    ratelimit.recordMessage(twilioNumber, callerNumber);
    const stats = ratelimit.getStats(twilioNumber, callerNumber);
    console.log(`📊 ${callerNumber} | msgs: ${stats.messageCount} | cost: $${stats.estimatedCost} | remaining: ${stats.messagesRemaining}`);

    await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", aiReply, { emergency });
    await sendSMS(callerNumber, twilioNumber, aiReply);
    console.log(`✅ AI replied to ${callerNumber}: "${aiReply}"`);
  } catch (err) {
    console.error("❌ OpenAI error:", err.message);

    const fallback =
      `Thanks for your message! ${plumber.ownerName} will get back to you very shortly. ` +
      `If it's urgent, please call back and we'll pick up as soon as we can.`;

    try {
      await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", fallback, { emergency });
      await sendSMS(callerNumber, twilioNumber, fallback);
    } catch (fallbackErr) {
      console.error("❌ Failed to send fallback:", fallbackErr.message);
    }
  }
});

// ─────────────────────────────────────────────
// TEST EMAIL ENDPOINT
// ─────────────────────────────────────────────
app.get("/test-emails", async (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const toEmail = req.query.email || process.env.OWNER_EMAIL;
  if (!toEmail) {
    return res.status(400).json({ error: "No email address provided" });
  }
  try {
    await emailService.sendTestEmails(toEmail);
    res.json({ success: true, message: `3 test emails sent to ${toEmail}` });
  } catch (err) {
    console.error("❌ Test email error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status:  "running",
    service: "ZeroMissCall",
    version: "2.5.0",
    db:      db ? "connected" : "disconnected",
  });
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLERS
// ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled route error:", err);
  res.status(500).send("Internal server error");
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ZeroMissCall v2.5.0 running on port ${PORT}`);
});
