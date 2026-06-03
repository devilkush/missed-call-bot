// ─────────────────────────────────────────────────────────────
// PHASE 6 — ADMIN & ONBOARDING API
// ZeroMissCall v2
//
// HOW TO USE:
// 1. Save this file as admin.js in the same folder as server.js
// 2. Follow integration instructions at the bottom
//
// WHAT THIS DOES:
// Protected API endpoints for managing plumber accounts:
//
//   POST /admin/plumbers        → create new plumber
//   GET  /admin/plumbers        → list all plumbers
//   GET  /admin/plumbers/:id    → get one plumber
//   PUT  /admin/plumbers/:id    → update plumber config
//   DELETE /admin/plumbers/:id  → deactivate plumber
//
//   POST /onboard               → self-serve signup (used by website form later)
//
// All /admin routes protected by ADMIN_SECRET header or query param
// /onboard is public (used by signup form)
// ─────────────────────────────────────────────────────────────

const { ObjectId } = require("mongodb");
const crypto = require("crypto");

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// Checks for valid admin secret in:
//   - Header: x-admin-secret
//   - Query:  ?secret=YOUR_SECRET
// ─────────────────────────────────────────────
function requireAdminAuth(req, res, next) {
  const secret =
    req.headers["x-admin-secret"] ||
    req.query.secret;

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid admin secret required",
    });
  }
  next();
}

// ─────────────────────────────────────────────
// VALIDATE PLUMBER DATA
// ─────────────────────────────────────────────
function validatePlumberData(data, requireAll = true) {
  const errors = [];

  if (requireAll) {
    if (!data.twilioNumber)  errors.push("twilioNumber is required");
    if (!data.businessName)  errors.push("businessName is required");
    if (!data.ownerName)     errors.push("ownerName is required");
    if (!data.ownerPhone)    errors.push("ownerPhone is required");
    if (!data.email)         errors.push("email is required");
  }

  if (data.email && !data.email.includes("@")) {
    errors.push("email must be a valid email address");
  }

  if (data.twilioNumber && !data.twilioNumber.startsWith("+")) {
    errors.push("twilioNumber must be in E.164 format (e.g. +18885760762)");
  }

  if (data.ownerPhone && !data.ownerPhone.startsWith("+")) {
    errors.push("ownerPhone must be in E.164 format (e.g. +12145550001)");
  }

  if (data.averageJobValue && isNaN(Number(data.averageJobValue))) {
    errors.push("averageJobValue must be a number");
  }

  return errors;
}

