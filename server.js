require("dotenv").config();
const express = require("express");
const twilio = require("twilio");
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─────────────────────────────────────────────
// CONFIG — fill these in for each plumber client
// ─────────────────────────────────────────────
const PLUMBER_CONFIGS = {
  // This is the Twilio number you bought for the plumber
  // Add one entry per client
  "+15551234567": {
    businessName: "Joe's Plumbing",
    ownerName: "Joe",
    callbackNumber: "+15559876543", // plumber's real mobile
    smsMessage: (callerNumber) =>
      `Hi there! You just missed a call from ${callerNumber}. We'll get back to you as soon as possible! - Joe's Plumbing 🔧`,
  },
  // Add more clients below:
  // "+15550000001": {
  //   businessName: "Dallas Drain Pros",
  //   ownerName: "Mike",
  //   callbackNumber: "+15550000002",
  //   smsMessage: (callerNumber) => `Hi! Sorry we missed you at Dallas Drain Pros. We'll call you right back! 🔧`,
  // },
};

// ─────────────────────────────────────────────
// Twilio credentials — set these as env variables
// ─────────────────────────────────────────────
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// ─────────────────────────────────────────────
// WEBHOOK — Twilio calls this when a call is missed
// Set this URL in your Twilio number settings under:
// Voice → "A call comes in" → Webhook → HTTP POST
// ─────────────────────────────────────────────
app.post("/missed-call", async (req, res) => {
  const callerNumber = req.body.From;       // the customer who called
  const twilioNumber = req.body.To;         // the plumber's Twilio number
  const callStatus = req.body.CallStatus;   // "no-answer", "busy", "failed"

  console.log(`📞 Incoming call event: ${callStatus} | From: ${callerNumber} | To: ${twilioNumber}`);

  // Only fire SMS on missed/unanswered calls
  const missedStatuses = ["no-answer", "busy", "failed", "canceled"];
  if (!missedStatuses.includes(callStatus)) {
    return res.status(200).send("OK - call was answered, no SMS needed.");
  }

  // Look up plumber config for this Twilio number
  const config = PLUMBER_CONFIGS[twilioNumber];
  if (!config) {
    console.warn(`⚠️  No config found for number: ${twilioNumber}`);
    return res.status(200).send("No config for this number.");
  }

  try {
    // Send SMS to the person who called
    const message = await client.messages.create({
      body: config.smsMessage(callerNumber),
      from: twilioNumber,
      to: callerNumber,
    });

    console.log(`✅ SMS sent to ${callerNumber} | SID: ${message.sid}`);

    // Optional: also notify the plumber by SMS
    await client.messages.create({
      body: `🔔 Missed call from ${callerNumber}. Auto-reply sent. Call them back when you can!`,
      from: twilioNumber,
      to: config.callbackNumber,
    });

    console.log(`✅ Plumber notified at ${config.callbackNumber}`);

    res.status(200).send("SMS sent.");
  } catch (err) {
    console.error("❌ Error sending SMS:", err.message);
    res.status(500).send("Error sending SMS.");
  }
});

// ─────────────────────────────────────────────
// TwiML — plays a voicemail greeting to callers
// Set this URL in Twilio under:
// Voice → "A call comes in" → TwiML → this URL
// ─────────────────────────────────────────────
app.post("/voice", (req, res) => {
  const twilioNumber = req.body.To;
  const config = PLUMBER_CONFIGS[twilioNumber];
  const businessName = config ? config.businessName : "us";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: "Polly.Joanna-Neural" },
    `Hey there, thanks for calling ${businessName}! We're either on a job or with another customer right now. ` +
`We don't want to miss you though - we're sending you a text right now so we can get you sorted fast. ` +
`Talk soon!`
  );

  // Hang up — status callback will fire the missed-call webhook
  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ Missed Call Bot is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
