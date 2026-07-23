// ─────────────────────────────────────────────────────────────
// PHASE 8 - BOOKING CONFIRMATION HANDOFF
// ZeroMissCall v2
//
// HOW TO USE:
// 1. Save this file as handoff.js in the same folder as server.js
// 2. Follow integration instructions at the bottom
//
// WHAT THIS DOES:
// Detects when the AI has captured all 3 lead details:
//   1. Job description (what they need)
//   2. Zip code (where they are)
//   3. Preferred time (when they want someone)
//
// When all 3 are captured:
//   - Sends structured SMS alert to plumber's phone instantly
//   - Sends branded email to plumber with full details + dashboard link
//   - Marks conversation as leadCaptured in MongoDB
//   - Prevents duplicate notifications for same conversation
// ─────────────────────────────────────────────────────────────

const { Resend } = require("resend");
const emailService2 = require("./email2");

// ─────────────────────────────────────────────
// LEAD DETECTION
// Analyses the full conversation to determine
// if all 3 capture goals have been met
// ─────────────────────────────────────────────

// Keywords that indicate a zip code was shared
const ZIP_PATTERNS = [
  /\b\d{5}\b/,                    // 5-digit US zip
  /\bzip\b/i,
  /\bpostal\b/i,
  /\barea code\b/i,
];

// Keywords that indicate a time preference was shared
const TIME_PATTERNS = [
  /\btoday\b/i,
  /\btomorrow\b/i,
  /\bmonday\b/i, /\btuesday\b/i, /\bwednesday\b/i,
  /\bthursday\b/i, /\bfriday\b/i, /\bsaturday\b/i, /\bsunday\b/i,
  /\bmorning\b/i, /\bafternoon\b/i, /\bevening\b/i, /\bnight\b/i,
  /\basap\b/i, /\bsoon\b/i, /\burgent\b/i,
  /\bnext week\b/i, /\bthis week\b/i,
  /\b\d{1,2}(am|pm)\b/i,
  /\b\d{1,2}:\d{2}\b/,
  /\bweekend\b/i, /\banytime\b/i, /\bflexible\b/i,
];

// Keywords that indicate a job description was shared
// (fairly broad - almost any substantive customer message qualifies)
const JOB_PATTERNS = [
  /\bdrain\b/i, /\bleak\b/i, /\bpipe\b/i, /\bboiler\b/i,
  /\btoilet\b/i, /\bsink\b/i, /\bshower\b/i, /\bbath\b/i,
  /\bwater\b/i, /\bheater\b/i, /\bradiat\b/i, /\bvalve\b/i,
  /\bblock\b/i, /\binstall\b/i, /\breplace\b/i, /\brepair\b/i,
  /\bfix\b/i, /\bservice\b/i, /\bcheck\b/i, /\binspect\b/i,
  /\bpressure\b/i, /\bhot water\b/i, /\bcold water\b/i,
  /\bburst\b/i, /\bflooding\b/i, /\boverflow\b/i,
];