// ─────────────────────────────────────────────
// REGISTER ALL ADMIN & ONBOARDING ROUTES
// Call this from server.js after app is created
// ─────────────────────────────────────────────
function registerAdminRoutes(app, db, db_helpers, emailService) {

  // ── CREATE PLUMBER ────────────────────────────────────────
  // POST /admin/plumbers
  // Body: { twilioNumber, businessName, ownerName, ownerPhone,
  //         email, serviceArea, hours, services, customFaqs,
  //         emergencyAvailable, averageJobValue, timezone }
  app.post("/admin/plumbers", requireAdminAuth, async (req, res) => {
    try {
      const errors = validatePlumberData(req.body, true);
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      // Check if twilioNumber already exists
      const existing = await db.collection("plumbers").findOne({
        twilioNumber: req.body.twilioNumber,
      });
      if (existing) {
        return res.status(409).json({
          error: "Conflict",
          message: `A plumber with Twilio number ${req.body.twilioNumber} already exists`,
        });
      }

      const plumber = await db_helpers.createPlumber(db, {
        twilioNumber:       req.body.twilioNumber,
        businessName:       req.body.businessName,
        ownerName:          req.body.ownerName,
        ownerPhone:         req.body.ownerPhone,
        email:              req.body.email,
        serviceArea:        req.body.serviceArea        || "your local area",
        hours:              req.body.hours              || "Mon-Fri 8am-6pm",
        services:           req.body.services           || [],
        customFaqs:         req.body.customFaqs         || [],
        emergencyAvailable: req.body.emergencyAvailable !== false,
        averageJobValue:    Number(req.body.averageJobValue) || 250,
        timezone:           req.body.timezone           || "America/Chicago",
      });

      // Send welcome email
      try {
        await sendWelcomeEmail(plumber, emailService);
        await db_helpers.updatePlumber(db, plumber.twilioNumber, {
          welcomeEmailSent: true,
        });
      } catch (emailErr) {
        console.error("⚠️ Welcome email failed:", emailErr.message);
        // Don't fail the whole request if email fails
      }

      console.log(`✅ Plumber created: ${plumber.businessName} (${plumber.twilioNumber})`);

      res.status(201).json({
        success: true,
        message: `${plumber.businessName} created successfully`,
        plumber: sanitizePlumber(plumber),
      });
    } catch (err) {
      console.error("❌ Create plumber error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── LIST ALL PLUMBERS ─────────────────────────────────────
  // GET /admin/plumbers
  // Query: ?status=trial|active|expired|all (default: all)
  app.get("/admin/plumbers", requireAdminAuth, async (req, res) => {
    try {
      const filter = {};
      if (req.query.status && req.query.status !== "all") {
        filter.subscriptionStatus = req.query.status;
      }

      const plumbers = await db.collection("plumbers")
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        count: plumbers.length,
        plumbers: plumbers.map(sanitizePlumber),
      });
    } catch (err) {
      console.error("❌ List plumbers error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET ONE PLUMBER ───────────────────────────────────────
  // GET /admin/plumbers/:id
  app.get("/admin/plumbers/:id", requireAdminAuth, async (req, res) => {
    try {
      const plumber = await db.collection("plumbers").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!plumber) {
        return res.status(404).json({ error: "Plumber not found" });
      }

      // Get their stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await db_helpers.getStats(
        db,
        plumber.twilioNumber,
        thirtyDaysAgo,
        now
      );

      res.json({
        success: true,
        plumber: sanitizePlumber(plumber),
        stats,
      });
    } catch (err) {
      console.error("❌ Get plumber error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE PLUMBER ────────────────────────────────────────
  // PUT /admin/plumbers/:id
  // Body: any fields to update
  app.put("/admin/plumbers/:id", requireAdminAuth, async (req, res) => {
    try {
      const errors = validatePlumberData(req.body, false);
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const plumber = await db.collection("plumbers").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!plumber) {
        return res.status(404).json({ error: "Plumber not found" });
      }

      // Only allow updating safe fields
      const allowedUpdates = [
        "businessName", "ownerName", "ownerPhone", "email",
        "serviceArea", "hours", "services", "customFaqs",
        "emergencyAvailable", "averageJobValue", "timezone",
        "weeklyDigestEnabled", "monthlyReportEnabled",
        "subscriptionStatus", "active",
      ];

      const updates = {};
      for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      await db_helpers.updatePlumber(db, plumber.twilioNumber, updates);

      console.log(`✅ Plumber updated: ${plumber.businessName}`);

      res.json({
        success: true,
        message: `${plumber.businessName} updated successfully`,
        updated: updates,
      });
    } catch (err) {
      console.error("❌ Update plumber error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DEACTIVATE PLUMBER ────────────────────────────────────
  // DELETE /admin/plumbers/:id
  // Soft delete — sets active: false, doesn't remove data
  app.delete("/admin/plumbers/:id", requireAdminAuth, async (req, res) => {
    try {
      const plumber = await db.collection("plumbers").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!plumber) {
        return res.status(404).json({ error: "Plumber not found" });
      }

      await db_helpers.updatePlumber(db, plumber.twilioNumber, {
        active: false,
        subscriptionStatus: "cancelled",
      });

      console.log(`🔴 Plumber deactivated: ${plumber.businessName}`);

      res.json({
        success: true,
        message: `${plumber.businessName} deactivated. Bot will no longer respond for ${plumber.twilioNumber}.`,
      });
    } catch (err) {
      console.error("❌ Deactivate plumber error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── SELF-SERVE ONBOARDING ─────────────────────────────────
  // POST /onboard
  // Public endpoint — used by website signup form
  // Creates plumber with trial status and sends welcome email
  app.post("/onboard", async (req, res) => {
    try {
      const errors = validatePlumberData(req.body, true);
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      // Check if already exists
      const existing = await db.collection("plumbers").findOne({
        $or: [
          { twilioNumber: req.body.twilioNumber },
          { email: req.body.email },
        ],
      });

      if (existing) {
        return res.status(409).json({
          error: "Account already exists",
          message: "An account with this phone number or email already exists. Please contact support.",
        });
      }

      const plumber = await db_helpers.createPlumber(db, req.body);

      // Send welcome email
      try {
        await sendWelcomeEmail(plumber, emailService);
        await db_helpers.updatePlumber(db, plumber.twilioNumber, {
          welcomeEmailSent: true,
        });
      } catch (emailErr) {
        console.error("⚠️ Welcome email failed:", emailErr.message);
      }

      console.log(`🎉 New trial signup: ${plumber.businessName} (${plumber.email})`);

      res.status(201).json({
        success: true,
        message: "Trial account created successfully",
        trialEndsAt: plumber.trialEndDate,
        dashboardUrl: `https://missed-call-bot-production.up.railway.app/dashboard/${plumber.dashboardToken}`,
      });
    } catch (err) {
      console.error("❌ Onboard error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── ADMIN STATS OVERVIEW ──────────────────────────────────
  // GET /admin/stats
  // Overall business metrics for you
  app.get("/admin/stats", requireAdminAuth, async (req, res) => {
    try {
      const [
        totalPlumbers,
        trialPlumbers,
        activePlumbers,
        expiredPlumbers,
        cancelledPlumbers,
        totalConversations,
      ] = await Promise.all([
        db.collection("plumbers").countDocuments({}),
        db.collection("plumbers").countDocuments({ subscriptionStatus: "trial" }),
        db.collection("plumbers").countDocuments({ subscriptionStatus: "active" }),
        db.collection("plumbers").countDocuments({ subscriptionStatus: "expired" }),
        db.collection("plumbers").countDocuments({ subscriptionStatus: "cancelled" }),
        db.collection("conversations").countDocuments({}),
      ]);

      const mrr = activePlumbers * 69;

      res.json({
        success: true,
        overview: {
          totalPlumbers,
          trialPlumbers,
          activePlumbers,
          expiredPlumbers,
          cancelledPlumbers,
          totalConversations,
          mrr: `$${mrr}`,
          mrrRaw: mrr,
        },
      });
    } catch (err) {
      console.error("❌ Stats error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

// ─────────────────────────────────────────────
// WELCOME EMAIL
// Sends when a new plumber signs up
// ─────────────────────────────────────────────
async function sendWelcomeEmail(plumber, emailService) {
  // We'll use Resend directly here since we need
  // a custom template not in the main email.js
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const trialEnd = new Date(plumber.trialEndDate).toLocaleDateString("en-US", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="background:#0b1928;margin:0;padding:0;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1928;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;border-bottom:3px solid #E8791A;">
          <span style="font-family:'Nunito',Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;display:inline-block;">zero<span style="color:#E8791A;">miss</span>call</span>
        </td></tr>

        <!-- Content -->
        <tr><td style="background:#ffffff;padding:36px;">
          <h1 style="font-family:'Nunito',Arial,sans-serif;font-size:24px;color:#0b1928;margin:0 0 8px 0;">
            Welcome to ZeroMissCall, ${plumber.ownerName}! 🎉
          </h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px 0;">
            Your 14-day free trial for <strong>${plumber.businessName}</strong> is now active.
            ZeroMissCall will automatically reply to every missed call on
            <strong>${plumber.twilioNumber}</strong> starting right now.
          </p>

          <!-- What happens box -->
          <div style="background:#f8f9fa;border-radius:10px;padding:20px;margin:0 0 24px 0;border-left:4px solid #E8791A;">
            <p style="font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 12px 0;">
              Here's what happens when someone calls and you miss it:
            </p>
            <p style="font-size:14px;color:#444;line-height:1.8;margin:0;">
              1️⃣ &nbsp;They hear a friendly voice message<br/>
              2️⃣ &nbsp;They get a text within seconds<br/>
              3️⃣ &nbsp;Our AI handles the conversation<br/>
              4️⃣ &nbsp;You get an alert when a lead is captured<br/>
              5️⃣ &nbsp;You call them back ready to close the job
            </p>
          </div>

          <!-- Trial info -->
          <div style="background:#fff8f0;border-radius:10px;padding:20px;margin:0 0 24px 0;border-left:4px solid #E8791A;">
            <p style="font-size:14px;color:#744210;margin:0;">
              <strong>Your trial runs until ${trialEnd}.</strong>
              After that it's just $69/month — cancel anytime, no contracts.
              We'll email you the day before your trial ends with a summary of everything we captured.
            </p>
          </div>

          <!-- Dashboard CTA -->
          <div style="background:#f8f9fa;border-radius:10px;padding:20px;margin:0 0 24px 0;border-left:4px solid #3ecf8e;">
            <p style="font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 8px 0;">
              Your personal dashboard
            </p>
            <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 14px 0;">
              Bookmark this link — it's how you view your conversations, captured leads, and account settings.
            </p>
            <a href="https://missed-call-bot-production.up.railway.app/dashboard/${plumber.dashboardToken}"
              style="display:inline-block;background:#0b1928;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;word-break:break-all;">
              View My Dashboard →
            </a>
          </div>

          <!-- Setup nudge -->
          <div style="background:#f0f7ff;border-radius:10px;padding:20px;margin:0 0 24px 0;border-left:4px solid #0b1928;">
            <p style="font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;">
              ⚙️ Before you go live — takes 2 minutes
            </p>
            <p style="font-size:13px;color:#444;line-height:1.8;margin:0 0 14px 0;">
              Your AI needs a few details to give accurate answers to your customers:
            </p>
            <p style="font-size:13px;color:#444;line-height:2;margin:0;">
              📍 <strong>Service area</strong> — what city/region do you cover?<br/>
              🕐 <strong>Business hours</strong> — when are you available?<br/>
              💰 <strong>Average job value</strong> — used to calculate your revenue stats<br/>
              🔧 <strong>Services</strong> — drain, boiler, leak detection etc.
            </p>
            <a href="https://missed-call-bot-production.up.railway.app/dashboard/${plumber.dashboardToken}"
              style="display:inline-block;background:#E8791A;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:13px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:14px;">
              Update My Settings →
            </a>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin:28px 0;">
            <a href="https://zeromisscall.com" style="display:inline-block;background:#E8791A;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">
              Visit ZeroMissCall →
            </a>
          </div>

          <p style="font-size:14px;color:#6b84a0;line-height:1.6;margin:0;">
            Questions? Just reply to this email — Ian reads every one.<br/>
            <strong>Ian from ZeroMissCall</strong>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0f2035;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
          <p style="font-size:13px;color:#6b84a0;margin:0;">
            ZeroMissCall &mdash; <a href="https://zeromisscall.com" style="color:#E8791A;">zeromisscall.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from:    "Ian from ZeroMissCall <ian@zeromisscall.com>",
    to:      plumber.email,
    subject: `Welcome to ZeroMissCall — your trial is active, ${plumber.ownerName}!`,
    html,
  });
}

// ─────────────────────────────────────────────
// SANITIZE PLUMBER
// Remove sensitive fields before sending in API response
// ─────────────────────────────────────────────
function sanitizePlumber(plumber) {
  const {
    stripeCustomerId,
    stripeSubscriptionId,
    dashboardToken,
    ...safe
  } = plumber;

  return {
    ...safe,
    dashboardUrl: dashboardToken
      ? `https://missed-call-bot-production.up.railway.app/dashboard/${dashboardToken}`
      : null,
  };
}

module.exports = { registerAdminRoutes };

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Add require at top of server.js:
//   const { registerAdminRoutes } = require("./admin");
//
// STEP 2 — Register routes after MongoDB connects.
// In your MongoDB .then() block, after initScheduler, add:
//   registerAdminRoutes(app, db, db_helpers, emailService);
//
// STEP 3 — Test by creating your first plumber:
//
// Visit in browser or use a tool like Postman/Insomnia:
//
// POST https://missed-call-bot-production.up.railway.app/admin/plumbers?secret=zeromisscall123
// Content-Type: application/json
// Body:
// {
//   "twilioNumber": "+18885760762",
//   "businessName": "Dave's Plumbing Co.",
//   "ownerName": "Dave",
//   "ownerPhone": "+12145550001",
//   "email": "dave@davesplumbing.com",
//   "serviceArea": "Dallas, TX",
//   "hours": "Mon-Sat 7am-7pm",
//   "emergencyAvailable": true,
//   "averageJobValue": 300,
//   "timezone": "America/Chicago"
// }
//
// STEP 4 — View all your plumbers:
// GET /admin/plumbers?secret=zeromisscall123
//
// STEP 5 — View your business stats:
// GET /admin/stats?secret=zeromisscall123
//
// ─────────────────────────────────────────────────────────────
