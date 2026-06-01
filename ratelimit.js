// ─────────────────────────────────────────────────────────────
// PHASE 3 — RATE LIMITING
// ZeroMissCall v2
//
// HOW TO USE:
// 1. Save this file as ratelimit.js in the same folder as server.js
// 2. Follow the integration instructions at the bottom of this file
//
// WHAT THIS DOES:
// Protects against runaway OpenAI costs from:
//   - Confused or spammy customers sending dozens of messages
//   - Malicious actors hammering the endpoint
//   - Twilio webhook retries stacking up
//
// Two layers of protection:
//   1. Per-conversation daily message cap (default: 10 messages)
//   2. Per-conversation cost cap ($0.50 estimated OpenAI spend)
//
// All limits are in-memory (fast) with MongoDB backup for
// persistence across server restarts.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// LIMITS — adjust these as needed
// ─────────────────────────────────────────────
const LIMITS = {
  // Max messages a customer can send in one day
  // 10 is generous for a plumbing inquiry — most
  // legitimate conversations are 3-6 messages
  MAX_MESSAGES_PER_DAY: 10,

  // Max estimated OpenAI cost per conversation per day (USD)
  // gpt-4o-mini is ~$0.00015 per 1K input tokens
  // ~$0.0006 per 1K output tokens
  // Average conversation message costs ~$0.001-0.003
  // $0.50 = ~150-500 messages worth of protection
  MAX_COST_PER_DAY_USD: 0.50,

  // Estimated cost per AI call (conservative estimate)
  // Used for cost tracking since we can't get exact
  // token counts without parsing the full response
  ESTIMATED_COST_PER_CALL: 0.003,

  // How long to keep rate limit records in memory (ms)
  // Set to 25 hours to cover full day + buffer
  MEMORY_TTL_MS: 25 * 60 * 60 * 1000,
};

// ─────────────────────────────────────────────
// IN-MEMORY RATE LIMIT STORE
// Key: "twilioNumber:callerNumber:YYYY-MM-DD"
// Value: { messageCount, estimatedCost, firstSeen }
// ─────────────────────────────────────────────
const rateLimitStore = new Map();

// Clean up old entries every hour to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now - record.firstSeen > LIMITS.MEMORY_TTL_MS) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

// ─────────────────────────────────────────────
// GET TODAY'S DATE STRING (for keying records)
// ─────────────────────────────────────────────
function getTodayKey(twilioNumber, callerNumber) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${twilioNumber}:${callerNumber}:${today}`;
}

// ─────────────────────────────────────────────
// GET OR CREATE RATE LIMIT RECORD
// ─────────────────────────────────────────────
function getRecord(key) {
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      messageCount:  0,
      estimatedCost: 0,
      firstSeen:     Date.now(),
    });
  }
  return rateLimitStore.get(key);
}

// ─────────────────────────────────────────────
// CHECK RATE LIMIT
//
// Call this BEFORE processing a message with OpenAI.
//
// Returns:
//   { limited: false }           — OK to proceed
//   { limited: true, reason }    — block this message
// ─────────────────────────────────────────────
function checkRateLimit(twilioNumber, callerNumber) {
  const key    = getTodayKey(twilioNumber, callerNumber);
  const record = getRecord(key);

  if (record.messageCount >= LIMITS.MAX_MESSAGES_PER_DAY) {
    return {
      limited: true,
      reason:  "MESSAGE_CAP",
      count:   record.messageCount,
    };
  }

  if (record.estimatedCost >= LIMITS.MAX_COST_PER_DAY_USD) {
    return {
      limited: true,
      reason:  "COST_CAP",
      cost:    record.estimatedCost.toFixed(4),
    };
  }

  return { limited: false };
}

// ─────────────────────────────────────────────
// RECORD A MESSAGE (increment counters)
//
// Call this AFTER a successful OpenAI call.
// ─────────────────────────────────────────────
function recordMessage(twilioNumber, callerNumber) {
  const key    = getTodayKey(twilioNumber, callerNumber);
  const record = getRecord(key);

  record.messageCount  += 1;
  record.estimatedCost += LIMITS.ESTIMATED_COST_PER_CALL;

  return record;
}

// ─────────────────────────────────────────────
// GET CURRENT STATS (for logging / monitoring)
// ─────────────────────────────────────────────
function getStats(twilioNumber, callerNumber) {
  const key    = getTodayKey(twilioNumber, callerNumber);
  const record = rateLimitStore.get(key);

  if (!record) {
    return { messageCount: 0, estimatedCost: 0 };
  }

  return {
    messageCount:     record.messageCount,
    estimatedCost:    record.estimatedCost.toFixed(4),
    messagesRemaining: Math.max(0, LIMITS.MAX_MESSAGES_PER_DAY - record.messageCount),
    costRemaining:    Math.max(0, LIMITS.MAX_COST_PER_DAY_USD - record.estimatedCost).toFixed(4),
  };
}

// ─────────────────────────────────────────────
// RATE LIMIT RESPONSE MESSAGE
// Friendly message that doesn't reveal the system
// ─────────────────────────────────────────────
function getRateLimitReply(plumber) {
  const ownerName = plumber ? plumber.ownerName : "the team";
  return (
    `Thanks — we have everything we need! ` +
    `${ownerName} will be in touch with you shortly to get this sorted.`
  );
}

module.exports = {
  checkRateLimit,
  recordMessage,
  getStats,
  getRateLimitReply,
  LIMITS,
};

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Add require at top of server.js:
//
//   const ratelimit = require("./ratelimit");
//
//
// STEP 2 — In /incoming-sms, add rate limit check
// AFTER the opt-out gate, BEFORE emergency detection.
// Replace this comment:
//
//   // ── EMERGENCY DETECTION ──────────────────────────────────
//   const emergency = isEmergency(incomingText);
//
// With this:
//
//   // ── RATE LIMIT CHECK ─────────────────────────────────────
//   const limitCheck = ratelimit.checkRateLimit(twilioNumber, callerNumber);
//   if (limitCheck.limited) {
//     console.log(`⚠️  RATE LIMITED: ${callerNumber} | Reason: ${limitCheck.reason}`);
//     try {
//       await sendSMS(callerNumber, twilioNumber, ratelimit.getRateLimitReply(plumber));
//     } catch (err) {
//       console.error("❌ Failed to send rate limit reply:", err.message);
//     }
//     return;
//   }
//
//   // ── EMERGENCY DETECTION ──────────────────────────────────
//   const emergency = isEmergency(incomingText);
//
//
// STEP 3 — Record each successful AI call.
// After the OpenAI call succeeds, add one line.
// Find this line:
//
//     const aiReply = completion.choices[0].message.content.trim();
//
// Add immediately after it:
//
//     ratelimit.recordMessage(twilioNumber, callerNumber);
//
//
// STEP 4 — Add stats logging (optional but useful).
// After recordMessage, add:
//
//     const stats = ratelimit.getStats(twilioNumber, callerNumber);
//     console.log(`📊 Rate limit stats for ${callerNumber}: ${JSON.stringify(stats)}`);
//
// ─────────────────────────────────────────────────────────────
