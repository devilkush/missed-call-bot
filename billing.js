// ─────────────────────────────────────────────────────────────
// PHASE 9 — STRIPE BILLING
// ZeroMissCall v2
//
// HOW TO USE:
// 1. npm install stripe (add to package.json)
// 2. Save this file as billing.js in the same folder as server.js
// 3. Follow integration instructions at the bottom
//
// WHAT THIS DOES:
// Complete Stripe billing integration:
//
//   GET  /billing/create-checkout/:token  → creates Stripe checkout session
//   POST /billing/webhook                 → handles all Stripe events
//   GET  /billing/portal/:token           → opens Stripe customer portal
//
// Stripe events handled:
//   checkout.session.completed      → activate subscription
//   invoice.payment_succeeded       → log renewal
//   invoice.payment_failed          → flag account, send alert
//   customer.subscription.deleted   → cancel account, stop bot
//   customer.subscription.updated   → sync status changes
// ─────────────────────────────────────────────────────────────

const Stripe = require("stripe");

function registerBillingRoutes(app, db, db_helpers, emailService) {

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const PRICE_ID = process.env.STRIPE_PRICE_ID;
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const APP_URL = "https://missed-call-bot-production.up.railway.app";

  // ── CREATE CHECKOUT SESSION ───────────────────────────────
  // GET /billing/create-checkout/:token
  // Plumber clicks "Upgrade" → redirected here → Stripe checkout
  app.get("/billing/create-checkout/:token", async (req, res) => {
    try {
      const plumber = await db_helpers.getPlumberByToken(db, req.params.token);

      if (!plumber) {
        return res.status(404).send("Account not found.");
      }

      if (plumber.subscriptionStatus === "active") {
        return res.redirect(`${APP_URL}/dashboard/${req.params.token}?msg=already_active`);
      }

      // Create or retrieve Stripe customer
      let customerId = plumber.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email:    plumber.email,
          name:     plumber.businessName,
          phone:    plumber.ownerPhone,
          metadata: {
            twilioNumber:   plumber.twilioNumber,
            dashboardToken: plumber.dashboardToken || "",
            plumberId:      plumber._id.toString(),
          },
        });
        customerId = customer.id;

        await db.collection("plumbers").updateOne(
          { _id: plumber._id },
          { $set: { stripeCustomerId: customerId, updatedAt: new Date() } }
        );
      }

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        customer:             customerId,
        payment_method_types: ["card"],
        mode:                 "subscription",
        line_items: [{
          price:    PRICE_ID,
          quantity: 1,
        }],
        success_url: `${APP_URL}/billing/success/${req.params.token}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${APP_URL}/dashboard/${req.params.token}?msg=checkout_cancelled`,
        metadata: {
          twilioNumber:   plumber.twilioNumber,
          dashboardToken: req.params.token,
        },
        subscription_data: {
          metadata: {
            twilioNumber: plumber.twilioNumber,
            businessName: plumber.businessName,
          },
          trial_end: plumber.trialEndDate
            ? Math.floor(new Date(plumber.trialEndDate).getTime() / 1000)
            : undefined,
        },
        allow_promotion_codes: true,
        billing_address_collection: "auto",
      });

      console.log(`💳 Checkout session created for ${plumber.businessName}: ${session.id}`);
      res.redirect(session.url);

    } catch (err) {
      console.error("❌ Checkout error:", err.message);
      res.status(500).send("Something went wrong creating the checkout. Please try again or contact hello@zeromisscall.com");
    }
  });

  // ── CHECKOUT SUCCESS PAGE ─────────────────────────────────
  // GET /billing/success/:token
  app.get("/billing/success/:token", async (req, res) => {
    try {
      const plumber = await db_helpers.getPlumberByToken(db, req.params.token);
      const businessName = plumber ? plumber.businessName : "your business";

      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to ZeroMissCall!</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <meta http-equiv="refresh" content="5;url=${APP_URL}/dashboard/${req.params.token}">
</head>
<body style="background:#0b1928;color:white;font-family:'DM Sans',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;">
  <div>
    <div style="font-size:64px;margin-bottom:20px;">🎉</div>
    <h1 style="font-family:'Nunito',sans-serif;font-size:32px;font-weight:900;letter-spacing:-1px;margin-bottom:12px;">
      You're all set, ${businessName}!
    </h1>
    <p style="color:#6b84a0;font-size:16px;margin-bottom:32px;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.6;">
      ZeroMissCall is now active. Every missed call will be handled automatically from this moment on.
    </p>
    <div style="background:linear-gradient(135deg,rgba(232,121,26,0.1),rgba(15,32,53,0.6));border:1px solid rgba(232,121,26,0.22);border-radius:14px;padding:20px 28px;display:inline-block;margin-bottom:28px;">
      <div style="font-size:13px;color:#6b84a0;margin-bottom:4px;">Monthly subscription</div>
      <div style="font-family:'Nunito',sans-serif;font-size:28px;font-weight:900;color:#E8791A;">$69 / month</div>
      <div style="font-size:12px;color:#6b84a0;margin-top:4px;">Cancel anytime · No contracts</div>
    </div>
    <br/>
    <a href="${APP_URL}/dashboard/${req.params.token}" style="display:inline-block;background:#E8791A;color:#fff;font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;padding:14px 36px;border-radius:8px;text-decoration:none;">
      Go to Dashboard →
    </a>
    <p style="font-size:12px;color:#6b84a0;margin-top:16px;">Redirecting automatically in 5 seconds...</p>
  </div>
</body>
</html>`);
    } catch (err) {
      res.redirect(`${APP_URL}/dashboard/${req.params.token}`);
    }
  });

  // ── CUSTOMER PORTAL ───────────────────────────────────────
  // GET /billing/portal/:token
  // Plumber can manage/cancel subscription
  app.get("/billing/portal/:token", async (req, res) => {
    try {
      const plumber = await db_helpers.getPlumberByToken(db, req.params.token);

      if (!plumber || !plumber.stripeCustomerId) {
        return res.redirect(`${APP_URL}/dashboard/${req.params.token}?msg=no_subscription`);
      }

      const session = await stripe.billingPortal.sessions.create({
        customer:   plumber.stripeCustomerId,
        return_url: `${APP_URL}/dashboard/${req.params.token}`,
      });

      res.redirect(session.url);
    } catch (err) {
      console.error("❌ Portal error:", err.message);
      res.status(500).send("Could not open billing portal. Please contact hello@zeromisscall.com");
    }
  });

  // ── STRIPE WEBHOOK ────────────────────────────────────────
  // POST /billing/webhook
  // Must use raw body — registered BEFORE express.json() middleware
  app.post(
    "/billing/webhook",
    require("express").raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
      } catch (err) {
        console.error("❌ Webhook signature failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`⚡ Stripe event: ${event.type}`);

      try {
        switch (event.type) {

          // ── Payment succeeded → activate subscription ──────
          case "checkout.session.completed": {
            const session = event.data.object;
            // Look the plumber up by a UNIQUE key, never by the (possibly shared)
            // phone number. dashboardToken is unique per account; fall back to the
            // Stripe customer id which is also unique.
            let plumber = null;
            const token = session.metadata?.dashboardToken;
            if (token) plumber = await db_helpers.getPlumberByToken(db, token);
            if (!plumber && session.customer) {
              plumber = await db.collection("plumbers").findOne({ stripeCustomerId: session.customer });
            }
            if (!plumber) {
              console.warn("⚠️ checkout.session.completed: could not match a plumber");
              break;
            }

            await db.collection("plumbers").updateOne(
              { _id: plumber._id },
              { $set: {
                  subscriptionStatus:   "active",
                  stripeCustomerId:     session.customer,
                  stripeSubscriptionId: session.subscription,
                  active:               true,
                  updatedAt:            new Date(),
                } }
            );

            console.log(`✅ Subscription activated: ${plumber.businessName} (${plumber.twilioNumber})`);

            if (plumber.email) {
              await sendActivationEmail(plumber, stripe);
            }
            break;
          }

          // ── Invoice paid → log renewal ─────────────────────
          case "invoice.payment_succeeded": {
            const invoice = event.data.object;
            if (invoice.billing_reason === "subscription_cycle") {
              // Find plumber by Stripe customer ID
              const plumber = await db.collection("plumbers").findOne({
                stripeCustomerId: invoice.customer,
              });
              if (plumber) {
                await db.collection("plumbers").updateOne(
                  { _id: plumber._id },
                  { $set: { subscriptionStatus: "active", active: true, updatedAt: new Date() } }
                );
                console.log(`✅ Renewal logged: ${plumber.businessName}`);
              }
            }
            break;
          }

          // ── Invoice payment failed → flag account ──────────
          case "invoice.payment_failed": {
        // Send payment failed email
        try {
          const failedCustomerId = event.data.object.customer;
          const failedPlumber = await db.collection("plumbers").findOne({ stripeCustomerId: failedCustomerId });
          if (failedPlumber) {
            await emailService2.sendPaymentFailedEmail(failedPlumber);
          }
        } catch (e) {
          console.error("Payment failed email error:", e.message);
        }
            const invoice = event.data.object;
            const plumber = await db.collection("plumbers").findOne({
              stripeCustomerId: invoice.customer,
            });
            if (plumber) {
              console.warn(`⚠️  Payment failed: ${plumber.businessName} (${plumber.email})`);
              await sendPaymentFailedEmail(plumber, stripe, emailService);
            }
            break;
          }

          // ── Subscription cancelled → deactivate ───────────
          case "customer.subscription.deleted": {
        // Schedule win-back email after 3 days using setTimeout
        try {
          const deletedCustomerId = event.data.object.customer;
          const deletedPlumber = await db.collection("plumbers").findOne({ stripeCustomerId: deletedCustomerId });
          if (deletedPlumber) {
            setTimeout(async function() {
              try {
                const now = new Date();
                const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
                const stats = await db_helpers.getStats(db, deletedPlumber.twilioNumber, thirtyDaysAgo, now);
                const avgJob = deletedPlumber.averageJobValue || 250;
                const enriched = Object.assign({}, stats, {
                  estimatedRevenue: ((stats.leadsCaptures || 0) * avgJob).toLocaleString()
                });
                await emailService2.sendWinBackEmail(deletedPlumber, enriched);
              } catch (e) {
                console.error("Win-back email error:", e.message);
              }
            }, 3 * 24 * 60 * 60 * 1000); // 3 days
          }
        } catch (e) {
          console.error("Win-back schedule error:", e.message);
        }
            const sub = event.data.object;
            const plumber = await db.collection("plumbers").findOne({
              stripeCustomerId: sub.customer,
            });
            if (plumber) {
              await db.collection("plumbers").updateOne(
                { _id: plumber._id },
                { $set: {
                    subscriptionStatus:   "cancelled",
                    active:               false,
                    stripeSubscriptionId: null,
                    updatedAt:            new Date(),
                  } }
              );
              console.log(`🔴 Subscription cancelled: ${plumber.businessName}`);
            }
            break;
          }

          // ── Subscription updated → sync status ────────────
          case "customer.subscription.updated": {
            const sub = event.data.object;
            const plumber = await db.collection("plumbers").findOne({
              stripeCustomerId: sub.customer,
            });
            if (plumber) {
              const statusMap = {
                active:   "active",
                past_due: "active",  // keep bot running during grace period
                canceled: "cancelled",
                unpaid:   "expired",
              };
              const newStatus = statusMap[sub.status] || plumber.subscriptionStatus;
              await db.collection("plumbers").updateOne(
                { _id: plumber._id },
                { $set: { subscriptionStatus: newStatus, updatedAt: new Date() } }
              );
              console.log(`🔄 Subscription updated: ${plumber.businessName} → ${newStatus}`);
            }
            break;
          }

          default:
            console.log(`⚡ Unhandled event type: ${event.type}`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${event.type}:`, err.message);
      }

      res.json({ received: true });
    }
  );

  console.log("✅ Billing routes registered");
}

