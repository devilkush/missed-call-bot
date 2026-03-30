require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const { OpenAI } = require("openai");
const { MongoClient } = require("mongodb");

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

// ─────────────────────────────────────────────
// MONGO DB CONNECTION (Safe + Graceful)
// ─────────────────────────────────────────────
let db = null;

async function connectToMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI not set - Running without database (logs will be in memory only)");
    return;
  }

  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    db = client.db("zeromisscall");
    console.log("✅ MongoDB connected successfully to database: zeromisscall");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.warn("⚠️ Bot will continue running without database storage.");
  }
}

// Connect when server starts
connectToMongo();

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
];

function isEmergency(text) {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────
// GET PLUMBER CONFIG FROM MONGODB
// (falls back to env vars for single-tenant testing)
// ─────────────────────────────────────────────
async function getPlumberByTwilioNumber(twilioNumber) {
  if (db) {
    const plumber = await db
      .collection("plumbers")
      .findOne({ twilioNumber, active: true });
    if (plumber) return plumber;
  }
  // Fallback: single hardcoded config from env (for local testing)
  if (twilioNumber === process.env.TWILIO_NUMBER) {
    return {
      twilioNumber,
      businessName: process.env.BUSINESS_NAME || "Your Plumbing Co.",
      ownerName: process.env.OWNER_NAME || "the team",
      ownerPhone: process.env.OWNER_PHONE || "",
      serviceArea: process.env.SERVICE_AREA || "the local area",
      hours: process.env.BUSINESS_HOURS || "Mon–Fri 8am–6pm",
      customFaqs: [],
      emergencyAvailable: true,
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// GET CONVERSATION HISTORY FROM MONGODB
// ─────────────────────────────────────────────
async function getConversation(twilioNumber, callerNumber) {
  if (!db) return [];
  const convo = await db.collection("conversations").findOne({
    twilioNumber,
    callerNumber,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // last 24hrs
  });
  return convo ? convo.messages : [];
}

// ─────────────────────────────────────────────
// SAVE MESSAGE TO MONGODB
// ─────────────────────────────────────────────
async function saveMessage(twilioNumber, callerNumber, role, content, emergency = false) {
  if (!db) return;
  const now = new Date();
  await db.collection("conversations").updateOne(
    { twilioNumber, callerNumber },
    {
      $setOnInsert: { createdAt: now },
      $set: { updatedAt: now, emergency },
      $push: {
        messages: { role, content, timestamp: now },
      },
    },
    { upsert: true }
  );
}

// ─────────────────────────────────────────────
// BUILD SYSTEM PROMPT FOR OPENAI
// ─────────────────────────────────────────────
function buildSystemPrompt(plumber) {
  const faqBlock =
    plumber.customFaqs && plumber.customFaqs.length > 0
      ? `\n\nCUSTOM FAQs FOR THIS BUSINESS:\n` +
        plumber.customFaqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
      : "";

  return `You are a friendly, professional AI assistant for ${plumber.businessName}, a plumbing business in the US. Your job is to handle text conversations with customers who just called and didn't get through.

YOUR GOAL: Keep the customer engaged, answer their questions, and capture their job details (what they need, their address or zip code, and when they want someone to come out).

BUSINESS DETAILS:
- Business name: ${plumber.businessName}
- Owner: ${plumber.ownerName}
- Service area: ${plumber.serviceArea}
- Business hours: ${plumber.hours}
- Emergency availability: ${plumber.emergencyAvailable ? "Yes, we handle emergencies 24/7" : "Emergency hours only — we'll advise on alternatives if needed"}

RULES:
1. Be warm, helpful and concise. Keep replies under 3 sentences where possible — this is SMS, not email.
2. Never make up prices. Say the owner will provide a clear quote before any work starts.
3. If someone asks if you're a bot, be honest — say you're an AI assistant for ${plumber.businessName} and that ${plumber.ownerName} will follow up personally.
4. If the job sounds urgent or complex, let them know ${plumber.ownerName} will call them back shortly.
5. Always try to get their zip code to confirm you cover their area.
6. Sign off messages naturally — no robotic sign-offs.
7. Never discuss competitors.
8. You are texting on behalf of ${plumber.businessName} — stay in character at all times.${faqBlock}`;
}

// ─────────────────────────────────────────────
// SEND SMS HELPER
// ─────────────────────────────────────────────
async function sendSMS(to, from, body) {
  return twilioClient.messages.create({ to, from, body });
}

// ─────────────────────────────────────────────
// WEBHOOK 1: VOICE — plays greeting when call comes in
// Set in Twilio: Voice > "A call comes in" > Webhook > POST > /voice
// ─────────────────────────────────────────────
app.post("/voice", async (req, res) => {
  const twilioNumber = req.body.To;
  const plumber = await getPlumberByTwilioNumber(twilioNumber);
  const businessName = plumber ? plumber.businessName : "us";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: "Polly.Joanna-Neural" },
    `Hey, thanks for calling ${businessName}! We're out on a job right now but we don't want to miss you. ` +
    `We're sending you a text message right now so we can get you sorted fast. Talk soon!`
  );

  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

// ─────────────────────────────────────────────
// WEBHOOK 2: MISSED CALL — fires when call ends unanswered
// Set in Twilio: Voice > Status Callback > POST > /missed-call
// ─────────────────────────────────────────────
app.post("/missed-call", async (req, res) => {
  const callerNumber = req.body.From;
  const twilioNumber = req.body.To;
  const callStatus = req.body.CallStatus;

  console.log(`📞 ${callStatus} | From: ${callerNumber} | To: ${twilioNumber}`);

  const missedStatuses = ["no-answer", "busy", "failed", "canceled"];
  if (!missedStatuses.includes(callStatus)) {
    return res.status(200).send("Call was answered.");
  }

  const plumber = await getPlumberByTwilioNumber(twilioNumber);
  if (!plumber) {
    console.warn(`⚠️ No plumber config for: ${twilioNumber}`);
    return res.status(200).send("No config found.");
  }

  const openingMessage =
    `Hey! Thanks for calling ${plumber.businessName} — sorry we missed you, we're probably out on a job. ` +
    `I can help you right now over text. What do you need?`;

  try {
    await sendSMS(callerNumber, twilioNumber, openingMessage);
    await saveMessage(twilioNumber, callerNumber, "assistant", openingMessage);

    // Notify plumber of the missed call
    if (plumber.ownerPhone) {
      await sendSMS(
        plumber.ownerPhone,
        twilioNumber,
        `📞 Missed call from ${callerNumber}. Auto-reply sent. Check your dashboard for the conversation.`
      );
    }

    console.log(`✅ Opening message sent to ${callerNumber}`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).send("Error");
  }
});

// ─────────────────────────────────────────────
// WEBHOOK 3: INCOMING SMS — the AI conversation handler
// Set in Twilio: Messaging > "A message comes in" > Webhook > POST > /incoming-sms
// ─────────────────────────────────────────────
app.post("/incoming-sms", async (req, res) => {
  const callerNumber = req.body.From;
  const twilioNumber = req.body.To;
  const incomingText = req.body.Body?.trim();

  console.log(`💬 SMS from ${callerNumber}: "${incomingText}"`);

  res.status(200).send("OK"); // respond to Twilio immediately

  const plumber = await getPlumberByTwilioNumber(twilioNumber);
  if (!plumber) {
    console.warn(`⚠️ No plumber config for: ${twilioNumber}`);
    return;
  }

  // ── EMERGENCY CHECK ──
  const emergency = isEmergency(incomingText);
  if (emergency && plumber.ownerPhone) {
    console.log(`🚨 EMERGENCY detected from ${callerNumber}`);
    await sendSMS(
      plumber.ownerPhone,
      twilioNumber,
      `🚨 EMERGENCY — ${callerNumber} needs urgent help: "${incomingText}". Call them back NOW.`
    );
  }

  // ── SAVE CUSTOMER MESSAGE ──
  await saveMessage(twilioNumber, callerNumber, "user", incomingText, emergency);

  // ── GET CONVERSATION HISTORY ──
  const history = await getConversation(twilioNumber, callerNumber);

  // Build messages array for OpenAI
  const messages = [
    { role: "system", content: buildSystemPrompt(plumber) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Add emergency context if needed
  if (emergency) {
    messages.push({
      role: "system",
      content:
        "IMPORTANT: This customer has an emergency. Acknowledge the urgency immediately. " +
        "Tell them to shut off their main water valve if relevant. " +
        "Let them know the owner has been alerted and will call them back very shortly. " +
        "Stay calm and keep them engaged.",
    });
  }

  try {
    // ── CALL OPENAI ──
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 160, // keep SMS-length responses
      temperature: 0.7,
    });

    const aiReply = completion.choices[0].message.content.trim();

    // ── SAVE AI REPLY ──
    await saveMessage(twilioNumber, callerNumber, "assistant", aiReply, emergency);

    // ── SEND REPLY ──
    await sendSMS(callerNumber, twilioNumber, aiReply);
    console.log(`✅ AI replied to ${callerNumber}: "${aiReply}"`);
  } catch (err) {
    console.error("❌ OpenAI error:", err.message);
    // Fallback message if OpenAI fails
    const fallback =
      `Thanks for your message! ${plumber.ownerName} will get back to you shortly. ` +
      `If it's urgent, please call back and we'll pick up as soon as we can.`;
    await sendSMS(callerNumber, twilioNumber, fallback);
  }
});

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("✅ ZeroMissCall bot is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ZeroMissCall running on port ${PORT}`);
});
