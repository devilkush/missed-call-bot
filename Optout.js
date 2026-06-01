// ─────────────────────────────────────────────────────────────
// PHASE 2 — STOP / OPT-OUT COMPLIANCE
// ZeroMissCall v2
//
// HOW TO USE:
// 1. Save this file as optout.js in the same folder as server.js
// 2. Follow the integration instructions at the bottom of this file
//
// WHAT THIS DOES:
// Intercepts STOP, UNSUBSCRIBE, CANCEL, QUIT, END before
// OpenAI is ever called. Handles START (resubscribe) and HELP.
// Blocks all future outbound SMS to opted-out numbers.
// Fully compliant with US carrier A2P and TCPA requirements.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// OPT-OUT KEYWORDS (carrier-mandated)
// ─────────────────────────────────────────────
const OPT_OUT_KEYWORDS = [
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "quit",
  "end",
];

const OPT_IN_KEYWORDS = [
  "start",
  "yes",
  "unstop",
];

const HELP_KEYWORDS = [
  "help",
  "info",
];

// ─────────────────────────────────────────────
// KEYWORD DETECTION
// Checks if the message is EXACTLY a compliance
// keyword (case-insensitive, trimmed).
// Carriers require exact-match for STOP etc.
// ─────────────────────────────────────────────
function detectKeyword(text) {
  const cleaned = text.trim().toLowerCase().replace(/[^a-z]/g, "");

  if (OPT_OUT_KEYWORDS.includes(cleaned)) return "OPT_OUT";
  if (OPT_IN_KEYWORDS.includes(cleaned))  return "OPT_IN";
  if (HELP_KEYWORDS.includes(cleaned))    return "HELP";

  return null;
}

// ─────────────────────────────────────────────
// COMPLIANCE RESPONSE MESSAGES
// These exact formats are required by US carriers.
// Do not change the structure of these messages.
// ─────────────────────────────────────────────
function getOptOutReply(businessName) {
  return (
    `You have been unsubscribed from ${businessName} messages. ` +
    `No further messages will be sent. ` +
    `Reply START to resubscribe.`
  );
}

function getOptInReply(businessName) {
  return (
    `You have been resubscribed to ${businessName} messages. ` +
    `Reply STOP at any time to unsubscribe.`
  );
}

function getHelpReply(businessName, ownerPhone) {
  const contact = ownerPhone
    ? `For help, call us directly at ${ownerPhone}.`
    : `For help, please call us directly.`;
  return (
    `${businessName} — AI-powered missed call response. ` +
    `${contact} ` +
    `Reply STOP to unsubscribe.`
  );
}

// ─────────────────────────────────────────────
// MAIN COMPLIANCE HANDLER
//
// Call this at the very top of /incoming-sms,
// before any other logic runs.
//
// Returns:
//   { handled: true }  — message was a compliance
//                        keyword, stop processing
//   { handled: false } — normal message, continue
//                        with AI flow
// ─────────────────────────────────────────────
async function handleComplianceKeyword(
  db_helpers,
  db,
  sendSMS,
  twilioNumber,
  callerNumber,
  incomingText,
  plumber
) {
  const keyword = detectKeyword(incomingText);

  if (!keyword) {
    return { handled: false };
  }

  const businessName = plumber ? plumber.businessName : "this service";
  const ownerPhone   = plumber ? plumber.ownerPhone   : null;

  if (keyword === "OPT_OUT") {
    console.log(`🚫 OPT-OUT: ${callerNumber} → ${twilioNumber}`);

    // Record opt-out in MongoDB
    await db_helpers.recordOptOut(db, twilioNumber, callerNumber);

    // Send carrier-mandated confirmation (must always send this,
    // even to opted-out numbers — it's the one exception)
    try {
      await sendSMS(
        callerNumber,
        twilioNumber,
        getOptOutReply(businessName)
      );
    } catch (err) {
      console.error("❌ Failed to send opt-out confirmation:", err.message);
    }

    // Notify plumber so they know a customer opted out
    if (plumber && plumber.ownerPhone) {
      try {
        await sendSMS(
          plumber.ownerPhone,
          twilioNumber,
          `ℹ️ ${callerNumber} has opted out of SMS messages from ${businessName}.`
        );
      } catch (err) {
        console.error("❌ Failed to notify plumber of opt-out:", err.message);
      }
    }

    return { handled: true };
  }

  if (keyword === "OPT_IN") {
    console.log(`✅ OPT-IN: ${callerNumber} → ${twilioNumber}`);

    // Record resubscribe in MongoDB
    await db_helpers.recordResubscribe(db, twilioNumber, callerNumber);

    // Send confirmation
    try {
      await sendSMS(
        callerNumber,
        twilioNumber,
        getOptInReply(businessName)
      );
    } catch (err) {
      console.error("❌ Failed to send opt-in confirmation:", err.message);
    }

    return { handled: true };
  }

  if (keyword === "HELP") {
    console.log(`ℹ️ HELP: ${callerNumber} → ${twilioNumber}`);

    try {
      await sendSMS(
        callerNumber,
        twilioNumber,
        getHelpReply(businessName, ownerPhone)
      );
    } catch (err) {
      console.error("❌ Failed to send help reply:", err.message);
    }

    return { handled: true };
  }

  return { handled: false };
}

