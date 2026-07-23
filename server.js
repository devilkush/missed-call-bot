require("dotenv").config();
const APP_VERSION = "2.19.1";  // SINGLE SOURCE OF TRUTH - bump this each deploy
const express = require("express");
const { registerSalesRoutes } = require("./sales");
const twilio = require("twilio");
const { OpenAI } = require("openai");
const { MongoClient } = require("mongodb");
const db_helpers = require("./db");
const optout = require("./optout");
const ratelimit = require("./ratelimit");
const emailService = require("./email");
const emailService2 = require("./email2");
const { initScheduler } = require("./scheduler");
const { registerAdminRoutes, sendDailySummaryEmail, notifyOwnerError } = require("./admin");
const { registerDashboardRoute } = require("./dashboard");
const { fireLeadHandoff, fireSalesHandoff } = require("./handoff");
const { registerBillingRoutes } = require("./billing");

const app = express();

// Railway sits behind a proxy - needed so Twilio signature validation
// sees the real https:// URL instead of the internal http:// one.
app.set("trust proxy", true);

// ─────────────────────────────────────────────
// TWILIO WEBHOOK SIGNATURE VALIDATION
// Rejects any request to /voice, /missed-call or /incoming-sms
// that wasn't genuinely signed by Twilio with our auth token.
// Stops strangers POSTing fake payloads that cost us SMS + OpenAI money.
// Requires TWILIO_AUTH_TOKEN to be the correct 32-char token in Railway.
// ─────────────────────────────────────────────
// Only enforce signature validation when we actually have the auth token.
// If TWILIO_AUTH_TOKEN is missing (e.g. not set after a redeploy), validating
// would reject every real Twilio call with a cryptic "application error".
// So we log a loud warning and skip validation rather than break all calls.
if (!process.env.TWILIO_AUTH_TOKEN) {
  console.error("TWILIO_AUTH_TOKEN is MISSING - webhook signature validation DISABLED. Set it in Railway variables!");
}
const validateTwilio = process.env.TWILIO_AUTH_TOKEN
  ? twilio.webhook({ validate: true })
  : function (req, res, next) { next(); };

