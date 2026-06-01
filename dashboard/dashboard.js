// ─────────────────────────────────────────────────────────────
// PHASE 7 — PLUMBER DASHBOARD
// ZeroMissCall v2
//
// HOW TO USE:
// 1. Save this file as dashboard.js in the same folder as server.js
// 2. Follow integration instructions at the bottom
//
// WHAT THIS DOES:
// A read-only web dashboard for each plumber accessed via
// their unique token URL:
//
//   GET /dashboard/:token
//
// Shows:
//   - Monthly stats (calls, leads, emergencies, est. revenue)
//   - Last 20 conversations in reverse chronological order
//   - Each conversation expandable to show full SMS thread
//   - Emergency conversations flagged in red
//   - Lead captured conversations flagged in green
//   - Call back link next to each conversation
//   - Mobile-first design matching ZeroMissCall brand
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// DASHBOARD HTML GENERATOR
// ─────────────────────────────────────────────
function buildDashboardHtml(plumber, stats, conversations) {
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const conversationCards = conversations.map((convo, index) => {
    const isEmergency  = convo.emergency;
    const isLead       = convo.leadCaptured;
    const msgCount     = convo.messages ? convo.messages.length : 0;
    const lastMsg      = convo.messages && convo.messages.length > 0
      ? convo.messages[convo.messages.length - 1]
      : null;
    const date         = new Date(convo.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const statusBadge = isEmergency
      ? `<span style="background:#fed7d7;color:#c53030;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">🚨 EMERGENCY</span>`
      : isLead
      ? `<span style="background:#c6f6d5;color:#276749;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">✓ LEAD CAPTURED</span>`
      : `<span style="background:#e9ecef;color:#666;padding:3px 10px;border-radius:20px;font-size:11px;">In Progress</span>`;

    const messages = convo.messages ? convo.messages.map(m => `
      <div style="margin-bottom:8px;text-align:${m.role === "user" ? "left" : "right"};">
        <span style="display:inline-block;background:${m.role === "user" ? "#f0f0f0" : "#E8791A"};color:${m.role === "user" ? "#333" : "#fff"};padding:8px 12px;border-radius:12px;font-size:13px;max-width:80%;line-height:1.4;text-align:left;">
          ${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </span>
        <div style="font-size:10px;color:#999;margin-top:2px;">
          ${m.role === "user" ? "Customer" : "ZeroMissCall AI"}
        </div>
      </div>
    `).join("") : "<p style='color:#999;font-size:13px;'>No messages</p>";

    return `
      <div style="background:white;border-radius:10px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid ${isEmergency ? "#fed7d7" : isLead ? "#c6f6d5" : "#eee"};">

        <!-- Conversation header -->
        <div onclick="toggleConvo(${index})" style="padding:16px 20px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-weight:700;color:#0b1928;font-size:15px;margin-bottom:4px;">
              <a href="tel:${convo.callerNumber}" style="color:#0b1928;text-decoration:none;">
                ${convo.callerNumber}
              </a>
            </div>
            <div style="font-size:12px;color:#6b84a0;">${date} &middot; ${msgCount} messages</div>
            ${convo.jobDescription ? `<div style="font-size:12px;color:#444;margin-top:4px;">📋 ${convo.jobDescription}</div>` : ""}
            ${convo.callerZip ? `<div style="font-size:12px;color:#444;">📍 Zip: ${convo.callerZip}</div>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${statusBadge}
            <a href="tel:${convo.callerNumber}" style="background:#E8791A;color:white;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none;" onclick="event.stopPropagation()">
              📞 Call Back
            </a>
            <span id="arrow-${index}" style="color:#6b84a0;font-size:12px;">▼</span>
          </div>
        </div>

        <!-- Conversation thread (hidden by default) -->
        <div id="convo-${index}" style="display:none;padding:0 20px 16px;border-top:1px solid #eee;">
          <div style="padding-top:16px;">
            ${messages}
          </div>
        </div>

      </div>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${plumber.businessName} — ZeroMissCall Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b1928; font-family: 'DM Sans', Arial, sans-serif; min-height: 100vh; }
    .container { max-width: 720px; margin: 0 auto; padding: 0 16px 40px; }
    @media (max-width: 600px) {
      .stats-grid { grid-template-columns: 1fr 1fr !important; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0b1928,#0f2035);border-bottom:3px solid #E8791A;padding:16px;text-align:center;margin-bottom:24px;">
    <img src="https://zeromisscall.com/zeromisscall.png" alt="ZeroMissCall" style="height:36px;display:block;margin:0 auto 8px;" />
    <div style="font-family:'Nunito',sans-serif;font-size:16px;font-weight:700;color:white;">${plumber.businessName}</div>
    <div style="font-size:12px;color:#6b84a0;margin-top:2px;">${monthName} Dashboard</div>
  </div>

  <div class="container">

    <!-- Stats grid -->
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;">

      <div style="background:linear-gradient(135deg,#0f2035,#1a3550);border-radius:10px;padding:16px;text-align:center;border:1px solid #1a3550;">
        <div style="font-family:'Nunito',sans-serif;font-size:28px;font-weight:800;color:#E8791A;">${stats.totalConversations || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Calls<br/>Handled</div>
      </div>

      <div style="background:linear-gradient(135deg,#0f2035,#1a3550);border-radius:10px;padding:16px;text-align:center;border:1px solid #1a3550;">
        <div style="font-family:'Nunito',sans-serif;font-size:28px;font-weight:800;color:#3ecf8e;">${stats.leadsCaptures || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Leads<br/>Captured</div>
      </div>

      <div style="background:linear-gradient(135deg,#0f2035,#1a3550);border-radius:10px;padding:16px;text-align:center;border:1px solid #1a3550;">
        <div style="font-family:'Nunito',sans-serif;font-size:28px;font-weight:800;color:#3ecf8e;">$${stats.estimatedRevenue || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Est. Revenue<br/>Recovered</div>
      </div>

      <div style="background:linear-gradient(135deg,#0f2035,#1a3550);border-radius:10px;padding:16px;text-align:center;border:1px solid ${stats.emergencies > 0 ? "#742a2a" : "#1a3550"};">
        <div style="font-family:'Nunito',sans-serif;font-size:28px;font-weight:800;color:${stats.emergencies > 0 ? "#fc8181" : "#6b84a0"};">${stats.emergencies || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Emergency<br/>Alerts</div>
      </div>

    </div>

    <!-- Trial / subscription status -->
    ${plumber.subscriptionStatus === "trial" ? `
    <div style="background:#fffbf0;border:1px solid #f6d860;border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:#744210;">
      <strong>Trial Active</strong> — Your free trial ends on
      ${new Date(plumber.trialEndDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.
      <a href="https://zeromisscall.com/pricing" style="color:#E8791A;font-weight:700;margin-left:8px;">Upgrade →</a>
    </div>` : ""}

    <!-- Conversations header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h2 style="font-family:'Nunito',sans-serif;font-size:18px;font-weight:800;color:white;">Recent Conversations</h2>
      <span style="font-size:12px;color:#6b84a0;">${conversations.length} shown</span>
    </div>

    <!-- Legend -->
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <span style="font-size:11px;color:#6b84a0;">
        <span style="background:#c6f6d5;color:#276749;padding:2px 8px;border-radius:10px;">✓ LEAD</span> = all 3 details captured
      </span>
      <span style="font-size:11px;color:#6b84a0;">
        <span style="background:#fed7d7;color:#c53030;padding:2px 8px;border-radius:10px;">🚨 EMERGENCY</span> = urgent call
      </span>
    </div>

    <!-- Conversation cards -->
    ${conversations.length > 0 ? conversationCards : `
      <div style="background:#0f2035;border-radius:10px;padding:40px;text-align:center;">
        <div style="font-size:32px;margin-bottom:12px;">📱</div>
        <div style="font-family:'Nunito',sans-serif;font-size:16px;font-weight:700;color:white;margin-bottom:8px;">No conversations yet</div>
        <div style="font-size:13px;color:#6b84a0;">Conversations will appear here when customers text back after a missed call.</div>
      </div>
    `}

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;">
      <div style="font-size:12px;color:#6b84a0;line-height:1.6;">
        Dashboard refreshes when you reload this page.<br/>
        Questions? Email <a href="mailto:hello@zeromisscall.com" style="color:#E8791A;">hello@zeromisscall.com</a>
      </div>
    </div>

  </div>

  <script>
    function toggleConvo(index) {
      const el = document.getElementById('convo-' + index);
      const arrow = document.getElementById('arrow-' + index);
      if (el.style.display === 'none') {
        el.style.display = 'block';
        arrow.textContent = '▲';
      } else {
        el.style.display = 'none';
        arrow.textContent = '▼';
      }
    }
  </script>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// REGISTER DASHBOARD ROUTE
// ─────────────────────────────────────────────
function registerDashboardRoute(app, db, db_helpers) {

  app.get("/dashboard/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Find plumber by dashboard token
      const plumber = await db_helpers.getPlumberByToken(db, token);

      if (!plumber) {
        return res.status(404).send(`
          <html><body style="background:#0b1928;color:white;font-family:Arial;text-align:center;padding:60px;">
            <h2>Dashboard not found</h2>
            <p style="color:#6b84a0;">This link may have expired or is invalid.</p>
            <p><a href="https://zeromisscall.com" style="color:#E8791A;">zeromisscall.com</a></p>
          </body></html>
        `);
      }

      // Get this month's stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats = await db_helpers.getStats(
        db,
        plumber.twilioNumber,
        startOfMonth,
        now
      );

      // Calculate estimated revenue
      const avgJobValue = plumber.averageJobValue || 250;
      const estimatedRevenue = (stats.leadsCaptures * avgJobValue).toLocaleString();

      const enrichedStats = {
        ...stats,
        estimatedRevenue,
      };

      // Get recent conversations
      const conversations = await db_helpers.getRecentConversations(
        db,
        plumber.twilioNumber,
        20
      );

      const html = buildDashboardHtml(plumber, enrichedStats, conversations);

      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(html);

    } catch (err) {
      console.error("❌ Dashboard error:", err.message);
      res.status(500).send(`
        <html><body style="background:#0b1928;color:white;font-family:Arial;text-align:center;padding:60px;">
          <h2>Something went wrong</h2>
          <p style="color:#6b84a0;">Please try refreshing the page.</p>
        </body></html>
      `);
    }
  });

}

module.exports = { registerDashboardRoute };

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Add require at top of server.js:
//   const { registerDashboardRoute } = require("./dashboard");
//
// STEP 2 — Register route after MongoDB connects.
// In your MongoDB .then() block, add after registerAdminRoutes:
//   registerDashboardRoute(app, db, db_helpers);
//
// STEP 3 — Get a plumber's dashboard URL:
// Visit: GET /admin/plumbers?secret=YOUR_SECRET
// Find the plumber and copy their dashboardUrl field
//
// It will look like:
// https://missed-call-bot-production.up.railway.app/dashboard/abc123xyz
//
// STEP 4 — Send the dashboard URL to your plumber client
// They can bookmark it and check it anytime on their phone
// No login required — the token is the authentication
// ─────────────────────────────────────────────────────────────