// ─────────────────────────────────────────────
// ACTIVATION EMAIL
// Sends when payment completes successfully
// ─────────────────────────────────────────────
async function sendActivationEmail(plumber, stripe) {
  if (!process.env.RESEND_API_KEY) return;
  const { Resend } = require("resend");
const emailService2 = require("./email2");
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from:    "Ian from ZeroMissCall <ian@zeromisscall.com>",
    to:      plumber.email,
    subject: `Payment confirmed — ZeroMissCall is active for ${plumber.businessName}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="background:#0b1928;margin:0;padding:0;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1928;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:12px 12px 0 0;padding:24px 36px;text-align:center;border-bottom:3px solid #E8791A;">
  <img src="https://zeromisscall.com/zeromisscall.png" alt="ZeroMissCall" width="200" style="display:block;margin:0 auto;"/>
</td></tr>
<tr><td style="background:#ffffff;padding:36px;">
  <h1 style="font-family:'Nunito',Arial,sans-serif;font-size:24px;font-weight:900;color:#0b1928;margin:0 0 16px 0;">
    Payment confirmed — you're all set! 🎉
  </h1>
  <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px 0;">
    Hey ${plumber.ownerName}, your ZeroMissCall subscription for <strong>${plumber.businessName}</strong> is now active.
    Every missed call will be handled automatically from this moment on.
  </p>
  <div style="background:#f8f9fa;border-radius:10px;padding:20px;margin:0 0 24px 0;border-left:4px solid #3ecf8e;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-size:14px;color:#444;padding:4px 0;">Monthly subscription</td><td style="text-align:right;font-family:'Nunito',Arial,sans-serif;font-weight:800;color:#0b1928;font-size:14px;">$69.00</td></tr>
      <tr><td style="font-size:14px;color:#444;padding:4px 0;">Your number</td><td style="text-align:right;font-size:14px;color:#0b1928;font-weight:600;">${plumber.twilioNumber}</td></tr>
      <tr><td style="font-size:14px;color:#444;padding:4px 0;">Status</td><td style="text-align:right;"><span style="background:#c6f6d5;color:#276749;padding:2px 10px;border-radius:100px;font-size:12px;font-weight:700;">Active</span></td></tr>
    </table>
  </div>
  <div style="text-align:center;margin:0 0 20px 0;">
    <a href="https://missed-call-bot-production.up.railway.app/dashboard/${plumber.dashboardToken}" style="display:inline-block;background:#E8791A;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;padding:14px 32px;border-radius:8px;text-decoration:none;">
      View Your Dashboard →
    </a>
  </div>
  <p style="font-size:13px;color:#6b84a0;line-height:1.6;margin:0;">
    Questions? Just reply to this email.<br/><strong>Ian from ZeroMissCall</strong>
  </p>
</td></tr>
<tr><td style="background:#0f2035;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
  <p style="font-size:12px;color:#6b84a0;margin:0;">ZeroMissCall &mdash; <a href="https://zeromisscall.com" style="color:#E8791A;">zeromisscall.com</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`,
  });
}

