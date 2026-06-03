// ─────────────────────────────────────────────────────────────
// PHASE 4 — EMAIL INFRASTRUCTURE
// ZeroMissCall v2
//
// HOW TO USE:
// 1. npm install resend
// 2. Add RESEND_API_KEY to your .env and Railway environment
// 3. Save this file as email.js in the same folder as server.js
// 4. Follow integration instructions at the bottom
// ─────────────────────────────────────────────────────────────

const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────
// SENDER ADDRESSES
// ─────────────────────────────────────────────
const SENDERS = {
  reports: "ZeroMissCall <reports@zeromisscall.com>",
  trial:   "Ian from ZeroMissCall <ian@zeromisscall.com>",
};

// ─────────────────────────────────────────────
// BRAND CONSTANTS (matches zeromisscall.com exactly)
// ─────────────────────────────────────────────
const BRAND = {
  navy:       "#0b1928",
  navyMid:    "#0f2035",
  orange:     "#E8791A",
  orangeLight:"#f08e32",
  green:      "#3ecf8e",
  textLight:  "#c8dce8",
  textMuted:  "#6b84a0",
  white:      "#ffffff",
  logoUrl:    "data:image/jpeg;base64,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",
  siteUrl:    "https://zeromisscall.com",
  upgradeUrl: "https://zeromisscall.com/pricing",
};