// ─────────────────────────────────────────────
// OPT-OUT GATE
//
// Call this before sending ANY outbound SMS to
// a customer number (opening text, AI replies,
// fallback messages — everything).
//
// Returns true if sending is blocked (opted out).
// Returns false if safe to send.
// ─────────────────────────────────────────────
async function isBlockedFromSending(db_helpers, db, twilioNumber, callerNumber) {
  try {
    const optedOut = await db_helpers.isOptedOut(db, twilioNumber, callerNumber);
    if (optedOut) {
      console.log(`🚫 BLOCKED: ${callerNumber} has opted out — not sending.`);
      return true;
    }
    return false;
  } catch (err) {
    // If check fails, allow sending — better to send than to
    // silently fail a customer in a plumbing emergency
    console.error("❌ Opt-out check failed — allowing send:", err.message);
    return false;
  }
}

module.exports = {
  handleComplianceKeyword,
  isBlockedFromSending,
  detectKeyword,
};

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Add require at top of server.js:
//
//   const optout = require("./optout");
//
//
// STEP 2 — Update /missed-call webhook
// Add opt-out check before sending the opening text.
// Replace this block:
//
//   try {
//     await sendSMS(callerNumber, twilioNumber, openingMessage);
//     await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", openingMessage);
//
// With this:
//
//   try {
//     // ── OPT-OUT GATE ─────────────────────────────────────
//     const blocked = await optout.isBlockedFromSending(db_helpers, db, twilioNumber, callerNumber);
//     if (blocked) {
//       console.log(`🚫 Skipping opening text — ${callerNumber} has opted out.`);
//       return res.status(200).send("Opted out — no message sent.");
//     }
//     await sendSMS(callerNumber, twilioNumber, openingMessage);
//     await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", openingMessage);
//
//
// STEP 3 — Update /incoming-sms webhook
// Add compliance check at the very top, right after
// the plumber lookup. Replace this block:
//
//   const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
//   if (!plumber) {
//     console.warn(`⚠️  No plumber config for: ${twilioNumber}`);
//     return;
//   }
//
//   // ── EMERGENCY DETECTION ──────────────────────────────────
//
// With this:
//
//   const plumber = await db_helpers.getPlumberByTwilioNumber(db, twilioNumber);
//   if (!plumber) {
//     console.warn(`⚠️  No plumber config for: ${twilioNumber}`);
//     return;
//   }
//
//   // ── COMPLIANCE KEYWORDS (STOP / START / HELP) ────────────
//   const compliance = await optout.handleComplianceKeyword(
//     db_helpers, db, sendSMS,
//     twilioNumber, callerNumber, incomingText, plumber
//   );
//   if (compliance.handled) return;
//
//   // ── OPT-OUT GATE ─────────────────────────────────────────
//   const blocked = await optout.isBlockedFromSending(db_helpers, db, twilioNumber, callerNumber);
//   if (blocked) return;
//
//   // ── EMERGENCY DETECTION ──────────────────────────────────
//
// ─────────────────────────────────────────────────────────────
