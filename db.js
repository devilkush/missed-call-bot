// ─────────────────────────────────────────────────────────────
// PHASE 1 — EXTENDED DATABASE SCHEMA & HELPERS
// ZeroMissCall v2
//
// HOW TO USE:
// Replace your existing MongoDB helper functions in server.js
// with these. The new plumber schema is backwards-compatible —
// existing documents still work, new fields default gracefully.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// PLUMBER DOCUMENT SCHEMA (reference)
// What a full plumber document looks like in MongoDB.
// All new fields have sensible defaults so existing
// plumber documents don't break.
// ─────────────────────────────────────────────

/*
{
  // ── Core (existing) ──────────────────────────────
  twilioNumber:          "+18885760762",   // Twilio number assigned to this plumber
  businessName:          "Mike's Plumbing",
  ownerName:             "Mike",
  ownerPhone:            "+12145550001",   // where emergency & lead alerts go
  serviceArea:           "Dallas, TX",
  hours:                 "Mon-Fri 8am-6pm",
  customFaqs:            [],               // [{question, answer}]
  services:              [],               // ["drain unblocking", "boiler repair"]
  emergencyAvailable:    true,
  active:                true,

  // ── NEW: Contact & Billing ────────────────────────
  email:                 "mike@mikesplumbing.com",  // all reports & alerts
  stripeCustomerId:      "cus_xxx",
  stripeSubscriptionId:  "sub_xxx",

  // ── NEW: Trial & Subscription ─────────────────────
  subscriptionStatus:    "trial",   // "trial" | "active" | "cancelled" | "expired"
  trialStartDate:        ISODate,
  trialEndDate:          ISODate,   // trialStartDate + 14 days
  trialEndEmailSent:     false,     // prevents duplicate trial-end emails

  // ── NEW: Business Intelligence ────────────────────
  averageJobValue:       250,       // USD — used to calculate estimated revenue
  timezone:              "America/Chicago",  // for scheduling emails at right local time

  // ── NEW: Email Preferences ────────────────────────
  weeklyDigestEnabled:   true,
  monthlyReportEnabled:  true,
  weeklyDigestLastSent:  ISODate,
  monthlyReportLastSent: ISODate,

  // ── NEW: Onboarding ───────────────────────────────
  dashboardToken:        "abc123xyz",  // unique token for /dashboard/:token
  welcomeEmailSent:      false,

  // ── Timestamps ────────────────────────────────────
  createdAt:             ISODate,
  updatedAt:             ISODate,
}
*/

// ─────────────────────────────────────────────
// CONVERSATION DOCUMENT SCHEMA (reference)
// Extended from v1 to track lead capture & job type
// ─────────────────────────────────────────────

/*
{
  twilioNumber:   "+18885760762",
  callerNumber:   "+12145559999",
  messages:       [{ role, content, timestamp }],
  emergency:      false,

  // ── NEW fields ────────────────────────────────────
  leadCaptured:         false,   // true when AI has got problem + zip + time

  // ── Jobs Recovered ledger ──
  // Set by the owner from the dashboard after he calls the lead back.
  jobOutcome:           null,    // "won" | "lost" | null (not yet marked)
  jobValue:             0,       // USD, defaults to plumber.averageJobValue on "won"
  outcomeMarkedAt:      null,    // Date the owner marked it
  leadNotifiedAt:       ISODate, // when the structured lead alert was sent to plumber
  jobDescription:       "",      // extracted from conversation
  callerZip:            "",      // extracted from conversation
  preferredTime:        "",      // extracted from conversation
  jobType:              "",      // e.g. "drain", "boiler", "leak", "general"
  messageCount:         0,       // total messages in this conversation
  optedOut:             false,   // true if customer sent STOP

  createdAt:      ISODate,
  updatedAt:      ISODate,
}
*/

// ─────────────────────────────────────────────
// OPT-OUT DOCUMENT SCHEMA (reference)
// Tracks numbers that have sent STOP
// ─────────────────────────────────────────────