// ─────────────────────────────────────────────
// SHARED EMAIL WRAPPER
// Navy header with logo, white content area,
// dark footer — matches site design exactly
// ─────────────────────────────────────────────
function wrapEmail(contentHtml, previewText = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>ZeroMissCall</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #0b1928; font-family: 'DM Sans', Arial, sans-serif; -webkit-text-size-adjust: 100%; }
    a { color: #E8791A; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 16px !important; }
      .stat-block { width: 48% !important; margin-bottom: 12px !important; }
      .hero-number { font-size: 48px !important; }
      .cta-button { width: 100% !important; display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="background-color:#0b1928;margin:0;padding:0;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0b1928;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1928;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Email container -->
        <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0b1928 0%,#0f2035 100%);border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;border-bottom:3px solid #E8791A;">
              <a href="${BRAND.siteUrl}" style="text-decoration:none;">
                <img src="${BRAND.logoUrl}" alt="ZeroMissCall" width="220" style="display:block;margin:0 auto;max-width:220px;" />
              </a>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="background:#ffffff;padding:0;">
              ${contentHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0f2035;border-radius:0 0 12px 12px;padding:24px 36px;text-align:center;border-top:1px solid #1a3550;">
              <p style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6b84a0;line-height:1.6;margin:0 0 8px 0;">
                ZeroMissCall &mdash; Never miss a customer again.<br/>
                <a href="${BRAND.siteUrl}" style="color:#E8791A;">zeromisscall.com</a>
              </p>
              <p style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#4a6278;margin:0;">
                You're receiving this because you have an active ZeroMissCall account.<br/>
                To update your preferences, <a href="${BRAND.siteUrl}/contact.html" style="color:#6b84a0;text-decoration:underline;">contact us</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// TEMPLATE A — WEEKLY DIGEST
// Sends every Monday morning
// Three big numbers, money-first, dead simple
// ─────────────────────────────────────────────
function buildWeeklyDigestEmail(plumber, stats) {
  const {
    totalConversations,
    leadsCaptures,
    estimatedRevenue,
    weekOf,
  } = stats;

  const previewText = `Last week: ${totalConversations} missed calls handled, ${leadsCaptures} leads captured.`;

  const content = `
    <!-- Greeting -->
    <div style="padding:36px 36px 0;">
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;color:#0b1928;line-height:1.6;margin:0 0 6px 0;">
        Hey ${plumber.ownerName},
      </p>
      <p style="font-family:'Nunito',Arial,sans-serif;font-size:22px;font-weight:800;color:#0b1928;line-height:1.3;margin:0 0 24px 0;">
        Here's your ZeroMissCall weekly summary
      </p>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#6b84a0;margin:0 0 32px 0;">
        Week of ${weekOf} &mdash; ${plumber.businessName}
      </p>
    </div>

    <!-- Stats row -->
    <div style="padding:0 36px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- Stat 1 -->
          <td class="stat-block" width="32%" style="text-align:center;background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:10px;padding:20px 12px;border:1px solid #1a3550;">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:36px;font-weight:800;color:#E8791A;line-height:1;">
              ${totalConversations}
            </div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">
              Missed calls<br/>handled
            </div>
          </td>
          <td width="2%"></td>
          <!-- Stat 2 -->
          <td class="stat-block" width="32%" style="text-align:center;background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:10px;padding:20px 12px;border:1px solid #1a3550;">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:36px;font-weight:800;color:#3ecf8e;line-height:1;">
              ${leadsCaptures}
            </div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">
              Leads<br/>captured
            </div>
          </td>
          <td width="2%"></td>
          <!-- Stat 3 -->
          <td class="stat-block" width="32%" style="text-align:center;background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:10px;padding:20px 12px;border:1px solid #1a3550;">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:36px;font-weight:800;color:#3ecf8e;line-height:1;">
              $${estimatedRevenue}
            </div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">
              Est. revenue<br/>recovered
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:#eef0f3;margin:0 36px 28px;"></div>

    <!-- Message -->
    <div style="padding:0 36px 36px;">
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#333;line-height:1.7;margin:0 0 24px 0;">
        ZeroMissCall handled every one of those missed calls while you were out on the job.
        ${leadsCaptures > 0
          ? `<strong>${leadsCaptures} customer${leadsCaptures > 1 ? "s" : ""} gave their details and ${leadsCaptures > 1 ? "are" : "is"} ready to book.</strong>`
          : "Keep an eye on your texts for any follow-ups."
        }
      </p>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#6b84a0;line-height:1.6;margin:0;">
        Have a great week &mdash; we've got your calls covered.
      </p>
    </div>
  `;

  return {
    subject: `Your ZeroMissCall Weekly Summary — ${totalConversations} calls handled`,
    html: wrapEmail(content, previewText),
  };
}

// ─────────────────────────────────────────────
// TEMPLATE B — TRIAL END EMAIL
// Sends day 13 of trial (day before expiry)
// Personal tone, shows real conversation snippets,
// single CTA to upgrade
// ─────────────────────────────────────────────
function buildTrialEndEmail(plumber, stats, conversations) {
  const {
    totalConversations,
    leadsCaptures,
    estimatedRevenue,
  } = stats;

  const previewText = `Your trial ends tomorrow — here's what ZeroMissCall captured for ${plumber.businessName}.`;

  // Pick up to 2 real conversation snippets
  const snippets = conversations
    .filter(c => c.messages && c.messages.length >= 2)
    .slice(0, 2);

  const snippetHtml = snippets.length > 0
    ? snippets.map((convo, i) => {
        const msgs = convo.messages.slice(0, 4);
        return `
          <div style="background:#f8f9fa;border-radius:10px;padding:16px 20px;margin-bottom:12px;border-left:3px solid #E8791A;">
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b84a0;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
              Real conversation ${i + 1}
            </div>
            ${msgs.map(m => `
              <div style="margin-bottom:8px;text-align:${m.role === "user" ? "left" : "right"};">
                <span style="display:inline-block;background:${m.role === "user" ? "#e9ecef" : "#E8791A"};color:${m.role === "user" ? "#333" : "#fff"};padding:7px 12px;border-radius:12px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;max-width:80%;line-height:1.4;">
                  ${m.content.length > 120 ? m.content.substring(0, 120) + "..." : m.content}
                </span>
              </div>
            `).join("")}
          </div>
        `;
      }).join("")
    : `<div style="background:#f8f9fa;border-radius:10px;padding:16px 20px;text-align:center;color:#6b84a0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;">
        No conversations yet — but your number is ready to go the moment a call comes in.
       </div>`;

  const content = `
    <!-- Hero -->
    <div style="background:linear-gradient(135deg,#0b1928 0%,#0f2035 100%);padding:40px 36px;text-align:center;">
      <div class="hero-number" style="font-family:'Nunito',Arial,sans-serif;font-size:64px;font-weight:800;color:#E8791A;line-height:1;margin-bottom:8px;">
        ${totalConversations}
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;color:#c8dce8;margin-bottom:4px;">
        missed calls answered while you were on the job
      </div>
      ${estimatedRevenue > 0
        ? `<div style="font-family:'Nunito',Arial,sans-serif;font-size:20px;font-weight:700;color:#3ecf8e;margin-top:12px;">
            Estimated $${estimatedRevenue} in jobs recovered
           </div>`
        : ""
      }
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 0;">
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:16px;color:#0b1928;line-height:1.6;margin:0 0 8px 0;">
        Hey ${plumber.ownerName},
      </p>
      <p style="font-family:'Nunito',Arial,sans-serif;font-size:20px;font-weight:800;color:#0b1928;line-height:1.3;margin:0 0 20px 0;">
        Your ZeroMissCall trial ends tomorrow.
      </p>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 28px 0;">
        During your trial, ZeroMissCall replied to <strong>${totalConversations} missed call${totalConversations !== 1 ? "s" : ""}</strong>
        ${leadsCaptures > 0 ? ` and captured <strong>${leadsCaptures} lead${leadsCaptures !== 1 ? "s" : ""}</strong> with full contact details` : ""}.
        Here's what some of those conversations looked like:
      </p>
    </div>

    <!-- Conversation snippets -->
    <div style="padding:0 36px 28px;">
      ${snippetHtml}
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:8px;">
        Customer numbers hidden for privacy.
      </p>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:#eef0f3;margin:0 36px 28px;"></div>

    <!-- CTA -->
    <div style="padding:0 36px 36px;text-align:center;">
      <p style="font-family:'Nunito',Arial,sans-serif;font-size:18px;font-weight:700;color:#0b1928;margin:0 0 8px 0;">
        Keep ZeroMissCall working for ${plumber.businessName}
      </p>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#6b84a0;margin:0 0 24px 0;">
        $69/month &mdash; cancel anytime &mdash; no contracts
      </p>
      <a href="https://missed-call-bot-production.up.railway.app/billing/create-checkout/${plumber.dashboardToken}" class="cta-button" style="display:inline-block;background:#E8791A;color:#ffffff;font-family:'Nunito',Arial,sans-serif;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;">
        Keep ZeroMissCall Active →
      </a>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6b84a0;margin-top:16px;line-height:1.5;">
        If you don't upgrade, your number stops responding to missed calls tomorrow.<br/>
        Questions? Reply to this email — Ian reads every one.
      </p>
    </div>
  `;

  return {
    subject: `Your trial ends tomorrow — ${totalConversations} calls handled for ${plumber.businessName}`,
    html: wrapEmail(content, previewText),
  };
}

// ─────────────────────────────────────────────
// TEMPLATE C — MONTHLY REPORT
// Sends last day of each month
// 4 stats, top conversation, job type breakdown
// Price right-aligned, professional
// ─────────────────────────────────────────────
function buildMonthlyReportEmail(plumber, stats, monthName) {
  const {
    totalConversations,
    leadsCaptures,
    emergencies,
    estimatedRevenue,
    topJobTypes,
    bestConvo,
  } = stats;

  const previewText = `${plumber.businessName} — your ${monthName} ZeroMissCall report. Estimated $${estimatedRevenue} recovered.`;

  const bestConvoHtml = bestConvo && bestConvo.messages
    ? `
      <div style="background:#f8f9fa;border-radius:10px;padding:16px 20px;margin-top:8px;border-left:3px solid #3ecf8e;">
        <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b84a0;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
          Best conversation this month
        </div>
        ${bestConvo.messages.slice(0, 6).map(m => `
          <div style="margin-bottom:8px;text-align:${m.role === "user" ? "left" : "right"};">
            <span style="display:inline-block;background:${m.role === "user" ? "#e9ecef" : "#E8791A"};color:${m.role === "user" ? "#333" : "#fff"};padding:7px 12px;border-radius:12px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;max-width:80%;line-height:1.4;">
              ${m.content.length > 120 ? m.content.substring(0, 120) + "..." : m.content}
            </span>
          </div>
        `).join("")}
        ${bestConvo.leadCaptured
          ? `<div style="margin-top:10px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#3ecf8e;">✓ Lead captured — all 3 details collected</div>`
          : ""
        }
      </div>`
    : "";

  const jobTypesHtml = topJobTypes && topJobTypes.length > 0
    ? `
      <div style="margin-top:20px;">
        <p style="font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;">
          Top job types this month
        </p>
        ${topJobTypes.map(jt => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
            <span style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#444;text-transform:capitalize;">${jt.type}</span>
            <span style="font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#E8791A;">${jt.count} enquir${jt.count === 1 ? "y" : "ies"}</span>
          </div>
        `).join("")}
      </div>`
    : "";

  const content = `
    <!-- Hero revenue -->
    <div style="background:linear-gradient(135deg,#0b1928 0%,#0f2035 100%);padding:40px 36px;text-align:center;">
      <div style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        ${monthName} Report &mdash; ${plumber.businessName}
      </div>
      <div style="font-family:'Nunito',Arial,sans-serif;font-size:14px;color:#c8dce8;margin-bottom:4px;">
        Estimated revenue recovered
      </div>
      <div class="hero-number" style="font-family:'Nunito',Arial,sans-serif;font-size:64px;font-weight:800;color:#3ecf8e;line-height:1;">
        $${estimatedRevenue}
      </div>
      <div style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6b84a0;margin-top:8px;">
        Based on ${totalConversations} missed calls × $${plumber.averageJobValue || 250} avg job value
      </div>
    </div>

    <!-- 4 stats -->
    <div style="padding:32px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="stat-block" width="23%" style="text-align:center;background:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid #eef0f3;">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:28px;font-weight:800;color:#E8791A;line-height:1;">${totalConversations}</div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Missed calls<br/>handled</div>
          </td>
          <td width="2%"></td>
          <td class="stat-block" width="23%" style="text-align:center;background:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid #eef0f3;">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:28px;font-weight:800;color:#3ecf8e;line-height:1;">${leadsCaptures}</div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Leads<br/>captured</div>
          </td>
          <td width="2%"></td>
          <td class="stat-block" width="23%" style="text-align:center;background:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid #eef0f3;">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:28px;font-weight:800;color:#0b1928;line-height:1;">${Math.round((leadsCaptures / Math.max(totalConversations, 1)) * 100)}%</div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Lead<br/>capture rate</div>
          </td>
          <td width="2%"></td>
          <td class="stat-block" width="23%" style="text-align:center;background:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid ${emergencies > 0 ? "#fed7d7" : "#eef0f3"};">
            <div style="font-family:'Nunito',Arial,sans-serif;font-size:28px;font-weight:800;color:${emergencies > 0 ? "#e53e3e" : "#0b1928"};line-height:1;">${emergencies}</div>
            <div style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#6b84a0;margin-top:4px;line-height:1.3;">Emergency<br/>alerts</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Best conversation + job types -->
    <div style="padding:24px 36px;">
      ${bestConvoHtml}
      ${jobTypesHtml}
    </div>

    <!-- Divider -->
    <div style="height:1px;background:#eef0f3;margin:0 36px 24px;"></div>

    <!-- Billing footer -->
    <div style="padding:0 36px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#444;">
            Next billing date
          </td>
          <td style="text-align:right;font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;">
            1st of next month
          </td>
        </tr>
        <tr>
          <td style="font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:#444;padding-top:8px;">
            Monthly subscription
          </td>
          <td style="text-align:right;font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;padding-top:8px;">
            $69.00
          </td>
        </tr>
      </table>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6b84a0;margin-top:16px;line-height:1.6;">
        Questions about your account? Reply to this email or visit
        <a href="${BRAND.siteUrl}/contact.html" style="color:#E8791A;">zeromisscall.com/contact</a>
      </p>
    </div>
  `;

  return {
    subject: `${plumber.businessName} — Your ${monthName} ZeroMissCall Report`,
    html: wrapEmail(content, previewText),
  };
}

// ─────────────────────────────────────────────
// SEND FUNCTIONS
// ─────────────────────────────────────────────

async function sendWeeklyDigest(plumber, stats) {
  if (!plumber.email) {
    console.warn(`⚠️  No email for plumber ${plumber.businessName} — skipping weekly digest`);
    return;
  }
  const { subject, html } = buildWeeklyDigestEmail(plumber, stats);
  try {
    const result = await resend.emails.send({
      from:    SENDERS.reports,
      to:      plumber.email,
      subject,
      html,
    });
    console.log(`📧 Weekly digest sent to ${plumber.email} | ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to send weekly digest to ${plumber.email}:`, err.message);
    throw err;
  }
}

async function sendTrialEndEmail(plumber, stats, conversations) {
  if (!plumber.email) {
    console.warn(`⚠️  No email for plumber ${plumber.businessName} — skipping trial end email`);
    return;
  }
  const { subject, html } = buildTrialEndEmail(plumber, stats, conversations);
  try {
    const result = await resend.emails.send({
      from:    SENDERS.trial,
      to:      plumber.email,
      subject,
      html,
    });
    console.log(`📧 Trial end email sent to ${plumber.email} | ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to send trial end email to ${plumber.email}:`, err.message);
    throw err;
  }
}

async function sendMonthlyReport(plumber, stats, monthName) {
  if (!plumber.email) {
    console.warn(`⚠️  No email for plumber ${plumber.businessName} — skipping monthly report`);
    return;
  }
  const { subject, html } = buildMonthlyReportEmail(plumber, stats, monthName);
  try {
    const result = await resend.emails.send({
      from:    SENDERS.reports,
      to:      plumber.email,
      subject,
      html,
    });
    console.log(`📧 Monthly report sent to ${plumber.email} | ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to send monthly report to ${plumber.email}:`, err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────
// TEST SEND — fires all 3 emails to one address
// Call via GET /test-emails?secret=YOUR_ADMIN_SECRET
// ─────────────────────────────────────────────
async function sendTestEmails(toEmail) {
  const testPlumber = {
    businessName:  "Dave's Plumbing Co.",
    ownerName:     "Dave",
    email:         toEmail,
    ownerPhone:    "+15551234567",
    averageJobValue: 250,
  };

  const testStats = {
    totalConversations: 9,
    leadsCaptures:      6,
    emergencies:        1,
    estimatedRevenue:   2250,
    weekOf:             "May 26 – Jun 1, 2026",
    topJobTypes: [
      { type: "drain", count: 4 },
      { type: "boiler", count: 3 },
      { type: "leak",   count: 2 },
    ],
    bestConvo: {
      leadCaptured: true,
      messages: [
        { role: "assistant", content: "Hey! Thanks for calling Dave's Plumbing — sorry we missed you. What do you need?" },
        { role: "user",      content: "Hi yeah my kitchen drain is completely blocked, water isn't going down at all" },
        { role: "assistant", content: "That sounds frustrating! We can definitely sort that out. What's your zip code so I can confirm we cover your area?" },
        { role: "user",      content: "75201" },
        { role: "assistant", content: "Perfect — we cover Dallas. When would you like someone to come out? Morning or afternoon works best?" },
        { role: "user",      content: "Tomorrow morning would be great" },
      ],
    },
  };

  const testConversations = [testStats.bestConvo];

  console.log(`📧 Sending test emails to ${toEmail}...`);

  await sendWeeklyDigest(testPlumber, testStats);
  await sendTrialEndEmail(testPlumber, testStats, testConversations);
  await sendMonthlyReport(testPlumber, testStats, "May 2026");

  console.log(`✅ All 3 test emails sent to ${toEmail}`);
}

module.exports = {
  sendWeeklyDigest,
  sendTrialEndEmail,
  sendMonthlyReport,
  sendTestEmails,
  buildWeeklyDigestEmail,
  buildTrialEndEmail,
  buildMonthlyReportEmail,
};

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 — Install Resend:
//   npm install resend
//
// STEP 2 — Add to .env and Railway environment variables:
//   RESEND_API_KEY=re_xxxxxxxxxxxx
//
// STEP 3 — Add to .env.example:
//   RESEND_API_KEY=your_resend_api_key
//
// STEP 4 — Add require at top of server.js:
//   const emailService = require("./email");
//
// STEP 5 — Add test endpoint to server.js (before health check):
//
//   app.get("/test-emails", async (req, res) => {
//     if (req.query.secret !== process.env.ADMIN_SECRET) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }
//     const toEmail = req.query.email || process.env.OWNER_EMAIL;
//     try {
//       await emailService.sendTestEmails(toEmail);
//       res.json({ success: true, message: `3 test emails sent to ${toEmail}` });
//     } catch (err) {
//       res.status(500).json({ error: err.message });
//     }
//   });
//
// STEP 6 — Add ADMIN_SECRET to .env and Railway:
//   ADMIN_SECRET=choose_a_strong_random_string
//
// STEP 7 — Add to Resend dashboard:
//   - Go to resend.com/domains
//   - Add zeromisscall.com
//   - Add the DNS records to Hostinger
//   - Verify the domain
//   - Create reports@zeromisscall.com and ian@zeromisscall.com
//     as sender identities
//
// STEP 8 — Test by visiting:
//   https://your-railway-url.railway.app/test-emails?secret=YOUR_ADMIN_SECRET&email=your@email.com
//
// ─────────────────────────────────────────────────────────────
