// ─────────────────────────────────────────────────────────────
// PHASE 5 — SCHEDULED JOBS
// ZeroMissCall v2
//
// HOW TO USE:
// 1. npm install node-cron
// 2. Save this file as scheduler.js in the same folder as server.js
// 3. Follow integration instructions at the bottom
//
// WHAT THIS DOES:
// Four automated jobs that run on a schedule:
//
//   Job 1 — Daily trial check (6am UTC)
//   Finds plumbers on day 13 of trial, sends trial-end email
//
//   Job 2 — Weekly digest (Monday 7am UTC)
//   Sends weekly summary to all active plumbers
//
//   Job 3 — Monthly report (last day of month, 5am UTC)
//   Sends full monthly report to all active plumbers
//
//   Job 4 — Trial expiry enforcement (midnight UTC)
//   Deactivates expired trials, stops bot responding
// ─────────────────────────────────────────────────────────────

const cron = require("node-cron");

// ─────────────────────────────────────────────
// HELPER — get month name
// ─────────────────────────────────────────────
function getMonthName(date) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────
// HELPER — get week date range string
// ─────────────────────────────────────────────
function getWeekOf() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

// ─────────────────────────────────────────────
// HELPER — is today the last day of the month?
// ─────────────────────────────────────────────
function isLastDayOfMonth() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

// ─────────────────────────────────────────────
// HELPER — get date range for last 7 days
// ─────────────────────────────────────────────
function getLastWeekRange() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

// ─────────────────────────────────────────────
// HELPER — get date range for current month
// ─────────────────────────────────────────────
function getCurrentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