// ─────────────────────────────────────────────
// PAYMENT FAILED EMAIL
// ─────────────────────────────────────────────
async function sendPaymentFailedEmail(plumber) {
  if (!process.env.RESEND_API_KEY || !plumber.email) return;
  const { Resend } = require("resend");
const emailService2 = require("./email2");
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from:    "Ian from ZeroMissCall <ian@zeromisscall.com>",
    to:      plumber.email,
    subject: `Action needed — payment failed for ${plumber.businessName}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="background:#0b1928;margin:0;padding:0;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1928;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:12px 12px 0 0;padding:24px 36px;text-align:center;border-bottom:3px solid #E8791A;">
  <img src="https://zeromisscall.com/zeromisscall.png" alt="ZeroMissCall" width="200" style="display:block;margin:0 auto;"/>
</td></tr>
<tr><td style="background:#ffffff;padding:36px;">
  <h1 style="font-family:'Nunito',Arial,sans-serif;font-size:22px;font-weight:900;color:#0b1928;margin:0 0 16px 0;">
    Payment failed for ${plumber.businessName}
  </h1>
  <div style="background:#fff5f5;border-radius:10px;padding:16px 20px;border-left:4px solid #f05252;margin:0 0 24px 0;">
    <p style="font-size:14px;color:#742a2a;margin:0;line-height:1.6;">
      We couldn't process your monthly payment of $69.00. Your ZeroMissCall service is still running — 
      but please update your payment method within the next few days to avoid any interruption.
    </p>
  </div>
  <div style="text-align:center;margin:0 0 20px 0;">
    <a href="https://missed-call-bot-production.up.railway.app/billing/portal/${plumber.dashboardToken}" style="display:inline-block;background:#E8791A;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;padding:14px 32px;border-radius:8px;text-decoration:none;">
      Update Payment Method →
    </a>
  </div>
  <p style="font-size:13px;color:#6b84a0;line-height:1.6;margin:0;">
    Need help? Reply to this email and I'll sort it out.<br/><strong>Ian from ZeroMissCall</strong>
  </p>
</td></tr>
<tr><td style="background:#0f2035;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;">
  <p style="font-size:12px;color:#6b84a0;margin:0;">ZeroMissCall &mdash; <a href="https://zeromisscall.com" style="color:#E8791A;">zeromisscall.com</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`,
  });
}

