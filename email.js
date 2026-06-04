// ─────────────────────────────────────────────────────────────
// PHASE 4 - EMAIL INFRASTRUCTURE
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
  siteUrl:    "https://zeromisscall.com",
  upgradeUrl: "https://zeromisscall.com/pricing",
};

// ─────────────────────────────────────────────
// SHARED EMAIL WRAPPER
// Navy header with logo, white content area,
// dark footer - matches site design exactly
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
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0b1928;">${previewText}</div>` : ""}

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1928;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Email container -->
        <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0b1928 0%,#0f2035 100%);border-radius:12px 12px 0 0;padding:28px 36px;text-align:center;border-bottom:3px solid #E8791A;">
              <a href="${BRAND.siteUrl}" style="text-decoration:none;display:inline-block;"><span style="font-family:'Nunito',Arial,sans-serif;font-size:28px;font-weight:900;color:#E8791A;letter-spacing:-0.5px;">zero<span style="color:#ffffff;">miss</span>call</span></a>
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
// TEMPLATE A - WEEKLY DIGEST
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
    subject: `Your ZeroMissCall Weekly Summary - ${totalConversations} calls handled`,
    html: wrapEmail(content, previewText),
  };
}

// ─────────────────────────────────────────────
// TEMPLATE B - TRIAL END EMAIL
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

  const previewText = `Your trial ends tomorrow - here's what ZeroMissCall captured for ${plumber.businessName}.`;

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
        No conversations yet - but your number is ready to go the moment a call comes in.
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
        Keep ZeroMissCall Active &rarr;
      </a>
      <p style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#6b84a0;margin-top:16px;line-height:1.5;">
        If you don't upgrade, your number stops responding to missed calls tomorrow.<br/>
        Questions? Reply to this email - Ian reads every one.
      </p>
    </div>
  `;

  return {
    subject: `Your trial ends tomorrow - ${totalConversations} calls handled for ${plumber.businessName}`,
    html: wrapEmail(content, previewText),
  };
}

// ─────────────────────────────────────────────
// TEMPLATE C - MONTHLY REPORT
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

  const previewText = `${plumber.businessName} - your ${monthName} ZeroMissCall report. Estimated $${estimatedRevenue} recovered.`;

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
          ? `<div style="margin-top:10px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#3ecf8e;">Lead captured - all 3 details collected Lead captured - all 3 details collected</div>`
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
        Based on ${totalConversations} missed calls x $${plumber.averageJobValue || 250} avg job value
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
    subject: `${plumber.businessName} - Your ${monthName} ZeroMissCall Report`,
    html: wrapEmail(content, previewText),
  };
}

// ─────────────────────────────────────────────
// SEND FUNCTIONS
// ─────────────────────────────────────────────

async function sendWeeklyDigest(plumber, stats) {
  if (!plumber.email) {
    console.warn(`!  No email for plumber ${plumber.businessName} - skipping weekly digest`);
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
    console.log(` Weekly digest sent to ${plumber.email} | ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`ERR Failed to send weekly digest to ${plumber.email}:`, err.message);
    throw err;
  }
}

async function sendTrialEndEmail(plumber, stats, conversations) {
  if (!plumber.email) {
    console.warn(`!  No email for plumber ${plumber.businessName} - skipping trial end email`);
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
    console.log(` Trial end email sent to ${plumber.email} | ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`ERR Failed to send trial end email to ${plumber.email}:`, err.message);
    throw err;
  }
}

async function sendMonthlyReport(plumber, stats, monthName) {
  if (!plumber.email) {
    console.warn(`!  No email for plumber ${plumber.businessName} - skipping monthly report`);
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
    console.log(` Monthly report sent to ${plumber.email} | ID: ${result.id}`);
    return result;
  } catch (err) {
    console.error(`ERR Failed to send monthly report to ${plumber.email}:`, err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────
// TEST SEND - fires all 3 emails to one address
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
    weekOf:             "May 26 - Jun 1, 2026",
    topJobTypes: [
      { type: "drain", count: 4 },
      { type: "boiler", count: 3 },
      { type: "leak",   count: 2 },
    ],
    bestConvo: {
      leadCaptured: true,
      messages: [
        { role: "assistant", content: "Hey! Thanks for calling Dave's Plumbing - sorry we missed you. What do you need?" },
        { role: "user",      content: "Hi yeah my kitchen drain is completely blocked, water isn't going down at all" },
        { role: "assistant", content: "That sounds frustrating! We can definitely sort that out. What's your zip code so I can confirm we cover your area?" },
        { role: "user",      content: "75201" },
        { role: "assistant", content: "Perfect - we cover Dallas. When would you like someone to come out? Morning or afternoon works best?" },
        { role: "user",      content: "Tomorrow morning would be great" },
      ],
    },
  };

  const testConversations = [testStats.bestConvo];

  console.log(` Sending test emails to ${toEmail}...`);

  await sendWeeklyDigest(testPlumber, testStats);
  await sendTrialEndEmail(testPlumber, testStats, testConversations);
  await sendMonthlyReport(testPlumber, testStats, "May 2026");

  console.log(`OK All 3 test emails sent to ${toEmail}`);
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
// STEP 1 - Install Resend:
//   npm install resend
//
// STEP 2 - Add to .env and Railway environment variables:
//   RESEND_API_KEY=re_xxxxxxxxxxxx
//
// STEP 3 - Add to .env.example:
//   RESEND_API_KEY=your_resend_api_key
//
// STEP 4 - Add require at top of server.js:
//   const emailService = require("./email");
//
// STEP 5 - Add test endpoint to server.js (before health check):
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
// STEP 6 - Add ADMIN_SECRET to .env and Railway:
//   ADMIN_SECRET=choose_a_strong_random_string
//
// STEP 7 - Add to Resend dashboard:
//   - Go to resend.com/domains
//   - Add zeromisscall.com
//   - Add the DNS records to Hostinger
//   - Verify the domain
//   - Create reports@zeromisscall.com and ian@zeromisscall.com
//     as sender identities
//
// STEP 8 - Test by visiting:
//   https://your-railway-url.railway.app/test-emails?secret=YOUR_ADMIN_SECRET&email=your@email.com
//
// ─────────────────────────────────────────────────────────────