// ─────────────────────────────────────────────
// JOB 1 — DAILY TRIAL CHECK
// Runs every day at 6:00 AM UTC
// Finds plumbers on day 13 of trial
// Sends trial-end email with real conversation data
// ─────────────────────────────────────────────
async function runTrialEndCheck(db, db_helpers, emailService) {
  console.log("⏰ [CRON] Running trial end check...");

  try {
    const plumbers = await db_helpers.getTrialEndingTomorrow(db);

    if (plumbers.length === 0) {
      console.log("⏰ [CRON] No trials ending tomorrow.");
      return;
    }

    console.log(`⏰ [CRON] ${plumbers.length} trial(s) ending tomorrow — sending emails...`);

    for (const plumber of plumbers) {
      try {
        // Get their stats for the full trial period
        const stats = await db_helpers.getStats(
          db,
          plumber.twilioNumber,
          plumber.trialStartDate,
          new Date()
        );

        // Calculate estimated revenue
        const avgJobValue = plumber.averageJobValue || 250;
        const estimatedRevenue = (stats.leadsCaptures * avgJobValue).toLocaleString();

        const enrichedStats = {
          ...stats,
          estimatedRevenue,
        };

        // Get real conversations for snippets
        const conversations = await db_helpers.getRecentConversations(
          db,
          plumber.twilioNumber,
          5
        );

        // Send trial end email
        await emailService.sendTrialEndEmail(plumber, enrichedStats, conversations);

        // Mark trial end email as sent so it doesn't fire again
        await db_helpers.updatePlumber(db, plumber.twilioNumber, {
          trialEndEmailSent: true,
        });

        console.log(`✅ [CRON] Trial end email sent to ${plumber.email} (${plumber.businessName})`);
      } catch (err) {
        console.error(`❌ [CRON] Failed trial end email for ${plumber.businessName}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ [CRON] Trial end check failed:", err.message);
  }
}

// ─────────────────────────────────────────────
// JOB 2 — WEEKLY DIGEST
// Runs every Monday at 7:00 AM UTC
// Sends weekly summary to all active plumbers
// ─────────────────────────────────────────────
async function runWeeklyDigest(db, db_helpers, emailService) {
  console.log("⏰ [CRON] Running weekly digest...");

  try {
    const plumbers = await db_helpers.getActiveForWeeklyDigest(db);

    if (plumbers.length === 0) {
      console.log("⏰ [CRON] No active plumbers for weekly digest.");
      return;
    }

    console.log(`⏰ [CRON] Sending weekly digest to ${plumbers.length} plumber(s)...`);

    const { from, to } = getLastWeekRange();

    for (const plumber of plumbers) {
      try {
        const stats = await db_helpers.getStats(db, plumber.twilioNumber, from, to);

        const avgJobValue = plumber.averageJobValue || 250;
        const estimatedRevenue = (stats.leadsCaptures * avgJobValue).toLocaleString();

        const enrichedStats = {
          ...stats,
          estimatedRevenue,
          weekOf: getWeekOf(),
        };

        await emailService.sendWeeklyDigest(plumber, enrichedStats);

        // Update last sent timestamp
        await db_helpers.updatePlumber(db, plumber.twilioNumber, {
          weeklyDigestLastSent: new Date(),
        });

        console.log(`✅ [CRON] Weekly digest sent to ${plumber.email} (${plumber.businessName})`);
      } catch (err) {
        console.error(`❌ [CRON] Failed weekly digest for ${plumber.businessName}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ [CRON] Weekly digest failed:", err.message);
  }
}

// ─────────────────────────────────────────────
// JOB 3 — MONTHLY REPORT
// Runs every day at 5:00 AM UTC
// Only actually sends on the last day of the month
// ─────────────────────────────────────────────
async function runMonthlyReport(db, db_helpers, emailService) {
  if (!isLastDayOfMonth()) return;

  console.log("⏰ [CRON] Running monthly report (last day of month)...");

  try {
    const plumbers = await db_helpers.getActiveForMonthlyReport(db);

    if (plumbers.length === 0) {
      console.log("⏰ [CRON] No active plumbers for monthly report.");
      return;
    }

    console.log(`⏰ [CRON] Sending monthly report to ${plumbers.length} plumber(s)...`);

    const { from, to } = getCurrentMonthRange();
    const monthName = getMonthName(new Date());

    for (const plumber of plumbers) {
      try {
        const stats = await db_helpers.getStats(db, plumber.twilioNumber, from, to);

        const avgJobValue = plumber.averageJobValue || 250;
        const estimatedRevenue = (stats.totalConversations * avgJobValue).toLocaleString();

        const enrichedStats = {
          ...stats,
          estimatedRevenue,
        };

        await emailService.sendMonthlyReport(plumber, enrichedStats, monthName);

        // Update last sent timestamp
        await db_helpers.updatePlumber(db, plumber.twilioNumber, {
          monthlyReportLastSent: new Date(),
        });

        console.log(`✅ [CRON] Monthly report sent to ${plumber.email} (${plumber.businessName})`);
      } catch (err) {
        console.error(`❌ [CRON] Failed monthly report for ${plumber.businessName}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ [CRON] Monthly report failed:", err.message);
  }
}

// ─────────────────────────────────────────────
// JOB 4 — TRIAL EXPIRY ENFORCEMENT
// Runs every day at midnight UTC
// Deactivates expired trials
// Stops the bot responding for expired numbers
// ─────────────────────────────────────────────
async function runTrialExpiryEnforcement(db, db_helpers) {
  console.log("⏰ [CRON] Running trial expiry enforcement...");

  try {
    const expired = await db_helpers.getExpiredTrials(db);

    if (expired.length === 0) {
      console.log("⏰ [CRON] No trials expired today.");
      return;
    }

    console.log(`⏰ [CRON] ${expired.length} trial(s) expired — deactivating...`);

    for (const plumber of expired) {
      try {
        await db_helpers.updatePlumber(db, plumber.twilioNumber, {
          subscriptionStatus: "expired",
          active: false,
        });

        console.log(`✅ [CRON] Trial expired and deactivated: ${plumber.businessName} (${plumber.twilioNumber})`);
      } catch (err) {
        console.error(`❌ [CRON] Failed to deactivate ${plumber.businessName}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ [CRON] Trial expiry enforcement failed:", err.message);
  }
}

// ─────────────────────────────────────────────
// MANUAL TRIGGER ENDPOINT HANDLERS
// For testing without waiting for cron schedule
// Protected by ADMIN_SECRET
// ─────────────────────────────────────────────
function createManualTriggers(app, db, db_helpers, emailService) {

  // Manually trigger trial end check
  app.get("/admin/trigger/trial-check", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      await runTrialEndCheck(db, db_helpers, emailService);
      res.json({ success: true, message: "Trial end check completed" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manually trigger weekly digest
  app.get("/admin/trigger/weekly-digest", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      await runWeeklyDigest(db, db_helpers, emailService);
      res.json({ success: true, message: "Weekly digest completed" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manually trigger monthly report
  app.get("/admin/trigger/monthly-report", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      // Override last-day check for manual trigger
      await runMonthlyReport(db, db_helpers, emailService);
      res.json({ success: true, message: "Monthly report completed" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manually trigger trial expiry
  app.get("/admin/trigger/trial-expiry", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      await runTrialExpiryEnforcement(db, db_helpers);
      res.json({ success: true, message: "Trial expiry check completed" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ─────────────────────────────────────────────
// MAIN — INITIALISE ALL SCHEDULED JOBS
// Call this once after MongoDB connects
// ─────────────────────────────────────────────
function initScheduler(app, db, db_helpers, emailService) {
  console.log("⏰ Initialising scheduled jobs...");

  // Job 1 — Daily trial check at 6:00 AM UTC
  cron.schedule("0 6 * * *", () => {
    runTrialEndCheck(db, db_helpers, emailService);
  }, { timezone: "UTC" });

  // Job 2 — Weekly digest every Monday at 7:00 AM UTC
  cron.schedule("0 7 * * 1", () => {
    runWeeklyDigest(db, db_helpers, emailService);
  }, { timezone: "UTC" });

  // Job 3 — Monthly report check at 5:00 AM UTC every day
  // (only actually sends on last day of month)
  cron.schedule("0 5 * * *", () => {
    runMonthlyReport(db, db_helpers, emailService);
  }, { timezone: "UTC" });

  // Job 4 — Trial expiry enforcement at midnight UTC
  cron.schedule("0 0 * * *", () => {
    runTrialExpiryEnforcement(db, db_helpers);
  }, { timezone: "UTC" });

  // Register manual trigger endpoints
  createManualTriggers(app, db, db_helpers, emailService);

  console.log("✅ Scheduled jobs initialised:");
  console.log("   📧 Trial end check    — daily at 6:00 AM UTC");
  console.log("   📧 Weekly digest      — Mondays at 7:00 AM UTC");
  console.log("   📧 Monthly report     — last day of month at 5:00 AM UTC");
  console.log("   🔒 Trial expiry       — daily at midnight UTC");
}

module.exports = { initScheduler };

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Install node-cron:
// Add "node-cron": "^3.0.3" to package.json dependencies
// (same way you added resend — edit on GitHub)
//
// STEP 2 — Add require at top of server.js:
//   const { initScheduler } = require("./scheduler");
//
// STEP 3 — Initialise scheduler after MongoDB connects.
// Replace your existing MongoDB connection block with this:
//
//   MongoClient.connect(process.env.MONGODB_URI)
//     .then((client) => {
//       db = client.db("zeromisscall");
//       db_helpers.ensureIndexes(db);
//       initScheduler(app, db, db_helpers, emailService);
//       console.log("✅ MongoDB connected");
//       console.log("✅ MongoDB indexes ensured");
//     })
//     .catch((err) => console.error("❌ MongoDB error:", err));
//
// STEP 4 — Test manually without waiting for cron:
//
//   Trial end check:
//   https://YOUR-RAILWAY-URL/admin/trigger/trial-check?secret=YOUR_ADMIN_SECRET
//
//   Weekly digest:
//   https://YOUR-RAILWAY-URL/admin/trigger/weekly-digest?secret=YOUR_ADMIN_SECRET
//
//   Monthly report:
//   https://YOUR-RAILWAY-URL/admin/trigger/monthly-report?secret=YOUR_ADMIN_SECRET
//
// ─────────────────────────────────────────────────────────────