/*
{
  twilioNumber:   "+18885760762",   // the business's Twilio number
  callerNumber:   "+12145559999",   // the customer who opted out
  optedOutAt:     ISODate,
  resubscribedAt: ISODate | null,
  active:         true,             // true = opted out, false = resubscribed
}
*/

// ─────────────────────────────────────────────
// DATABASE HELPER FUNCTIONS
// Drop these into your server.js, replacing the old versions
// ─────────────────────────────────────────────

const crypto = require("crypto");

// ── Get plumber by Twilio number (unchanged API, extended fallback) ──
async function getPlumberByTwilioNumber(db, twilioNumber) {
  if (db) {
    const plumber = await db
      .collection("plumbers")
      .findOne({ twilioNumber, active: true });
    if (plumber) return plumber;
  }

  // Fallback for local testing / single-tenant
  if (twilioNumber === process.env.TWILIO_NUMBER) {
    return {
      twilioNumber,
      businessName:          process.env.BUSINESS_NAME  || "Your Plumbing Co.",
      ownerName:             process.env.OWNER_NAME      || "the team",
      ownerPhone:            process.env.OWNER_PHONE     || "",
      email:                 process.env.OWNER_EMAIL     || "",
      serviceArea:           process.env.SERVICE_AREA    || "the local area",
      hours:                 process.env.BUSINESS_HOURS  || "Mon-Fri 8am-6pm",
      customFaqs:            [],
      services:              [],
      emergencyAvailable:    true,
      subscriptionStatus:    "active",
      averageJobValue:       250,
      timezone:              "America/Chicago",
      weeklyDigestEnabled:   true,
      monthlyReportEnabled:  true,
      dashboardToken:        "local-test",
    };
  }

  return null;
}

// ── Create a new plumber (used by onboarding API) ──
async function createPlumber(db, data) {
  const now = new Date();
  const trialStart = now;
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  const doc = {
    // Core
    twilioNumber:          data.twilioNumber,
    businessName:          data.businessName,
    ownerName:             data.ownerName       || "the team",
    ownerPhone:            data.ownerPhone      || "",
    serviceArea:           data.serviceArea     || "your local area",
    hours:                 data.hours           || "Mon-Fri 8am-6pm",
    customFaqs:            data.customFaqs      || [],
    services:              data.services        || [],
    emergencyAvailable:    data.emergencyAvailable !== false,
    active:                true,

    // Contact & Billing
    email:                 data.email,
    stripeCustomerId:      null,
    stripeSubscriptionId:  null,

    // Trial & Subscription
    subscriptionStatus:    "trial",
    trialStartDate:        trialStart,
    trialEndDate:          trialEnd,
    trialEndEmailSent:     false,

    // Business Intelligence
    averageJobValue:       data.averageJobValue || 250,
    timezone:              data.timezone        || "America/Chicago",

    // Email Preferences
    weeklyDigestEnabled:   true,
    monthlyReportEnabled:  true,
    weeklyDigestLastSent:  null,
    monthlyReportLastSent: null,

    // Onboarding
    dashboardToken:        crypto.randomBytes(24).toString("hex"),
    welcomeEmailSent:      false,
    verified:              data.verified !== false,
    verificationToken:     data.verificationToken || null,

    // Timestamps
    createdAt:             now,
    updatedAt:             now,
  };

  const result = await db.collection("plumbers").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

// ── Update plumber ──
async function updatePlumber(db, twilioNumber, updates) {
  return db.collection("plumbers").updateOne(
    { twilioNumber },
    { $set: { ...updates, updatedAt: new Date() } }
  );
}

// ── Get conversation (scoped to today) ──
async function getConversation(db, twilioNumber, callerNumber) {
  if (!db) return [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const convo = await db.collection("conversations").findOne(
    { twilioNumber, callerNumber, createdAt: { $gte: startOfDay } },
    { sort: { createdAt: -1 } }
  );
  return convo ? convo.messages : [];
}

// ── Save message to conversation ──
async function saveMessage(db, twilioNumber, callerNumber, role, content, extra = {}) {
  if (!db) return;
  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  await db.collection("conversations").updateOne(
    { twilioNumber, callerNumber, createdAt: { $gte: startOfDay } },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        updatedAt: now,
        ...(extra.emergency && { emergency: true }),
        ...(extra.leadCaptured !== undefined && { leadCaptured: extra.leadCaptured }),
        ...(extra.jobDescription && { jobDescription: extra.jobDescription }),
        ...(extra.callerZip && { callerZip: extra.callerZip }),
        ...(extra.preferredTime && { preferredTime: extra.preferredTime }),
        ...(extra.jobType && { jobType: extra.jobType }),
      },
      $push: { messages: { role, content, timestamp: now } },
      $inc: { messageCount: 1 },
    },
    { upsert: true }
  );
}

