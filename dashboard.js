// ─────────────────────────────────────────────────────────────
// PHASE 7 - PLUMBER DASHBOARD (v2 - matches zeromisscall.com)
// ─────────────────────────────────────────────────────────────

function buildDashboardHtml(plumber, stats, conversations) {
  // Escape anything that could break the HTML or the surrounding template
  // literal / inline JS: angle brackets, quotes, backticks, and ${ sequences.
  // A single stray backtick or ${ in a customer message was corrupting the
  // whole page script, which stopped conversations from expanding.
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/`/g, "&#96;")
      .replace(/\$\{/g, "$&#123;");
  }

  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  // ── Jobs Recovered ledger row (only on captured leads) ──
  // Unmarked -> ask. Marked -> show the result. One tap for the common case;
  // the value defaults to the plumber's average job value and can be edited.
  function outcomeRow(convo, plumber) {
    const avg = plumber.averageJobValue || 250;

    if (convo.jobOutcome === "won") {
      return `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:rgba(62,207,142,0.12);border:1px solid rgba(62,207,142,0.3);color:#3ecf8e;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:700;">
        &#10003; Job won &middot; $${(convo.jobValue || 0).toLocaleString()}
      </div>`;
    }
    if (convo.jobOutcome === "lost") {
      return `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#6b84a0;padding:5px 12px;border-radius:100px;font-size:12px;">
        Didn't book
      </div>`;
    }

    // Not yet marked - prompt the owner.
    // Use the conversation's unique _id (not the caller number) so marking one
    // conversation never collides with another from the same caller.
    const cid = String(convo._id || convo.id || "");
    return `<div onclick="event.stopPropagation();" style="margin-top:12px;background:rgba(232,121,26,0.07);border:1px solid rgba(232,121,26,0.22);border-radius:12px;padding:10px 12px;">
      <div style="font-size:12px;color:#f5c898;margin-bottom:8px;font-weight:600;">Did this become a job?</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button onclick="markOutcome('${cid}','won',${avg})" style="background:#3ecf8e;color:#04220f;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;">Yes &middot; $${avg}</button>
        <button onclick="markOutcomeCustom('${cid}',${avg})" style="background:transparent;color:#96aec6;border:1px solid rgba(255,255,255,0.15);padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;">Yes, different amount</button>
        <button onclick="markOutcome('${cid}','lost',0)" style="background:transparent;color:#6b84a0;border:1px solid rgba(255,255,255,0.12);padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;">No</button>
      </div>
    </div>`;
  }

  const conversationCards = conversations.map((convo, index) => {
    const isEmergency = convo.emergency;
    const isLead      = convo.leadCaptured;
    const msgCount    = convo.messages ? convo.messages.length : 0;
    // A conversation worth marking as a job is any real back-and-forth: the
    // customer replied at least once. The plumber may well call these back and
    // win the work even if the AI never formally "captured" the lead - so they
    // can log it and it counts toward Revenue Recovered.
    const hasCustomerReply = convo.messages
      ? convo.messages.some(m => m.role === "user")
      : false;
    const canMarkJob = isLead || hasCustomerReply;
    const date        = new Date(convo.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const statusBadge = isEmergency
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(240,82,82,0.12);border:1px solid rgba(240,82,82,0.3);color:#f05252;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:0.3px;">EMERGENCY</span>`
      : isLead
      ? `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.3);color:#3ecf8e;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:0.3px;">LEAD CAPTURED</span>`
      : `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#6b84a0;padding:3px 10px;border-radius:100px;font-size:11px;">In Progress</span>`;

    const messages = convo.messages ? convo.messages.map(m => `
      <div style="margin-bottom:10px;text-align:${m.role === "user" ? "left" : "right"};">
        <div style="display:inline-block;background:${m.role === "user" ? "rgba(255,255,255,0.075)" : "rgba(232,121,26,0.15)"};border:1px solid ${m.role === "user" ? "rgba(255,255,255,0.07)" : "rgba(232,121,26,0.25)"};color:${m.role === "user" ? "#fff" : "#f5c898"};padding:10px 14px;border-radius:${m.role === "user" ? "16px 16px 16px 4px" : "16px 16px 4px 16px"};font-size:13px;max-width:82%;line-height:1.5;text-align:left;">
          ${esc(m.content)}
        </div>
        <div style="font-size:10px;color:#6b84a0;margin-top:3px;padding:0 4px;">
          ${m.role === "user" ? "Customer" : "ZeroMissCall AI"}
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
            ${convo.jobDescription ? `<div style="font-size:12px;color:#96aec6;">${esc(convo.jobDescription)}</div>` : ""}
            ${convo.callerZip ? `<div style="font-size:12px;color:#96aec6;">Zip: ${esc(convo.callerZip)}</div>` : ""}
            ${convo.preferredTime ? `<div style="font-size:12px;color:#96aec6;">Prefers: ${esc(convo.preferredTime)}</div>` : ""}
            ${canMarkJob ? outcomeRow(convo, plumber) : ""}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
            ${statusBadge}
            <div style="display:flex;gap:6px;align-items:center;">
              <a href="tel:${convo.callerNumber}" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;background:#E8791A;color:#fff;padding:6px 14px;border-radius:8px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;text-decoration:none;">
                Call Back
              </a>
            </div>
            <div style="display:inline-flex;align-items:center;gap:5px;color:#8fa3b8;font-size:12px;font-weight:600;">
              <span id="arrow-label-${index}">View ${msgCount} message${msgCount === 1 ? "" : "s"}</span>
              <span id="arrow-${index}" style="font-size:12px;transition:transform 0.2s;">▾</span>
            </div>
          </div>
        </div>
        <div id="convo-${index}" style="display:none;padding:0 20px 16px;border-top:1px solid rgba(255,255,255,0.07);">
          <div style="padding-top:14px;">
            ${messages}
          </div>
          <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
            <div style="font-size:11px;color:#6b84a0;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Reply as ${plumber.businessName}</div>
            <div style="display:flex;gap:8px;align-items:flex-end;">
              <textarea id="reply-text-${index}" rows="2" placeholder="Type your reply..." style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 12px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;resize:none;outline:none;line-height:1.5;"></textarea>
              <button onclick="sendReply(${index}, '${convo.callerNumber}')" id="reply-btn-${index}" style="background:#E8791A;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">Send</button>
            </div>
            <div id="reply-status-${index}" style="font-size:12px;margin-top:6px;display:none;"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const trialBanner = plumber.subscriptionStatus === "trial" ? `
    <div style="background:linear-gradient(135deg,rgba(232,121,26,0.08),rgba(15,32,53,0.6));border:1px solid rgba(232,121,26,0.22);border-radius:14px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#f08e32;margin-bottom:2px;">Free Trial Active</div>
        <div style="font-size:11px;color:#f05252;margin-top:2px;font-weight:700;">${(function(){ var d = Math.ceil((new Date(plumber.trialEndDate) - new Date()) / (1000*60*60*24)); return d > 1 ? d + " days remaining" : d === 1 ? "1 day remaining" : d === 0 ? "Last day of trial" : "Trial ended"; })()}</div>
        <div style="font-size:12px;color:#6b84a0;">
          Ends ${plumber.trialEndDate ? new Date(plumber.trialEndDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon"}
        </div>
      </div>
      <a href="https://missed-call-bot-production.up.railway.app/billing/create-checkout/${plumber.dashboardToken}" style="display:inline-flex;align-items:center;gap:6px;background:#E8791A;color:#fff;padding:9px 20px;border-radius:8px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;text-decoration:none;">
        Upgrade - $69/mo &rarr;
      </a>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <link rel="icon" type="image/png" href="https://zeromisscall.com/favicon.png">
  <title>${plumber.businessName} - ZeroMissCall</title>
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
      <span style="font-family:'Nunito',sans-serif;font-weight:900;font-size:19px;letter-spacing:-0.5px;color:#fff;">Zero<span style="color:#E8791A;">Miss</span>Call</span>
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
        <div style="font-size:11px;color:${stats.revenueConfirmed ? "#3ecf8e" : "#6b84a0"};margin-top:5px;line-height:1.4;font-weight:500;">${stats.revenueConfirmed ? `Revenue Recovered<br/>${stats.jobsWon} job${stats.jobsWon === 1 ? "" : "s"} confirmed` : "Est. Revenue<br/>Recovered"}</div>
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
        <span style="background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.3);color:#3ecf8e;padding:2px 8px;border-radius:100px;font-weight:700;">LEAD</span> all 3 details collected
      </span>
      <span style="font-size:11px;color:#6b84a0;display:flex;align-items:center;gap:5px;">
        <span style="background:rgba(240,82,82,0.12);border:1px solid rgba(240,82,82,0.3);color:#f05252;padding:2px 8px;border-radius:100px;font-weight:700;">EMERGENCY</span> urgent alert sent
      </span>
    </div>

    <!-- CONVERSATION CARDS -->
    ${conversations.length > 0 ? conversationCards : `
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:48px 24px;text-align:center;">
        <div style="font-size:36px;margin-bottom:14px;font-family:monospace;color:#6b84a0;">[ ]</div>
        <div style="font-family:'Nunito',sans-serif;font-size:17px;font-weight:800;margin-bottom:8px;">No conversations yet</div>
        <div style="font-size:13px;color:#6b84a0;max-width:280px;margin:0 auto;line-height:1.6;">
          When customers text back after a missed call, their conversations will appear here.
        </div>
      </div>
    `}



    <!-- ─── BILLING SECTION ─── -->
    <div style="margin-top:28px;">
      <div style="margin-bottom:14px;">
        <h2 style="font-family:'Nunito',sans-serif;font-size:18px;font-weight:900;letter-spacing:-0.5px;margin-bottom:2px;">Billing</h2>
        <p style="font-size:12px;color:#6b84a0;">Manage your subscription and payment details</p>
      </div>

      <div style="background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;">

        <!-- Status row -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:12px;color:#6b84a0;margin-bottom:4px;">Subscription Status</div>
            <div style="display:inline-flex;align-items:center;gap:6px;">
              ${plumber.subscriptionStatus === 'active'
                ? `<span style="width:7px;height:7px;background:#3ecf8e;border-radius:50%;display:inline-block;"></span><span style="font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;color:#3ecf8e;">Active</span>`
                : plumber.subscriptionStatus === 'trial'
                ? `<span style="width:7px;height:7px;background:#E8791A;border-radius:50%;display:inline-block;"></span><span style="font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;color:#f08e32;">Free Trial</span>`
                : `<span style="width:7px;height:7px;background:#f05252;border-radius:50%;display:inline-block;"></span><span style="font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;color:#f05252;">Inactive</span>`
              }
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#6b84a0;margin-bottom:4px;">Plan</div>
            <div style="font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;color:#fff;">$69 / month</div>
          </div>
        </div>

        <!-- Trial end / next billing -->
        ${plumber.subscriptionStatus === 'trial'
          ? `<div style="background:rgba(232,121,26,0.07);border:1px solid rgba(232,121,26,0.18);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
              <div style="font-size:12px;color:#6b84a0;margin-bottom:3px;">Trial ends</div>
              <div style="font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;color:#f08e32;">
                ${plumber.trialEndDate ? new Date(plumber.trialEndDate).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : 'Soon'}
              </div>
            </div>`
          : ''
        }

        <!-- CTA buttons -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${plumber.subscriptionStatus !== 'active'
            ? `<a href="https://missed-call-bot-production.up.railway.app/billing/create-checkout/${plumber.dashboardToken}"
                style="display:inline-flex;align-items:center;gap:6px;background:#E8791A;color:#fff;padding:12px 24px;border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;text-decoration:none;">
                Upgrade to Pro - $69/mo &rarr;
              </a>`
            : `<a href="https://missed-call-bot-production.up.railway.app/billing/portal/${plumber.dashboardToken}"
                style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:12px 24px;border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;text-decoration:none;">
                Manage Billing &amp; Cancel
              </a>`
          }
          <a href="mailto:hello@zeromisscall.com"
            style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#6b84a0;padding:12px 20px;border-radius:10px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;text-decoration:none;">
            Billing Question?
          </a>
        </div>

      </div>
    </div>

    <!-- ─── SETTINGS SECTION ─── -->
    <div style="margin-top:28px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <h2 style="font-family:'Nunito',sans-serif;font-size:18px;font-weight:900;letter-spacing:-0.5px;margin-bottom:2px;">Account Settings</h2>
          <p style="font-size:12px;color:#6b84a0;">The AI uses these details when talking to your customers</p>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;">

        <div id="settings-saved" style="display:none;background:rgba(62,207,142,0.1);border:1px solid rgba(62,207,142,0.3);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:#3ecf8e;">
          Settings saved successfully
        </div>
        <div id="settings-error" style="display:none;background:rgba(240,82,82,0.1);border:1px solid rgba(240,82,82,0.3);border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:#f05252;">
          Something went wrong. Please try again.
        </div>

        <!-- Row 1: Business Hours + Service Area -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="display:block;font-size:12px;color:#96aec6;margin-bottom:6px;font-weight:500;">Business Hours</label>
            <input id="s-hours" type="text" value="${plumber.hours || 'Mon-Fri 8am-6pm'}"
              style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;"
              placeholder="Mon-Fri 8am-6pm" />
          </div>
          <div>
            <label style="display:block;font-size:12px;color:#96aec6;margin-bottom:6px;font-weight:500;">Service Area</label>
            <input id="s-area" type="text" value="${plumber.serviceArea || 'your local area'}"
              style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;"
              placeholder="e.g. Dallas, TX and surrounding areas" />
          </div>
        </div>

        <!-- Row 2: Average Job Value + Emergency -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="display:block;font-size:12px;color:#96aec6;margin-bottom:6px;font-weight:500;">Average Job Value ($)</label>
            <input id="s-jobvalue" type="number" value="${plumber.averageJobValue || 250}"
              style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;"
              placeholder="250" min="1" />
          </div>
          <div>
            <label style="display:block;font-size:12px;color:#96aec6;margin-bottom:6px;font-weight:500;">Emergency Availability</label>
            <select id="s-emergency"
              style="width:100%;background:rgba(15,32,53,0.9);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;cursor:pointer;">
              <option value="true" ${plumber.emergencyAvailable !== false ? 'selected' : ''}>Yes - I handle emergencies</option>
              <option value="false" ${plumber.emergencyAvailable === false ? 'selected' : ''}>No - emergencies only during hours</option>
            </select>
          </div>
        </div>

        <!-- Services -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:12px;color:#96aec6;margin-bottom:6px;font-weight:500;">Services Offered <span style="color:#6b84a0;">(comma separated)</span></label>
          <input id="s-services" type="text" value="${Array.isArray(plumber.services) && plumber.services.length ? plumber.services.join(', ') : ''}"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;"
            placeholder="e.g. drain unblocking, boiler repair, leak detection, bathroom fitting" />
        </div>

        <!-- Custom FAQs -->
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:12px;color:#96aec6;margin-bottom:6px;font-weight:500;">Custom FAQ <span style="color:#6b84a0;">(one per line - the AI will use these to answer common questions)</span></label>
          <textarea id="s-faqs" rows="4"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 14px;color:#fff;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;resize:vertical;line-height:1.5;"
            placeholder="Do you offer free quotes? Yes, all quotes are free and same-day.&#10;Do you work weekends? Yes, for emergency callouts only.">${Array.isArray(plumber.customFaqs) && plumber.customFaqs.length ? plumber.customFaqs.join('\n') : ''}</textarea>
        </div>

        <!-- Save button -->
        <button id="settings-btn" onclick="saveSettings()"
          style="background:#E8791A;color:#fff;border:none;border-radius:10px;padding:13px 28px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer;transition:opacity 0.2s;">
          Save Settings
        </button>

      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
      <div style="font-size:12px;color:#6b84a0;line-height:1.8;">
        Reload this page to see the latest conversations.<br/>
        Questions? <a href="mailto:hello@zeromisscall.com" style="color:#E8791A;text-decoration:none;">hello@zeromisscall.com</a>
      </div>
      <div style="margin-top:12px;">
        <span style="font-family:'Nunito',sans-serif;font-weight:900;font-size:19px;letter-spacing:-0.5px;color:#fff;">Zero<span style="color:#E8791A;">Miss</span>Call</span>
      </div>
    </div>

  </div>

  <script>
    function toggleConvo(index) {
      const el = document.getElementById('convo-' + index);
      const arrow = document.getElementById('arrow-' + index);
      const label = document.getElementById('arrow-label-' + index);
      if (!el) return;
      if (el.style.display === 'none' || el.style.display === '') {
        el.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        if (label) label.textContent = 'Hide conversation';
      } else {
        el.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        if (label) {
          var count = el.getAttribute('data-count') || '';
          label.textContent = 'View conversation';
        }
      }
    }

    function saveSettings() {
      var btn = document.getElementById('settings-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      document.getElementById('settings-saved').style.display = 'none';
      document.getElementById('settings-error').style.display = 'none';

      var services = document.getElementById('s-services').value
        .split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      var faqs = document.getElementById('s-faqs').value
        .split(String.fromCharCode(10)).map(function(s){ return s.trim(); }).filter(Boolean);

      var payload = {
        hours:              document.getElementById('s-hours').value.trim(),
        serviceArea:        document.getElementById('s-area').value.trim(),
        averageJobValue:    parseInt(document.getElementById('s-jobvalue').value) || 250,
        emergencyAvailable: document.getElementById('s-emergency').value === 'true',
        services:           services,
        customFaqs:         faqs
      };

      fetch(window.location.pathname + '/settings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      })
      .then(function(r){
        if (!r.ok) throw new Error('Failed');
        document.getElementById('settings-saved').style.display = 'block';
        btn.textContent = 'Save Settings';
        btn.disabled = false;
        window.scrollTo({top: document.getElementById('settings-saved').offsetTop - 80, behavior: 'smooth'});
      })
      .catch(function(){
        document.getElementById('settings-error').style.display = 'block';
        btn.textContent = 'Save Settings';
        btn.disabled = false;
      });
    }


    function sendReply(index, callerNumber) {
      var text = document.getElementById('reply-text-' + index).value.trim();
      var btn  = document.getElementById('reply-btn-' + index);
      var status = document.getElementById('reply-status-' + index);

      if (!text) return;
      if (text.length > 320) {
        status.textContent = 'Message too long (max 320 characters)';
        status.style.color = '#f05252';
        status.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending...';
      status.style.display = 'none';

      fetch(window.location.pathname + '/reply', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ callerNumber: callerNumber, message: text })
      })
      .then(function(r) {
        if (!r.ok) throw new Error('Failed');
        document.getElementById('reply-text-' + index).value = '';
        status.textContent = 'Reply sent successfully';
        status.style.color = '#3ecf8e';
        status.style.display = 'block';
        btn.textContent = 'Send';
        btn.disabled = false;
        setTimeout(function() { status.style.display = 'none'; }, 3000);
      })
      .catch(function() {
        status.textContent = 'Failed to send. Try again.';
        status.style.color = '#f05252';
        status.style.display = 'block';
        btn.textContent = 'Send';
        btn.disabled = false;
      });
    }

    // ── JOBS RECOVERED LEDGER ─────────────────────────────────
    function markOutcome(conversationId, outcome, jobValue) {
      fetch(window.location.pathname + '/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationId, outcome: outcome, jobValue: jobValue })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { window.location.reload(); }
        else { alert('Could not save. Please try again.'); }
      })
      .catch(function() { alert('Could not save. Please try again.'); });
    }

    function markOutcomeCustom(conversationId, avg) {
      var v = prompt('What was this job worth? (US dollars)', avg);
      if (v === null) return;
      var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
      if (!isFinite(n) || n < 0) { alert('Enter a number, e.g. 340'); return; }
      markOutcome(conversationId, 'won', n);
    }

    // ── AUTO-REFRESH ──────────────────────────────────────────
    // Reloads every 60s so new missed calls / leads appear without
    // manual refresh. Skips the reload if the plumber has a
    // conversation open or has typed anything into a reply box,
    // so nothing is ever lost mid-action.
    setInterval(function () {
      var busy = false;
      document.querySelectorAll('[id^="convo-"]').forEach(function (el) {
        if (el.style.display !== 'none') busy = true;
      });
      document.querySelectorAll('[id^="reply-text-"]').forEach(function (el) {
        if (el.value.trim().length > 0 || document.activeElement === el) busy = true;
      });
      if (!busy) window.location.reload();
    }, 60000);

  </script>

</body>
</html>`;
}

function registerDashboardRoute(app, db, db_helpers) {
  // ── Settings update
  app.post("/dashboard/:token/settings", async (req, res) => {
    try {
      const plumber = await db_helpers.getPlumberByToken(db, req.params.token);
      if (!plumber) return res.status(404).json({ error: "Not found" });

      const allowed = ["hours", "serviceArea", "averageJobValue", "emergencyAvailable", "services", "customFaqs"];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.averageJobValue) updates.averageJobValue = Number(updates.averageJobValue) || 250;

      await db_helpers.updatePlumber(db, plumber.twilioNumber, updates);
      console.log(`Settings updated for ${plumber.businessName}`);
      res.json({ ok: true });
    } catch (err) {
      console.error(" Settings update error:", err.message);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });



  // ── Jobs Recovered: mark a lead won or lost ───────────────────────────────
  app.post("/dashboard/:token/outcome", async (req, res) => {
    try {
      var plumber = await db_helpers.getPlumberByToken(db, req.params.token);
      if (!plumber) return res.status(404).json({ error: "Not found" });

      var conversationId = req.body.conversationId;
      var outcome        = req.body.outcome;

      if (!conversationId || (outcome !== "won" && outcome !== "lost")) {
        return res.status(400).json({ error: "Missing conversationId or invalid outcome" });
      }

      // Default a won job to the plumber's average job value; allow an override.
      var value = 0;
      if (outcome === "won") {
        value = req.body.jobValue !== undefined && req.body.jobValue !== ""
          ? Number(req.body.jobValue)
          : (plumber.averageJobValue || 250);
        if (!isFinite(value) || value < 0 || value > 1000000) {
          return res.status(400).json({ error: "Invalid job value" });
        }
      }

      var result = await db_helpers.markJobOutcome(db, plumber.twilioNumber, conversationId, outcome, value);
      if (!result || result.matchedCount === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      console.log("Job marked " + outcome + " ($" + value + ") for " + plumber.businessName + " convo " + conversationId);
      res.json({ ok: true, outcome: outcome, jobValue: value });
    } catch (err) {
      console.error("Outcome update error:", err.message);
      res.status(500).json({ error: "Failed to save outcome" });
    }
  });

  // ── Manual reply from dashboard ───────────────────────────────────────────
  app.post("/dashboard/:token/reply", async (req, res) => {
    try {
      var plumber = await db_helpers.getPlumberByToken(db, req.params.token);
      if (!plumber) return res.status(404).json({ error: "Not found" });

      var callerNumber = req.body.callerNumber;
      var message      = (req.body.message || "").trim();

      if (!callerNumber || !message) {
        return res.status(400).json({ error: "Missing callerNumber or message" });
      }
      if (message.length > 320) {
        return res.status(400).json({ error: "Message too long (max 320 chars)" });
      }

      // Send SMS via Twilio
      var twilio = require("twilio");
      var client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        to:   callerNumber,
        from: plumber.twilioNumber,
        body: message,
      });

      // Save to conversation history
      await db_helpers.saveMessage(db, plumber.twilioNumber, callerNumber, "assistant", message, { manualReply: true });

      console.log("Manual reply sent from " + plumber.businessName + " to " + callerNumber);
      res.json({ ok: true });
    } catch (err) {
      console.error("Reply error:", err.message);
      res.status(500).json({ error: "Failed to send reply: " + err.message });
    }
  });

  app.get("/dashboard/:token", async (req, res) => {
    try {
      const plumber = await db_helpers.getPlumberByToken(db, req.params.token);

      if (!plumber) {
        return res.status(404).send(`<!DOCTYPE html><html><body style="background:#0b1928;color:white;font-family:'DM Sans',Arial,sans-serif;text-align:center;padding:80px 20px;">
          <span style="font-family:'Nunito',sans-serif;font-weight:900;font-size:19px;letter-spacing:-0.5px;color:#fff;">Zero<span style="color:#E8791A;">Miss</span>Call</span>
          <h2 style="font-family:'Nunito',sans-serif;font-weight:900;">Dashboard not found</h2>
          <p style="color:#6b84a0;margin-top:8px;">This link may have expired or is invalid.</p>
          <a href="https://zeromisscall.com" style="color:#E8791A;margin-top:20px;display:inline-block;">zeromisscall.com</a>
        </body></html>`);
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const stats = await db_helpers.getStats(db, plumber.twilioNumber, startOfMonth, now);
      const avgJobValue = plumber.averageJobValue || 250;

      // Jobs Recovered ledger: once the owner starts marking leads won/lost we
      // show CONFIRMED revenue (real money he told us about) instead of an
      // estimate. Confirmed numbers are far more persuasive at trial end.
      const recovered = await db_helpers.getRecoveredTotals(db, plumber.twilioNumber, startOfMonth, now);
      const hasConfirmed = recovered.won > 0;

      const estimatedRevenue = hasConfirmed
        ? recovered.revenue.toLocaleString()
        : ((stats.leadsCaptures || 0) * avgJobValue).toLocaleString();

      const enrichedStats = {
        ...stats,
        estimatedRevenue,
        revenueConfirmed: hasConfirmed,
        jobsWon: recovered.won,
      };
      const conversations = await db_helpers.getRecentConversations(db, plumber.twilioNumber, 20);

      // Pin what matters: emergencies first, then captured leads,
      // then everything else - newest first within each group.
      conversations.sort(function (a, b) {
        var rank = function (c) { return c.emergency ? 0 : c.leadCaptured ? 1 : 2; };
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(buildDashboardHtml(plumber, enrichedStats, conversations));
    } catch (err) {
      console.error(" Dashboard error:", err.message);
      res.status(500).send(`<html><body style="background:#0b1928;color:white;text-align:center;padding:60px;font-family:Arial;">
        <h2>Something went wrong</h2><p style="color:#6b84a0;">Please try refreshing.</p>
      </body></html>`);
    }
  });
}

module.exports = { registerDashboardRoute };