module.exports = { registerBillingRoutes };

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Add stripe to package.json dependencies:
//   "stripe": "^14.0.0"
//
// STEP 2 — Add require at top of server.js:
//   const { registerBillingRoutes } = require("./billing");
//
// STEP 3 — IMPORTANT: The webhook route needs raw body parsing.
// Register billing routes BEFORE the express.json() middleware.
// In server.js, move registerBillingRoutes call to BEFORE:
//   app.use(express.json());
//
// Actually the easiest approach: the webhook handler in billing.js
// uses its own express.raw() middleware inline so it works fine
// even after express.json() is set up. Just add to MongoDB block:
//   registerBillingRoutes(app, db, db_helpers, emailService);
//
// STEP 4 — Add Railway environment variables:
//   STRIPE_SECRET_KEY=sk_test_...
//   STRIPE_PUBLISHABLE_KEY=pk_test_...
//   STRIPE_PRICE_ID=price_1TdwkiJ2MMR1ur5B0tGimhO3
//   STRIPE_WEBHOOK_SECRET=whsec_...
//
// STEP 5 — Update dashboard.js Upgrade button URL from:
//   https://zeromisscall.com/pricing
// To:
//   https://missed-call-bot-production.up.railway.app/billing/create-checkout/DASHBOARD_TOKEN
//
// STEP 6 — Test in Stripe test mode:
//   Use card number: 4242 4242 4242 4242
//   Any future expiry date, any CVC
//   This simulates a successful payment
//
// STEP 7 — Test payment failure:
//   Use card number: 4000 0000 0000 0341
//   This simulates a card decline
// ─────────────────────────────────────────────────────────────