// ── Check if a caller has opted out ──
async function isOptedOut(db, twilioNumber, callerNumber) {
  if (!db) return false;
  const record = await db.collection("optouts").findOne({
    twilioNumber,
    callerNumber,
    active: true,
  });
  return !!record;
}

// ── Record an opt-out (STOP) ──
async function recordOptOut(db, twilioNumber, callerNumber) {
  if (!db) return;
  const now = new Date();
  await db.collection("optouts").updateOne(
    { twilioNumber, callerNumber },
    {
      $set: { active: true, optedOutAt: now, updatedAt: now },
      $setOnInsert: { createdAt: now, resubscribedAt: null },
    },
    { upsert: true }
  );
  // Also mark conversation as opted out
  await db.collection("conversations").updateMany(
    { twilioNumber, callerNumber },
    { $set: { optedOut: true } }
  );
}

// ── Record an affirmative consent event (IVR press-1 opt-in) ──
// Stored as a permanent, timestamped proof of consent per number, and
// stamped on the conversation so it shows in the dashboard / audit trail.
async function recordConsent(db, twilioNumber, callerNumber, method) {
  if (!db) return;
  const now = new Date();
  await db.collection("consents").updateOne(
    { twilioNumber, callerNumber },
    {
      $set: { method: method || "ivr_press_1", consentedAt: now, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  await db.collection("conversations").updateMany(
    { twilioNumber, callerNumber },
    { $set: { consentMethod: method || "ivr_press_1", consentedAt: now } }
  );
}

// ── Record a resubscribe (START) ──
async function recordResubscribe(db, twilioNumber, callerNumber) {
  if (!db) return;
  const now = new Date();
  await db.collection("optouts").updateOne(
    { twilioNumber, callerNumber },
    { $set: { active: false, resubscribedAt: now, updatedAt: now } }
  );
}

// ── Get stats for a plumber over a date range ──
async function getStats(db, twilioNumber, fromDate, toDate) {
  if (!db) return null;

  const convos = await db.collection("conversations").find({
    twilioNumber,
    createdAt: { $gte: fromDate, $lte: toDate },
  }).toArray();

  const totalConversations  = convos.length;
  const leadsCaptures       = convos.filter(c => c.leadCaptured).length;
  const emergencies         = convos.filter(c => c.emergency).length;
  const totalMessages       = convos.reduce((sum, c) => sum + (c.messageCount || c.messages?.length || 0), 0);

  // Job type breakdown
  const jobTypes = {};
  convos.forEach(c => {
    if (c.jobType) {
      jobTypes[c.jobType] = (jobTypes[c.jobType] || 0) + 1;
    }
  });

  // Top 3 job types
  const topJobTypes = Object.entries(jobTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => ({ type, count }));

  // Best conversation (most messages, lead captured)
  const bestConvo = convos
    .filter(c => c.leadCaptured)
    .sort((a, b) => (b.messages?.length || 0) - (a.messages?.length || 0))[0] || null;

  return {
    totalConversations,
    leadsCaptures,
    emergencies,
    totalMessages,
    topJobTypes,
    bestConvo,
  };
}

// ── Get all plumbers due for trial-end email (day 13) ──
async function getTrialEndingTomorrow(db) {
  if (!db) return [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  return db.collection("plumbers").find({
    subscriptionStatus: "trial",
    active: true,
    trialEndEmailSent: false,
    trialEndDate: { $gte: tomorrow, $lt: dayAfterTomorrow },
  }).toArray();
}

// ── Get all active plumbers for weekly digest ──
async function getActiveForWeeklyDigest(db) {
  if (!db) return [];
  return db.collection("plumbers").find({
    subscriptionStatus: "active",
    active: true,
    weeklyDigestEnabled: true,
  }).toArray();
}

// ── Get all active plumbers for monthly report ──
async function getActiveForMonthlyReport(db) {
  if (!db) return [];
  return db.collection("plumbers").find({
    subscriptionStatus: "active",
    active: true,
    monthlyReportEnabled: true,
  }).toArray();
}

// ── Get plumbers whose trial has expired today ──
async function getExpiredTrials(db) {
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.collection("plumbers").find({
    subscriptionStatus: "trial",
    active: true,
    trialEndDate: { $gte: today, $lt: tomorrow },
  }).toArray();
}

// ── Get plumber by dashboard token ──
async function getPlumberByToken(db, token) {
  if (!db) return null;
  return db.collection("plumbers").findOne({ dashboardToken: token, active: true });
}


// ── Get all plumbers (for admin dashboard) ──
async function getAllPlumbers(db) {
  if (!db) return [];
  return db.collection("plumbers")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
}

// ── Get all active plumbers (for scheduler) ──
async function getAllActivePlumbers(db) {
  if (!db) return [];
  return db.collection("plumbers")
    .find({ active: true })
    .toArray();
}

// ── Get recent conversations for dashboard ──
async function getRecentConversations(db, twilioNumber, limit = 20) {
  if (!db) return [];
  return db.collection("conversations")
    .find({ twilioNumber })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

// ── MongoDB indexes to create on first run ──
// Run this once when your server starts
async function ensureIndexes(db) {
  if (!db) return;

  // plumbers
  // twilioNumber is intentionally NON-unique during the shared-number phase:
  // the first few trial customers all share +18885760762 (per-customer numbers
  // come later). If an older UNIQUE index exists, drop it first so we can
  // recreate it non-unique without an IndexOptionsConflict on startup.
  try {
    const plumberIdx = await db.collection("plumbers").indexes();
    const twilioIdx = plumberIdx.find((i) => i.name === "twilioNumber_1");
    if (twilioIdx && twilioIdx.unique) {
      await db.collection("plumbers").dropIndex("twilioNumber_1");
      console.log("🔧 Dropped old UNIQUE twilioNumber index (shared-number phase)");
    }
  } catch (e) {
    console.error("⚠️ twilioNumber index migration check failed:", e.message);
  }
  await db.collection("plumbers").createIndex({ twilioNumber: 1 });
  await db.collection("plumbers").createIndex({ subscriptionStatus: 1 });
  await db.collection("plumbers").createIndex({ trialEndDate: 1 });
  await db.collection("plumbers").createIndex({ dashboardToken: 1 });

  // conversations
  await db.collection("conversations").createIndex({ twilioNumber: 1, callerNumber: 1, createdAt: -1 });
  await db.collection("conversations").createIndex({ twilioNumber: 1, createdAt: -1 });
  await db.collection("conversations").createIndex({ leadCaptured: 1 });

  // ── DATA RETENTION (privacy policy compliance) ──────────────
  // privacy.html promises conversation data is auto-deleted after
  // 12 months. This TTL index makes MongoDB enforce that promise.
  // If an old non-TTL index blocks creation, we recreate it.
  const TWELVE_MONTHS = 365 * 24 * 60 * 60; // seconds
  try {
    await db.collection("conversations").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: TWELVE_MONTHS, name: "retention_ttl" }
    );
  } catch (e) {
    if (e.codeName === "IndexOptionsConflict") {
      await db.collection("conversations").dropIndex("retention_ttl");
      await db.collection("conversations").createIndex(
        { updatedAt: 1 },
        { expireAfterSeconds: TWELVE_MONTHS, name: "retention_ttl" }
      );
    } else {
      console.error("⚠️ Retention TTL index failed:", e.message);
    }
  }
  // Opt-out records are kept indefinitely on purpose - carriers
  // require STOP lists to persist even after data cleanup.

  // optouts
  await db.collection("optouts").createIndex({ twilioNumber: 1, callerNumber: 1 }, { unique: true });
  await db.collection("optouts").createIndex({ active: 1 });
  await db.collection("consents").createIndex({ twilioNumber: 1, callerNumber: 1 }, { unique: true });

  console.log("✅ MongoDB indexes ensured");
}

// ─────────────────────────────────────────────
// JOBS RECOVERED LEDGER
// Owner marks a captured lead as won or lost after calling back.
// outcome: "won" | "lost". value only used when won.
// ─────────────────────────────────────────────
async function markJobOutcome(db, twilioNumber, callerNumber, outcome, value) {
  if (!db) return null;
  if (outcome !== "won" && outcome !== "lost") return null;

  const set = {
    jobOutcome:      outcome,
    outcomeMarkedAt: new Date(),
    updatedAt:       new Date(),
    jobValue:        outcome === "won" ? Math.max(0, Number(value) || 0) : 0,
  };

  return db.collection("conversations").updateOne(
    { twilioNumber, callerNumber },
    { $set: set }
  );
}

// Totals for the ledger. Revenue/won/lost count ANY conversation the owner
// marked (they can now mark non-lead threads too). "unmarked" stays scoped to
// captured leads that still need actioning, so the daily summary only nags
// about genuine leads awaiting a callback - not every stray thread.
async function getRecoveredTotals(db, twilioNumber, fromDate, toDate) {
  if (!db) return { won: 0, lost: 0, unmarked: 0, revenue: 0 };

  const query = { twilioNumber };
  if (fromDate && toDate) query.createdAt = { $gte: fromDate, $lte: toDate };

  const convos = await db.collection("conversations").find(query).toArray();

  return {
    won:      convos.filter(c => c.jobOutcome === "won").length,
    lost:     convos.filter(c => c.jobOutcome === "lost").length,
    unmarked: convos.filter(c => c.leadCaptured && !c.jobOutcome).length,
    revenue:  convos.reduce((sum, c) => sum + (c.jobOutcome === "won" ? (c.jobValue || 0) : 0), 0),
  };
}

module.exports = {
  markJobOutcome,
  getRecoveredTotals,
  getPlumberByTwilioNumber,
  createPlumber,
  updatePlumber,
  getConversation,
  saveMessage,
  isOptedOut,
  recordOptOut,
  recordResubscribe,
  recordConsent,
  getStats,
  getTrialEndingTomorrow,
  getActiveForWeeklyDigest,
  getActiveForMonthlyReport,
  getExpiredTrials,
  getAllPlumbers,
  getAllActivePlumbers,
  getPlumberByToken,
  getRecentConversations,
  ensureIndexes,
};

// ─────────────────────────────────────────────
// HOW TO INTEGRATE INTO server.js
// ─────────────────────────────────────────────
//
// 1. Save this file as db.js in the same folder as server.js
//
// 2. At the top of server.js, replace your existing helper
//    function definitions with:
//
//    const db_helpers = require("./db");
//
// 3. After MongoDB connects, call:
//
//    MongoClient.connect(process.env.MONGODB_URI).then(client => {
//      db = client.db("zeromisscall");
//      db_helpers.ensureIndexes(db);  // ← add this line
//      console.log("✅ MongoDB connected");
//    });
//
// 4. Replace all calls to getPlumberByTwilioNumber(twilioNumber)
//    with db_helpers.getPlumberByTwilioNumber(db, twilioNumber)
//
//    Replace all calls to getConversation(twilioNumber, callerNumber)
//    with db_helpers.getConversation(db, twilioNumber, callerNumber)
//
//    Replace all calls to saveMessage(...)
//    with db_helpers.saveMessage(db, ...)
//
// 5. Add to your .env file:
//    OWNER_EMAIL=hello@zeromisscall.com
//
// ─────────────────────────────────────────────