// ─────────────────────────────────────────────
// CORS - allow requests from zeromisscall.com
// ─────────────────────────────────────────────
app.use((req, res, next) => {
  const allowed = [
    "https://zeromisscall.com",
    "https://www.zeromisscall.com",
  ];
  const origin = req.headers.origin;
  if (!origin || allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Stripe webhook needs raw body - register BEFORE express.json()
app.use("/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || "").trim(), // trim guards against stray whitespace
  timeout: 20000,  // 20s - SMS can wait; better than an instant connection error
  maxRetries: 2,   // retry transient network/OpenAI blips before falling back
});

let db;
MongoClient.connect(process.env.MONGODB_URI)
  .then((client) => {
    db = client.db("zeromisscall");
    db_helpers.ensureIndexes(db);
    initScheduler(app, db, db_helpers, emailService);
    registerAdminRoutes(app, db, db_helpers, emailService);
    registerSalesRoutes(app, db);
    registerDashboardRoute(app, db, db_helpers);
    registerBillingRoutes(app, db, db_helpers, emailService);
    console.log("✅ MongoDB connected");
    console.log("✅ MongoDB indexes ensured");
    console.log("✅ Admin routes registered");
    console.log("✅ Dashboard route registered");
    console.log("✅ Billing routes registered");
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
  // Accounts can override the default plumber persona entirely (used for the
  // ZeroMissCall sales line, where the caller is a plumber interested in the
  // product rather than a homeowner with a leak).
  if (plumber.customSystemPrompt && String(plumber.customSystemPrompt).trim()) {
    return String(plumber.customSystemPrompt).trim();
  }

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
3. When they would PREFER someone to come out (a preference to pass on - never a booking)

BUSINESS DETAILS:
- Business: ${plumber.businessName}
- Owner: ${plumber.ownerName}
- Service area: ${plumber.serviceArea}
- Hours: ${plumber.hours}
- Emergency 24/7: ${plumber.emergencyAvailable ? "Yes" : "No - for genuine emergencies refer to 911 or a 24hr service"}${servicesBlock}

PLUMBING KNOWLEDGE (use naturally when relevant):
- Common jobs: drain unblocking, boiler servicing/repair, water heater replacement (tank & tankless), bathroom/kitchen installs, leak detection and repair, pipe repair/replacement, radiator issues, outside tap installs, water pressure problems, toilet/cistern repairs, stopcock and valve issues.
- For active leaks: advise customer to locate and shut off the main stop valve - usually under the kitchen sink or near the water meter.
- Pricing: NEVER quote specific prices. Always say the owner will provide a clear, no-obligation quote before any work starts. No surprises.
- Licensing: if asked, confirm the business is fully licensed and insured in their state (unless a customFaq says otherwise).

SCHEDULING - CRITICAL RULES (never break these):
- You CANNOT book, schedule, or confirm appointments. You do not have access to ${plumber.ownerName}'s calendar and you do not know what work he can take on.
- NEVER agree to a specific time. Never say "we'll be there at 2pm", "see you this afternoon", "someone will come today", "we can do tomorrow morning", or anything that commits to a visit.
- NEVER say or imply anything about ${plumber.ownerName}'s availability, how busy he is, or when he is free. You do not know.
- If the customer asks for a time, or asks "can someone come today?", treat their answer as a PREFERENCE you are noting down for ${plumber.ownerName}. Acknowledge it and pass it on. Example: "I'll pass that on - ${plumber.ownerName} will confirm what works when he calls you back."
- The ONLY thing you may promise is that ${plumber.ownerName} will call them back. Never promise a visit, a time window, or a price.
- If the customer pushes for a firm commitment, say that ${plumber.ownerName} confirms all appointments personally and will be in touch shortly.

TONE AND STYLE:
1. Warm, human, and concise. This is SMS - aim for 2-3 sentences per message unless more is genuinely needed.
2. Never start two consecutive replies the same way.
3. If asked whether you're a bot: be honest. Say you're an AI assistant for ${plumber.businessName} and that ${plumber.ownerName} will follow up personally.
4. Never mention competitors or compare prices.
5. No robotic sign-offs like "Best regards" or "Sincerely".
6. If the job sounds complex or needs a site visit, say ${plumber.ownerName} will call them back shortly.
7. Once you have all three pieces of info (what they need, zip code, preferred time) - summarise what you've noted down and tell them ${plumber.ownerName} will call them back to arrange a time. Do not state a time yourself. Don't keep asking unnecessary questions after that.
8. IMPORTANT - always keep the conversation moving: until you have all three pieces of info, EVERY reply must end with a clear question that gathers the next missing detail. Ask ONE question at a time (don't interrogate). If they've told you the problem, ask for their address and zip. Once you have that, ask when they'd prefer someone to come out. Never reply in a way that closes the conversation while information is still missing - a reply that just says "he'll get back to you" without asking anything is wrong unless you already have the problem, the address/zip, and their preferred time.
9. You are texting on behalf of ${plumber.businessName} - stay in character at all times.${faqBlock}`;
}

// ─────────────────────────────────────────────
// SEND SMS HELPER
// ─────────────────────────────────────────────
async function sendSMS(to, from, body) {
  return twilioClient.messages.create({ to, from, body });
}

// ─────────────────────────────────────────────
// SHARED: send the opening text-back (used after IVR consent)
// Honors opt-out, saves to history, alerts the owner. Returns true if sent.
// ─────────────────────────────────────────────
async function sendOpeningTextBack(plumber, twilioNumber, callerNumber) {
  // Accounts can override the opening text (the ZeroMissCall sales line uses
  // its own pitch). The STOP/HELP disclosure is appended either way so the
  // A2P compliance requirement can never be accidentally dropped.
  const DISCLOSURE = " Reply STOP to opt out, HELP for help. Msg & data rates may apply.";

  const openingMessage = (plumber.customOpeningMessage && String(plumber.customOpeningMessage).trim())
    ? String(plumber.customOpeningMessage).trim() + DISCLOSURE
    : `Hey! Thanks for calling ${plumber.businessName} - sorry we missed you, ` +
      `we're probably out on a job. I can help you right now over text. What do you need?` +
      DISCLOSURE;

  const blocked = await optout.isBlockedFromSending(
    db_helpers, db, twilioNumber, callerNumber
  );
  if (blocked) {
    console.log(`🚫 Skipping opening text - ${callerNumber} has opted out.`);
    return false;
  }

  console.log(`📤 Sending opening text-back: from=${twilioNumber} to=${callerNumber}`);
  try {
    const msg = await sendSMS(callerNumber, twilioNumber, openingMessage);
    console.log(`📨 Twilio accepted message SID=${msg.sid} status=${msg.status}`);
  } catch (sendErr) {
    console.error(`❌ Twilio REJECTED the text-back: ${sendErr.message} (code ${sendErr.code})`);
    throw sendErr;
  }
  await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", openingMessage);

  if (plumber.ownerPhone) {
    await sendSMS(
      plumber.ownerPhone,
      twilioNumber,
      `📞 Missed call from ${callerNumber}. They opted in - auto-reply sent, conversation started.`
    );
  }
  return true;
}

// ─────────────────────────────────────────────
// WEBHOOK 1: /voice
// ─────────────────────────────────────────────

// Greeting voice. Amazon Polly neural voices - change this one line to swap.
// Options: Polly.Danielle-Neural (warm US female), Polly.Matthew-Neural (warm
// US male), Polly.Stephen-Neural (casual US male), Polly.Joanna-Neural.
const CALL_VOICE = "Polly.Danielle-Neural";

// Return clean plain text for Twilio <Say>. We deliberately do NOT emit raw
// SSML tags here: when passed through twiml.say() they get HTML-escaped and
// spoken/garbled literally, which also broke the surrounding <Gather> and the
// press-1 capture. Plain sentences with natural punctuation read fine on the
// neural voice. We convert any <break> hints into sentence pauses (a period).
function humanSpeech(text) {
  return String(text)
    .replace(/<break[^>]*\/?>/gi, " ")   // drop break tags
    .replace(/<\/?speak>/gi, "")           // drop speak tags
    .replace(/<\/?prosody[^>]*>/gi, "")    // drop prosody tags
    .replace(/\s+/g, " ")                   // collapse whitespace
    .trim();
}

app.post("/voice", validateTwilio, async (req, res) => {
  const twilioNumber = req.body.To;
  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  const businessName = plumber ? plumber.businessName : "us";
  const ownerName    = plumber ? String(plumber.ownerName || "the team").trim().split(" ")[0] : "the team";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // IVR consent: caller must press 1 to opt in to text messages.
  // This is an affirmative, logged opt-in - the strongest consent basis.
  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    action: (process.env.PUBLIC_BASE_URL || "https://missed-call-bot-production.up.railway.app") + "/voice-consent",
    method: "POST",
    timeout: 10,
    actionOnEmptyResult: true,
  });

  // Accounts can override the intro line (the ZeroMissCall sales line greets
  // callers as Ian, not as a plumber out on a job). The consent instruction
  // and required disclosures are always appended, so press-1 consent and the
  // A2P wording can never be lost by a custom greeting.
  const introLine = (plumber && plumber.customGreeting && String(plumber.customGreeting).trim())
    ? String(plumber.customGreeting).trim()
    : `Hey! Thanks for calling ${businessName}. ${ownerName}'s probably out on a job right now, but I can help.`;

  gather.say(
    { voice: CALL_VOICE },
    humanSpeech(
      introLine + ` ` +
      `To get help by text, just press one, and I'll text you right back. ` +
      `Message frequency varies, and message and data rates may apply. You can reply STOP any time to opt out. ` +
      `Or to skip the text, press two, or just hang up.`
    )
  );

  // If they press nothing (timeout), Twilio falls through to here:
  // no consent captured, so no text is sent. Say goodbye and hang up.
  twiml.say(
    { voice: CALL_VOICE },
    humanSpeech(`No problem at all. <break time="200ms"/> ${ownerName} will see your missed call and get right back to you. <break time="200ms"/> Take care!`)
  );
  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

// ─────────────────────────────────────────────
// WEBHOOK 1b: /voice-consent  (handles the keypress from /voice)
// Press 1 = opt in -> record consent, send the text-back.
// Press 2 / anything else = decline -> no message sent.
// ─────────────────────────────────────────────
app.post("/voice-consent", validateTwilio, async (req, res) => {
  const twilioNumber = req.body.To;
  const callerNumber = req.body.From;
  const digit        = req.body.Digits;

  console.log(`🔢 /voice-consent hit | Digits="${digit}" | To=${twilioNumber} | From=${callerNumber}`);

  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  if (!plumber) {
    console.error(`❌ /voice-consent: no plumber found for To=${twilioNumber} - cannot send text`);
  }
  const businessName = plumber ? plumber.businessName : "us";
  const ownerName    = plumber ? String(plumber.ownerName || "the team").trim().split(" ")[0] : "the team";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  if (digit === "1" && plumber) {
    // Affirmative opt-in. Record consent (best-effort - never let a logging
    // failure block the actual text), then send the text-back.
    try {
      try {
        await db_helpers.recordConsent(db, twilioNumber, callerNumber, "ivr_press_1");
      } catch (consentErr) {
        console.error("⚠️ recordConsent failed (continuing to send anyway):", consentErr.message);
      }
      const sent = await sendOpeningTextBack(plumber, twilioNumber, callerNumber);
      console.log(`✅ IVR consent (press 1) from ${callerNumber} | text-back sent: ${sent}`);
    } catch (err) {
      console.error("❌ Error sending text-back after IVR consent:", err.message, err.stack);
    }
    twiml.say(
      { voice: CALL_VOICE },
      humanSpeech(`Perfect! <break time="200ms"/> I've just sent you a text. <break time="200ms"/> Reply to it and I'll help you get sorted. <break time="200ms"/> Talk soon!`)
    );
  } else {
    // Declined (pressed 2 or something else). No message is sent.
    console.log(`🚫 IVR consent declined by ${callerNumber} (pressed ${digit || "nothing"})`);
    twiml.say(
      { voice: CALL_VOICE },
      humanSpeech(`No problem at all. <break time="200ms"/> ${ownerName} will see your missed call and get right back to you. <break time="200ms"/> Take care!`)
    );
  }

  twiml.hangup();
  res.type("text/xml");
  res.send(twiml.toString());
});

// ─────────────────────────────────────────────
// WEBHOOK 2: /missed-call
// ─────────────────────────────────────────────
app.post("/missed-call", validateTwilio, async (req, res) => {
  const callerNumber = req.body.From;
  const twilioNumber = req.body.To;
  const callStatus   = req.body.CallStatus;
  const callSid      = req.body.CallSid;

  console.log(`📞 ${callStatus} | From: ${callerNumber} | To: ${twilioNumber} | SID: ${callSid}`);

  // In the call-forwarding model, a call that reaches this Twilio number has
  // already gone unanswered on the plumber's phone (conditional forwarding),
  // then our /voice greeting plays and hangs up — which Twilio marks as
  // "completed". So "completed" is a genuine missed call here and must trigger
  // the text-back, alongside the direct no-answer/busy/failed/canceled cases.
  const missedStatuses = ["no-answer", "busy", "failed", "canceled", "completed"];
  if (!missedStatuses.includes(callStatus)) {
    return res.status(200).send("Status not actionable - no action needed.");
  }

  if (callSid && isDuplicate(callSid)) {
    console.log(`⏭️  Duplicate callback for ${callSid} - skipping.`);
    return res.status(200).send("Duplicate - skipped.");
  }

  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  if (!plumber) {
    console.warn(`⚠️  No plumber config found for: ${twilioNumber}`);
    return res.status(200).send("No config found.");
  }

  // NOTE: The customer text-back is NO LONGER sent from here. Consent is now
  // captured via the IVR press-1 flow in /voice-consent, which sends the
  // opening text only after the caller affirmatively opts in. This endpoint
  // just alerts the owner that a call came in, so they never miss a lead
  // even if the caller declined the text.
  try {
    if (plumber.ownerPhone) {
      await sendSMS(
        plumber.ownerPhone,
        twilioNumber,
        `📞 Missed call from ${callerNumber}. If they opted in by phone, a text conversation has started - check your dashboard.`
      );
    }
    console.log(`📞 Missed-call owner alert sent for ${callerNumber}`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error sending owner alert:", err.message);
    res.status(500).send("Error");
  }
});

// ─────────────────────────────────────────────
// WEBHOOK 3: /incoming-sms
// ─────────────────────────────────────────────
app.post("/incoming-sms", validateTwilio, async (req, res) => {
  const callerNumber = req.body.From;
  const twilioNumber = req.body.To;
  const incomingText = req.body.Body?.trim();

  if (!incomingText) {
    return res.status(200).send("Empty message - ignored.");
  }

  console.log(`💬 SMS | ${callerNumber} → ${twilioNumber}: "${incomingText}"`);

  res.status(200).send("OK");

  const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
  if (!plumber) {
    console.warn(`⚠️  No plumber config for: ${twilioNumber}`);
    return;
  }

  const compliance = await optout.handleComplianceKeyword(
    db_helpers, db, sendSMS,
    twilioNumber, callerNumber, incomingText, plumber
  );
  if (compliance.handled) return;

  const blocked = await optout.isBlockedFromSending(
    db_helpers, db, twilioNumber, callerNumber
  );
  if (blocked) return;

  // ── EMERGENCY DETECTION - must run BEFORE the rate limit ──
  // If a customer hits their daily cap and THEN texts "pipe burst,
  // water everywhere", the owner must still be alerted immediately.
  const emergency = isEmergency(incomingText);
  if (emergency && plumber.ownerPhone) {
    console.log(`🚨 EMERGENCY detected from ${callerNumber}`);
    try {
      await sendSMS(
        plumber.ownerPhone,
        twilioNumber,
        `🚨 EMERGENCY - ${callerNumber} needs urgent help: "${incomingText}". Call them back NOW.`
      );
    } catch (alertErr) {
      console.error("❌ Failed to send emergency alert:", alertErr.message);
    }
  }

  const limitCheck = ratelimit.checkRateLimit(twilioNumber, callerNumber);
  if (limitCheck.limited) {
    console.log(`⚠️  RATE LIMITED: ${callerNumber} | Reason: ${limitCheck.reason}`);
    try {
      // For emergencies, tell the customer the owner has been alerted
      // instead of the generic "we have everything we need" line.
      const reply = emergency
        ? `${plumber.ownerName} has been alerted about your emergency and will call you right back. If water is involved, shut off the main stop valve now.`
        : ratelimit.getRateLimitReply(plumber);
      await sendSMS(callerNumber, twilioNumber, reply);
    } catch (err) {
      console.error("❌ Failed to send rate limit reply:", err.message);
    }
    // Still save the message so the emergency shows in the dashboard
    await db_helpers.saveMessage(db, twilioNumber, callerNumber, "user", incomingText, { emergency });
    return;
  }

  await db_helpers.saveMessage(db, twilioNumber, callerNumber, "user", incomingText, { emergency });

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
        "First, acknowledge it immediately with empathy, and if water is involved tell them to shut off the main stop valve right away. " +
        "Reassure them that " + plumber.ownerName + " has been alerted and will call them back very shortly. " +
        "THEN, in the SAME message, still ask for the information " + plumber.ownerName + " needs to help fast: " +
        "their address (and zip), and confirm the best number to reach them. " +
        "Ask for whatever key detail you don't have yet - do not end the conversation until you have the address. " +
        "Keep it calm and concise, but always move the conversation forward by asking the next needed question. " +
        "Never just say 'he'll call you back' and stop - always pair reassurance with a question that captures a missing detail.",
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 180,
      temperature: 0.72,
    });

    const aiReply = completion.choices[0].message.content.trim();

    ratelimit.recordMessage(twilioNumber, callerNumber);
    const stats = ratelimit.getStats(twilioNumber, callerNumber);
    console.log(`📊 ${callerNumber} | msgs: ${stats.messageCount} | cost: $${stats.estimatedCost} | remaining: ${stats.messagesRemaining}`);

    await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", aiReply, { emergency });
    await sendSMS(callerNumber, twilioNumber, aiReply);
    console.log(`✅ AI replied to ${callerNumber}: "${aiReply}"`);

    // ── LEAD CAPTURE CHECK ───────────────────────────────────
    const updatedHistory = await db_helpers.getConversation(db, twilioNumber, callerNumber);
    if (plumber.salesMode) {
      // ZeroMissCall's own sales line: capture an email or a callback request
      // rather than a plumbing job.
      await fireSalesHandoff(db, db_helpers, sendSMS, twilioNumber, callerNumber, updatedHistory, plumber, emailService2);
    } else {
      await fireLeadHandoff(db, db_helpers, sendSMS, twilioNumber, callerNumber, updatedHistory, plumber);
    }

  } catch (err) {
    console.error("❌ OpenAI error:", err.message,
      "| status:", err.status, "| code:", err.code, "| type:", err.type);
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY is MISSING from environment!");
    } else {
      console.error("ℹ️ OPENAI_API_KEY present, length:", process.env.OPENAI_API_KEY.trim().length,
        "| starts sk-:", process.env.OPENAI_API_KEY.trim().startsWith("sk-"),
        "| has whitespace:", process.env.OPENAI_API_KEY !== process.env.OPENAI_API_KEY.trim());
    }

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
// CONTACT FORM - website enquiries
// POST /contact
// ─────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

app.post("/contact", async (req, res) => {
  const body = req.body || {};

  // Basic validation on raw values
  if (!body.firstName || !body.email || !body.message) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  // Reject header-injection attempts in the reply-to address
  if (/[\r\n]/.test(body.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  // Escape everything user-supplied before it touches HTML
  const firstName = escapeHtml(body.firstName);
  const lastName  = escapeHtml(body.lastName);
  const email     = escapeHtml(body.email);
  const business  = escapeHtml(body.business);
  const topic     = escapeHtml(body.topic).substring(0, 120);
  const message   = escapeHtml(body.message).substring(0, 5000);

  const name = `${firstName || ""} ${lastName || ""}`.trim();

  // Send notification email to owner
  try {
    const { Resend } = require("resend");
    const resendClient = new Resend(process.env.RESEND_API_KEY);

    const notifyHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#E8791A;margin-bottom:4px;">New Contact Form Submission</h2>
        <p style="color:#666;margin-bottom:24px;font-size:14px;">zeromisscall.com/contact.html</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#999;font-size:13px;width:120px;">Name</td><td style="padding:8px 0;font-size:14px;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#999;font-size:13px;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}" style="color:#E8791A;">${email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#999;font-size:13px;">Business</td><td style="padding:8px 0;font-size:14px;">${business || "-"}</td></tr>
          <tr><td style="padding:8px 0;color:#999;font-size:13px;">Topic</td><td style="padding:8px 0;font-size:14px;">${topic || "-"}</td></tr>
        </table>
        <div style="margin-top:20px;background:#f5f5f5;border-radius:8px;padding:16px;">
          <p style="margin:0;font-size:14px;color:#333;white-space:pre-wrap;">${message}</p>
        </div>
        <p style="margin-top:24px;font-size:12px;color:#999;">Sent from ZeroMissCall contact form</p>
      </div>
    `;

    await resendClient.emails.send({
      from:    "ZeroMissCall <reports@zeromisscall.com>",
      to:      process.env.OWNER_EMAIL || "hello@zeromisscall.com",
      replyTo: email,
      subject: `[Contact] ${topic || "New enquiry"} - ${name}`,
      html:    notifyHtml,
    });

    // Send auto-reply to sender
    const autoReplyHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0b1928;color:#fff;">
        <h2 style="color:#E8791A;">Thanks, ${firstName}!</h2>
        <p style="color:#96aec6;line-height:1.7;">We've received your message and will get back to you within 2 hours on business days.</p>
        <p style="color:#96aec6;line-height:1.7;">In the meantime, feel free to explore how ZeroMissCall works at <a href="https://zeromisscall.com" style="color:#E8791A;">zeromisscall.com</a>.</p>
        <p style="color:#96aec6;margin-top:24px;font-size:14px;">- The ZeroMissCall Team</p>
      </div>
    `;

    await resendClient.emails.send({
      from:    "Ian from ZeroMissCall <ian@zeromisscall.com>",
      to:      email,
      subject: "We got your message - ZeroMissCall",
      html:    autoReplyHtml,
    });

    console.log(`📧 Contact form from ${name} <${email}> - topic: ${topic || "n/a"}`);
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ Contact form error:", err.message);
    res.status(500).json({ error: "Failed to send. Please email hello@zeromisscall.com directly." });
  }
});


// ─────────────────────────────────────────────
// TEST EMAIL2 - fires all 4 new emails
// GET /test-emails2?secret=YOUR_ADMIN_SECRET&email=you@email.com
// ─────────────────────────────────────────────
app.get("/test-emails2", async (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const toEmail = req.query.email || process.env.OWNER_EMAIL;
  try {
    await emailService2.sendTestEmails2(toEmail);
    res.json({ success: true, message: "4 test emails sent to " + toEmail });
  } catch (err) {
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
    version: APP_VERSION,
    db:      db ? "connected" : "disconnected",
  });
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLERS
// ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled route error:", err);
  notifyOwnerError("unhandled route", err).catch(function(){});
  res.status(500).send("Internal server error");
});

process.on("unhandledRejection", function(reason) {
  console.error("Unhandled promise rejection:", reason);
  notifyOwnerError("unhandledRejection", { message: String(reason) }).catch(function(){});
});

process.on("uncaughtException", function(err) {
  console.error("Uncaught exception:", err);
  notifyOwnerError("uncaughtException", err).catch(function(){});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ZeroMissCall v${APP_VERSION} running on port ${PORT}`);
});