function extractZipCode(text) {
  const match = text.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

function extractTimePreference(text) {
  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function hasJobDescription(messages) {
  // Check customer messages for job-related content
  const customerMessages = messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join(" ");

  return JOB_PATTERNS.some(p => p.test(customerMessages));
}

// ─────────────────────────────────────────────
// ANALYSE CONVERSATION FOR LEAD CAPTURE
// Returns { isComplete, jobDescription, callerZip, preferredTime }
// ─────────────────────────────────────────────
function analyseConversation(messages) {
  if (!messages || messages.length < 2) {
    return { isComplete: false };
  }

  const customerMessages = messages.filter(m => m.role === "user");
  const allCustomerText  = customerMessages.map(m => m.content).join(" ");

  // Extract zip code from all customer messages
  const callerZip = extractZipCode(allCustomerText);

  // Extract time preference from all customer messages
  const preferredTime = extractTimePreference(allCustomerText);

  // Check for job description
  const hasJob = hasJobDescription(messages);

  // Extract a readable job description from first substantive customer message
  let jobDescription = null;
  for (const msg of customerMessages) {
    if (msg.content.length > 10 && JOB_PATTERNS.some(p => p.test(msg.content))) {
      jobDescription = msg.content.length > 100
        ? msg.content.substring(0, 100) + "..."
        : msg.content;
      break;
    }
  }

  // Also check if AI's last message confirms all details collected
  // (the AI is prompted to confirm when it has all 3)
  const lastAiMessage = [...messages].reverse().find(m => m.role === "assistant");
  const aiConfirmed = lastAiMessage && (
    /we have everything/i.test(lastAiMessage.content) ||
    /got everything/i.test(lastAiMessage.content) ||
    /all the details/i.test(lastAiMessage.content) ||
    /will be in touch/i.test(lastAiMessage.content) ||
    /will contact you/i.test(lastAiMessage.content) ||
    /will call you/i.test(lastAiMessage.content) ||
    /will get back to you/i.test(lastAiMessage.content)
  );

  const isComplete = hasJob && callerZip && (preferredTime || aiConfirmed);

  return {
    isComplete,
    jobDescription: jobDescription || "Plumbing enquiry",
    callerZip,
    preferredTime: preferredTime || "Flexible",
    aiConfirmed: !!aiConfirmed,
  };
}

// ─────────────────────────────────────────────
// BUILD LEAD ALERT SMS
// Short, scannable, action-oriented
// ─────────────────────────────────────────────
function buildLeadSMS(plumber, callerNumber, leadData) {
  return (
    ` New lead - ZeroMissCall\n\n` +
    `Customer: ${callerNumber}\n` +
    `Job: ${leadData.jobDescription}\n` +
    `Zip: ${leadData.callerZip}\n` +
    `Time: ${leadData.preferredTime}\n\n` +
    `Call them back `
  );
}

// ─────────────────────────────────────────────
// BUILD LEAD ALERT EMAIL
// Branded, mobile-first, matches zeromisscall.com
// ─────────────────────────────────────────────
function buildLeadEmail(plumber, callerNumber, leadData, dashboardUrl) {
  const now = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Lead - ZeroMissCall</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="background:#0b1928;margin:0;padding:0;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1928;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0b1928,#0f2035);border-radius:12px 12px 0 0;padding:24px 36px;text-align:center;border-bottom:3px solid #E8791A;">
          <img src="https://zeromisscall.com/zeromisscall.png" alt="ZeroMissCall" width="200" style="display:block;margin:0 auto;"/>
        </td></tr>

        <!-- Hero -->
        <tr><td style="background:linear-gradient(135deg,rgba(62,207,142,0.1),rgba(15,32,53,0.8));padding:32px 36px;text-align:center;border-bottom:1px solid rgba(62,207,142,0.2);">
          <div style="font-size:48px;margin-bottom:8px;"></div>
          <div style="font-family:'Nunito',Arial,sans-serif;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">
            New Lead Captured
          </div>
          <div style="font-size:14px;color:#3ecf8e;">${plumber.businessName} &middot; ${now}</div>
        </td></tr>

        <!-- Lead details -->
        <tr><td style="background:#ffffff;padding:32px 36px;">

          <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;color:#444;line-height:1.6;margin:0 0 24px 0;">
            Hey ${plumber.ownerName} - a customer just confirmed their details. Here's everything you need to call them back:
          </p>

          <!-- Detail cards -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#f8f9fa;border-radius:10px;padding:16px 20px;border-left:4px solid #E8791A;">
                <div style="font-size:11px;font-weight:700;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Customer Number</div>
                <div style="font-family:'Nunito',Arial,sans-serif;font-size:20px;font-weight:800;color:#0b1928;">
                  <a href="tel:${callerNumber}" style="color:#0b1928;text-decoration:none;">${callerNumber}</a>
                </div>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
            <tr>
              <td width="32%" style="background:#f8f9fa;border-radius:10px;padding:14px 16px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Job</div>
                <div style="font-size:14px;color:#333;font-weight:500;line-height:1.4;">${leadData.jobDescription}</div>
              </td>
              <td width="2%"></td>
              <td width="32%" style="background:#f8f9fa;border-radius:10px;padding:14px 16px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Zip Code</div>
                <div style="font-family:'Nunito',Arial,sans-serif;font-size:18px;font-weight:800;color:#0b1928;">${leadData.callerZip}</div>
              </td>
              <td width="2%"></td>
              <td width="32%" style="background:#f8f9fa;border-radius:10px;padding:14px 16px;vertical-align:top;">
                <div style="font-size:10px;font-weight:700;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Preferred Time</div>
                <div style="font-size:14px;color:#333;font-weight:500;line-height:1.4;">${leadData.preferredTime}</div>
              </td>
            </tr>
          </table>

          <!-- CTAs -->
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="tel:${callerNumber}" style="display:inline-block;background:#E8791A;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:16px;font-weight:800;padding:14px 36px;border-radius:8px;text-decoration:none;margin:0 6px 10px;">
               Call ${callerNumber}
            </a>
            ${dashboardUrl ? `<a href="${dashboardUrl}" style="display:inline-block;background:#0b1928;color:#fff;font-family:'Nunito',Arial,sans-serif;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.1);margin:0 6px 10px;">
              View Full Conversation &rarr;
            </a>` : ""}
          </div>

          <p style="font-size:13px;color:#6b84a0;text-align:center;margin:0;">
            This lead was captured by ZeroMissCall AI. The customer is expecting your call.
          </p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0f2035;border-radius:0 0 12px 12px;padding:20px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.07);">
          <p style="font-size:12px;color:#6b84a0;margin:0;">
            ZeroMissCall &mdash; <a href="https://zeromisscall.com" style="color:#E8791A;">zeromisscall.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `New lead - ${callerNumber} needs ${leadData.jobDescription.substring(0, 40)}`,
    html,
  };
}

