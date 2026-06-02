// ─────────────────────────────────────────────────────────────
// PHASE 7 — PLUMBER DASHBOARD (v2 — matches zeromisscall.com)
// ─────────────────────────────────────────────────────────────

function buildDashboardHtml(plumber, stats, conversations) {
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const conversationCards = conversations.map((convo, index) => {
    const isEmergency = convo.emergency;
    const isLead      = convo.leadCaptured;
    const msgCount    = convo.messages ? convo.messages.length : 0;
    const date        = new Date(convo.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const statusBadge = isEmergency
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(240,82,82,0.12);border:1px solid rgba(240,82,82,0.3);color:#f05252;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:0.3px;">🚨 EMERGENCY</span>`
      : isLead
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.3);color:#3ecf8e;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:0.3px;">✓ LEAD CAPTURED</span>`
      : `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#6b84a0;padding:3px 10px;border-radius:100px;font-size:11px;">In Progress</span>`;

    const messages = convo.messages ? convo.messages.map(m => `
      <div style="margin-bottom:10px;text-align:${m.role === "user" ? "left" : "right"};">
        <div style="display:inline-block;background:${m.role === "user" ? "rgba(255,255,255,0.075)" : "rgba(232,121,26,0.15)"};border:1px solid ${m.role === "user" ? "rgba(255,255,255,0.07)" : "rgba(232,121,26,0.25)"};color:${m.role === "user" ? "#fff" : "#f5c898"};padding:10px 14px;border-radius:${m.role === "user" ? "16px 16px 16px 4px" : "16px 16px 4px 16px"};font-size:13px;max-width:82%;line-height:1.5;text-align:left;">
          ${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>
        <div style="font-size:10px;color:#6b84a0;margin-top:3px;padding:0 4px;">
          ${m.role === "user" ? "Customer" : "⚡ ZeroMissCall AI"}
        </div>
      </div>
    `).join("") : `<p style="color:#6b84a0;font-size:13px;padding:12px 0;">No messages recorded.</p>`;

    const borderColor = isEmergency ? "rgba(240,82,82,0.3)" : isLead ? "rgba(62,207,142,0.25)" : "rgba(255,255,255,0.07)";

    return `
      <div style="background:rgba(255,255,255,0.038);border:1px solid ${borderColor};border-radius:16px;margin-bottom:10px;overflow:hidden;transition:border-color 0.2s;">
        <div onclick="toggleConvo(${index})" style="padding:16px 20px;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Nunito',sans-serif;font-weight:800;color:#fff;font-size:15px;margin-bottom:4px;">
              ${convo.callerNumber}
            </div>
            <div style="font-size:12px;color:#6b84a0;margin-bottom:6px;">${date} &middot; ${msgCount} messages</div>
            ${convo.jobDescription ? `<div style="font-size:12px;color:#96aec6;">📋 ${convo.jobDescription}</div>` : ""}
            ${convo.callerZip ? `<div style="font-size:12px;color:#96aec6;">📍 Zip: ${convo.callerZip}</div>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
            ${statusBadge}
            <div style="display:flex;gap:6px;align-items:center;">
              <a href="tel:${convo.callerNumber}" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;background:#E8791A;color:#fff;padding:6px 14px;border-radius:8px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;text-decoration:none;">
                📞 Call Back
              </a>
              <span id="arrow-${index}" style="color:#6b84a0;font-size:11px;margin-left:4px;">▼</span>
            </div>
          </div>
        </div>
        <div id="convo-${index}" style="display:none;padding:0 20px 16px;border-top:1px solid rgba(255,255,255,0.07);">
          <div style="padding-top:14px;">
            ${messages}
          </div>
        </div>
      </div>
    `;
  }).join("");

  const trialBanner = plumber.subscriptionStatus === "trial" ? `
    <div style="background:linear-gradient(135deg,rgba(232,121,26,0.08),rgba(15,32,53,0.6));border:1px solid rgba(232,121,26,0.22);border-radius:14px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#f08e32;margin-bottom:2px;">Free Trial Active</div>
        <div style="font-size:12px;color:#6b84a0;">
          Ends ${plumber.trialEndDate ? new Date(plumber.trialEndDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon"}
        </div>
      </div>
      <a href="https://zeromisscall.com/pricing" style="display:inline-flex;align-items:center;gap:6px;background:#E8791A;color:#fff;padding:9px 20px;border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;text-decoration:none;">
        Upgrade — $69/mo →
      </a>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${plumber.businessName} — ZeroMissCall</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    :root{--navy:#0b1928;--navy-mid:#0f2035;--orange:#E8791A;--orange-lt:#f08e32;--green:#3ecf8e;--muted:#6b84a0;--border:rgba(255,255,255,0.07);}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'DM Sans',sans-serif;background:var(--navy);color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased;}
    body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)'/%3E%3C/svg%3E");opacity:0.025;}
    .wrap{max-width:720px;margin:0 auto;padding:0 16px 60px;position:relative;z-index:1;}
    @media(max-width:580px){.stats-grid{grid-template-columns:1fr 1fr!important;}}
    @media(max-width:400px){.stats-grid{grid-template-columns:1fr 1fr!important;}}
  </style>
</head>
<body>

  <!-- NAV -->
  <div style="position:sticky;top:0;z-index:100;background:rgba(11,25,40,0.92);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid var(--border);padding:0 20px;">
    <div style="max-width:720px;margin:0 auto;height:60px;display:flex;align-items:center;justify-content:space-between;">
      <img src="https://zeromisscall.com/zeromisscall.png" alt="ZeroMissCall" style="height:28px;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
      <span style="display:none;font-family:'Nunito',sans-serif;font-weight:900;font-size:18px;color:#E8791A;">ZeroMissCall</span>
      <div style="font-size:13px;color:#6b84a0;">${plumber.businessName}</div>
    </div>
  </div>

  <!-- HERO STRIP -->
  <div style="background:linear-gradient(135deg,rgba(232,121,26,0.06) 0%,rgba(15,32,53,0.4) 100%);border-bottom:1px solid rgba(232,121,26,0.15);padding:28px 20px 24px;">
    <div style="max-width:720px;margin:0 auto;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(232,121,26,0.1);border:1px solid rgba(232,121,26,0.22);color:#f08e32;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">
        <span style="width:6px;height:6px;background:#E8791A;border-radius:50%;display:inline-block;"></span>
        ${monthName} Dashboard
      </div>
      <h1 style="font-family:'Nunito',sans-serif;font-size:clamp(22px,5vw,30px);font-weight:900;letter-spacing:-1px;line-height:1.1;margin-bottom:4px;">
        ${plumber.businessName}
      </h1>
      <p style="font-size:13px;color:#6b84a0;">Here's how ZeroMissCall is performing for you this month.</p>
    </div>
  </div>

  <div class="wrap" style="padding-top:24px;">

    <!-- STATS GRID -->
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">

      <div style="background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:18px 14px;text-align:center;">
        <div style="font-family:'Nunito',sans-serif;font-size:32px;font-weight:900;color:#E8791A;letter-spacing:-1.5px;line-height:1;">${stats.totalConversations || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:5px;line-height:1.4;font-weight:500;">Calls<br/>Handled</div>
      </div>

      <div style="background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:18px 14px;text-align:center;">
        <div style="font-family:'Nunito',sans-serif;font-size:32px;font-weight:900;color:#3ecf8e;letter-spacing:-1.5px;line-height:1;">${stats.leadsCaptures || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:5px;line-height:1.4;font-weight:500;">Leads<br/>Captured</div>
      </div>

      <div style="background:linear-gradient(135deg,rgba(232,121,26,0.08),rgba(15,32,53,0.4));border:1px solid rgba(232,121,26,0.22);border-radius:16px;padding:18px 14px;text-align:center;">
        <div style="font-family:'Nunito',sans-serif;font-size:32px;font-weight:900;color:#fff;letter-spacing:-1.5px;line-height:1;">$${stats.estimatedRevenue || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:5px;line-height:1.4;font-weight:500;">Est. Revenue<br/>Recovered</div>
      </div>

      <div style="background:rgba(255,255,255,0.038);border:1px solid ${(stats.emergencies || 0) > 0 ? "rgba(240,82,82,0.3)" : "rgba(255,255,255,0.07)"};border-radius:16px;padding:18px 14px;text-align:center;">
        <div style="font-family:'Nunito',sans-serif;font-size:32px;font-weight:900;color:${(stats.emergencies || 0) > 0 ? "#f05252" : "#6b84a0"};letter-spacing:-1.5px;line-height:1;">${stats.emergencies || 0}</div>
        <div style="font-size:11px;color:#6b84a0;margin-top:5px;line-height:1.4;font-weight:500;">Emergency<br/>Alerts</div>
      </div>

    </div>

    <!-- TRIAL BANNER -->
    ${trialBanner}

    <!-- CONVERSATIONS HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <h2 style="font-family:'Nunito',sans-serif;font-size:18px;font-weight:900;letter-spacing:-0.5px;margin-bottom:2px;">Recent Conversations</h2>
        <p style="font-size:12px;color:#6b84a0;">Tap any conversation to see the full thread</p>
      </div>
      <span style="font-size:12px;color:#6b84a0;background:rgba(255,255,255,0.05);border:1px solid var(--border);padding:4px 10px;border-radius:100px;">${conversations.length} shown</span>
    </div>

    <!-- LEGEND -->
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <span style="font-size:11px;color:#6b84a0;display:flex;align-items:center;gap:5px;">
        <span style="background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.3);color:#3ecf8e;padding:2px 8px;border-radius:100px;font-weight:700;">✓ LEAD</span> all 3 details collected
      </span>
      <span style="font-size:11px;color:#6b84a0;display:flex;align-items:center;gap:5px;">
        <span style="background:rgba(240,82,82,0.12);border:1px solid rgba(240,82,82,0.3);color:#f05252;padding:2px 8px;border-radius:100px;font-weight:700;">🚨 EMERGENCY</span> urgent alert sent
      </span>
    </div>

    <!-- CONVERSATION CARDS -->
    ${conversations.length > 0 ? conversationCards : `
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:48px 24px;text-align:center;">
        <div style="font-size:36px;margin-bottom:14px;">📱</div>
        <div style="font-family:'Nunito',sans-serif;font-size:17px;font-weight:800;margin-bottom:8px;">No conversations yet</div>
        <div style="font-size:13px;color:#6b84a0;max-width:280px;margin:0 auto;line-height:1.6;">
          When customers text back after a missed call, their conversations will appear here.
        </div>
      </div>
    `}

    <!-- FOOTER -->
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
      <div style="font-size:12px;color:#6b84a0;line-height:1.8;">
        Reload this page to see the latest conversations.<br/>
        Questions? <a href="mailto:hello@zeromisscall.com" style="color:#E8791A;text-decoration:none;">hello@zeromisscall.com</a>
      </div>
      <div style="margin-top:12px;">
        <img src="https://zeromisscall.com/zeromisscall.png" alt="ZeroMissCall" style="height:20px;opacity:0.4;" onerror="this.style.display='none'"/>
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

function registerDashboardRoute(app, db, db_helpers) {
  app.get("/dashboard/:token", async (req, res) => {
    try {
      const plumber = await db_helpers.getPlumberByToken(db, req.params.token);

      if (!plumber) {
        return res.status(404).send(`<!DOCTYPE html><html><body style="background:#0b1928;color:white;font-family:'DM Sans',Arial,sans-serif;text-align:center;padding:80px 20px;">
          <img src="https://zeromisscall.com/zeromisscall.png" style="height:32px;margin-bottom:24px;display:block;margin-left:auto;margin-right:auto;" onerror="this.style.display='none'"/>
          <h2 style="font-family:'Nunito',sans-serif;font-weight:900;">Dashboard not found</h2>
          <p style="color:#6b84a0;margin-top:8px;">This link may have expired or is invalid.</p>
          <a href="https://zeromisscall.com" style="color:#E8791A;margin-top:20px;display:inline-block;">zeromisscall.com</a>
        </body></html>`);
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const stats = await db_helpers.getStats(db, plumber.twilioNumber, startOfMonth, now);
      const avgJobValue = plumber.averageJobValue || 250;
      const estimatedRevenue = ((stats.leadsCaptures || 0) * avgJobValue).toLocaleString();
      const enrichedStats = { ...stats, estimatedRevenue };
      const conversations = await db_helpers.getRecentConversations(db, plumber.twilioNumber, 20);

      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(buildDashboardHtml(plumber, enrichedStats, conversations));
    } catch (err) {
      console.error("❌ Dashboard error:", err.message);
      res.status(500).send(`<html><body style="background:#0b1928;color:white;text-align:center;padding:60px;font-family:Arial;">
        <h2>Something went wrong</h2><p style="color:#6b84a0;">Please try refreshing.</p>
      </body></html>`);
    }
  });
}

module.exports = { registerDashboardRoute };