// ─────────────────────────────────────────────
// FIRE LEAD HANDOFF
// Call this after every AI reply to check if
// lead capture is complete
// ─────────────────────────────────────────────
async function fireLeadHandoff(
  db,
  db_helpers,
  sendSMS,
  twilioNumber,
  callerNumber,
  messages,
  plumber
) {
  try {
    // Already notified for this conversation today?
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existing = await db.collection("conversations").findOne({
      twilioNumber,
      callerNumber,
      createdAt: { $gte: startOfDay },
      leadCaptured: true,
    });

    if (existing) {
      // Already fired - don't send duplicate
      return false;
    }

    // Analyse the conversation
    const leadData = analyseConversation(messages);

    if (!leadData.isComplete) {
      return false;
    }

    console.log(` LEAD CAPTURED: ${callerNumber} &rarr; ${twilioNumber}`);
    console.log(`   Job: ${leadData.jobDescription}`);
    console.log(`   Zip: ${leadData.callerZip}`);
    console.log(`   Time: ${leadData.preferredTime}`);

    // Mark as lead captured in MongoDB
    await db_helpers.saveMessage(db, twilioNumber, callerNumber, null, null, {
      leadCaptured:   true,
      jobDescription: leadData.jobDescription,
      callerZip:      leadData.callerZip,
      preferredTime:  leadData.preferredTime,
      jobType:        extractJobType(leadData.jobDescription),
    });

    // Fire SMS alert to plumber
    if (plumber.ownerPhone) {
      try {
        const sms = buildLeadSMS(plumber, callerNumber, leadData);
        await sendSMS(plumber.ownerPhone, twilioNumber, sms);
        console.log(` Lead SMS sent to plumber: ${plumber.ownerPhone}`);
      } catch (smsErr) {
        console.error(" Lead SMS failed:", smsErr.message);
      }
    }

    // Fire email alert to plumber
    if (plumber.email && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const dashboardUrl = plumber.dashboardToken
          ? `${process.env.PUBLIC_BASE_URL || "https://missed-call-bot-production.up.railway.app"}/dashboard/${plumber.dashboardToken}`
          : null;

        const { subject, html } = buildLeadEmail(
          plumber, callerNumber, leadData, dashboardUrl
        );

        await resend.emails.send({
          from:    "ZeroMissCall <reports@zeromisscall.com>",
          to:      plumber.email,
          subject,
          html,
        });

        console.log(` Lead email sent to plumber: ${plumber.email}`);
      } catch (emailErr) {
        console.error(" Lead email failed:", emailErr.message);
      }
    }

    // Fire first lead email if this is their first ever captured lead
    try {
      var allConvos = await db.collection("conversations").find({
        twilioNumber: twilioNumber,
        leadCaptured: true,
      }).toArray();
      if (allConvos.length === 1) {
        await emailService2.sendFirstLeadEmail(plumber, {
          callerNumber:   callerNumber,
          jobDescription: leadData.jobDescription || "",
          callerZip:      leadData.callerZip || "",
        });
        console.log(" First lead email sent to " + plumber.email);
      }
    } catch (firstLeadErr) {
      console.error(" First lead email error:", firstLeadErr.message);
    }

    return true;

  } catch (err) {
    console.error(" Lead handoff error:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// EXTRACT JOB TYPE
// Categorises job for analytics
// ─────────────────────────────────────────────
function extractJobType(description) {
  const d = description.toLowerCase();
  if (/drain|block/.test(d))           return "drain";
  if (/boiler|heating|radiator/.test(d)) return "boiler";
  if (/leak|burst|pipe/.test(d))       return "leak";
  if (/toilet|cistern/.test(d))        return "toilet";
  if (/water heater|hot water/.test(d)) return "water-heater";
  if (/install|fit|replace/.test(d))   return "installation";
  if (/shower|bath/.test(d))           return "bathroom";
  if (/sink|tap|faucet/.test(d))       return "sink";
  return "general";
}

// ─────────────────────────────────────────────
// SALES HANDOFF (ZeroMissCall's own line)
// Used when an account has salesMode enabled. The caller is a plumber who is
// interested in the product, not a homeowner with a leak. Two outcomes:
//   1. They give an email  -> auto-send the invitation email, alert Ian.
//   2. They want a callback -> alert Ian immediately with the details.
// ─────────────────────────────────────────────

// Grab the first plausible email address from the customer's own messages.
function extractEmail(messages) {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  for (const m of messages) {
    if (m.role !== "user" || !m.content) continue;
    const hit = String(m.content).match(re);
    if (hit) return hit[0].toLowerCase();
  }
  return null;
}

// Did they ask to be phoned rather than emailed?
function wantsCallback(messages) {
  const re = /\b(call me|ring me|give me a call|phone me|rather (talk|chat|speak)|speak to you|call back|callback)\b/i;
  return messages.some(m => m.role === "user" && m.content && re.test(String(m.content)));
}

async function fireSalesHandoff(
  db, db_helpers, sendSMS, twilioNumber, callerNumber, messages, plumber, email2
) {
  try {
    const convo = await db.collection("conversations").findOne({ twilioNumber, callerNumber });
    if (!convo) return;

    const ownerPhone = plumber.ownerPhone;
    const email      = extractEmail(messages);

    // ── 1. Email captured -> send the invitation, once ──
    if (email && !convo.salesEmailSent) {
      try {
        await email2.sendInvitationEmail(email, null, null);
        await db.collection("conversations").updateOne(
          { _id: convo._id },
          { $set: { salesEmailSent: true, salesEmail: email, updatedAt: new Date() } }
        );
        console.log(`Sales: invitation email sent to ${email} (from ${callerNumber})`);

        if (ownerPhone) {
          await sendSMS(ownerPhone, twilioNumber,
            `NEW PROSPECT - email captured\n${email}\nFrom: ${callerNumber}\nInvitation email sent automatically.`);
        }
      } catch (e) {
        console.error("Sales: failed to send invitation email:", e.message);
      }
      return;
    }

    // ── 2. They want a callback -> alert immediately, once ──
    if (wantsCallback(messages) && !convo.salesCallbackAlerted) {
      await db.collection("conversations").updateOne(
        { _id: convo._id },
        { $set: { salesCallbackAlerted: true, updatedAt: new Date() } }
      );
      console.log(`Sales: callback requested by ${callerNumber}`);

      if (ownerPhone) {
        const preferred = extractTimePreference(
          messages.filter(m => m.role === "user").map(m => m.content).join(" ")
        );
        await sendSMS(ownerPhone, twilioNumber,
          `HOT PROSPECT - wants a call\nNumber: ${callerNumber}` +
          (preferred ? `\nBest time: ${preferred}` : "") +
          `\nRing them back.`);
      }
    }
  } catch (err) {
    console.error("Sales handoff error:", err.message);
  }
}

module.exports = { fireLeadHandoff, analyseConversation, fireSalesHandoff };

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// STEP 1 - Add require at top of server.js:
//   const { fireLeadHandoff } = require("./handoff");
//
// STEP 2 - In /incoming-sms, after the AI replies successfully,
// add the lead handoff check.
// Find this block:
//
//     await db_helpers.saveMessage(db, twilioNumber, callerNumber, "assistant", aiReply, { emergency });
//     await sendSMS(callerNumber, twilioNumber, aiReply);
//     console.log(` AI replied to ${callerNumber}: "${aiReply}"`);
//
// Add immediately after it:
//
//     // ── LEAD CAPTURE CHECK ───────────────────────────────────
//     const updatedHistory = await db_helpers.getConversation(db, twilioNumber, callerNumber);
//     await fireLeadHandoff(db, db_helpers, sendSMS, twilioNumber, callerNumber, updatedHistory, plumber);
//
// That's it. Every AI reply now triggers a check.
// If the conversation has all 3 details - SMS + email fire once.
// If not - nothing happens and it checks again next message.
// ─────────────────────────────────────────────────────────────
