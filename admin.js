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
//   POST /admin/invite          → send sales invitation email
//
//   POST /onboard               → self-serve signup (used by website form later)
//
// All /admin routes protected by ADMIN_SECRET header or query param
// /onboard is public (used by signup form)
// ─────────────────────────────────────────────────────────────

const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const twilio = require("twilio");
const email2 = require("./email2");


// ─────────────────────────────────────────────
// NOTIFICATION HELPERS
// ─────────────────────────────────────────────
var MY_NUMBER  = process.env.OWNER_PHONE  || "+353852688039";
var ZMC_NUMBER = process.env.TWILIO_NUMBER || "+18885760762";

// ── FAVICON ──────────────────────────────────
// Paste your full base64 favicon string between the quotes below.
// It's the long 'data:image/png;base64,iVBORw0KGgo...' string from
// your previous admin.js <link rel='icon'> tag. One paste, done.
var ZMC_FAVICON = "PASTE_YOUR_BASE64_FAVICON_STRING_HERE";

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendSMSNotification(to, body) {
  try {
    var client = getTwilioClient();
    await client.messages.create({ to: to, from: ZMC_NUMBER, body: body });
    console.log("SMS notification sent to " + to);
  } catch (err) {
    console.error("SMS notification failed to " + to + ": " + err.message);
  }
}

async function sendWelcomeSMS(plumber) {
  if (!plumber.ownerPhone) return;
  var msg =
    "Hey " + plumber.ownerName + ", welcome to ZeroMissCall! " +
    "Your account is live and ready. " +
    "Check your email for setup instructions - " +
    "it takes 2 minutes to get call forwarding set up. " +
    "Reply to this if you need any help.";
  await sendSMSNotification(plumber.ownerPhone, msg);
}

async function notifyOwnerNewSignup(plumber) {
  var msg =
    "New ZeroMissCall signup: " +
    plumber.businessName + " (" + plumber.ownerName + ") " +
    plumber.email;
  await sendSMSNotification(MY_NUMBER, msg);
}

async function notifyOwnerLeadCaptured(plumber, lead) {
  var msg =
    "Lead captured for " + plumber.businessName + ": " +
    (lead.jobDescription || "unknown job") +
    " in zip " + (lead.callerZip || "unknown") +
    " from " + (lead.callerNumber || "unknown");
  await sendSMSNotification(MY_NUMBER, msg);
}

async function notifyOwnerError(context, err) {
  var msg = "ZeroMissCall ERROR in " + context + ": " + (err.message || String(err)).substring(0, 120);
  await sendSMSNotification(MY_NUMBER, msg);
}

async function sendDailySummaryEmail(db, db_helpers, emailService) {
  try {
    var now = new Date();
    var yesterday = new Date(now - 24 * 60 * 60 * 1000);
    var plumbers  = await db_helpers.getAllPlumbers(db);
    var active    = plumbers.filter(function(p) { return p.subscriptionStatus === "active"; }).length;
    var trials    = plumbers.filter(function(p) { return p.subscriptionStatus === "trial"; }).length;
    var mrr       = active * 69;
    var newToday  = plumbers.filter(function(p) {
      return p.createdAt && new Date(p.createdAt) >= yesterday;
    });
    var totalCalls = 0;
    var totalLeads = 0;
    for (var i = 0; i < plumbers.length; i++) {
      var s = await db_helpers.getStats(db, plumbers[i].twilioNumber, yesterday, now);
      totalCalls += s.totalConversations || 0;
      totalLeads += s.leadsCaptures || 0;
    }
    if (totalCalls === 0 && newToday.length === 0) {
      console.log("Daily summary: nothing to report");
      return;
    }
    var { Resend } = require("resend");
    var resend = new Resend(process.env.RESEND_API_KEY);
    var html =
      "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;background:#f4f7fb;padding:32px;'>" +
      "<div style='max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;'>" +
      "<h2 style='color:#0b1928;margin:0 0 24px;'>ZeroMissCall Daily Summary</h2>" +
      "<table style='width:100%;border-collapse:collapse;margin-bottom:24px;'>" +
      "<tr><td style='padding:8px 0;color:#666;font-size:14px;'>New signups today</td><td style='text-align:right;font-weight:700;color:#E8791A;'>" + newToday.length + "</td></tr>" +
      "<tr><td style='padding:8px 0;color:#666;font-size:14px;'>Active paying customers</td><td style='text-align:right;font-weight:700;color:#0b1928;'>" + active + "</td></tr>" +
      "<tr><td style='padding:8px 0;color:#666;font-size:14px;'>On free trial</td><td style='text-align:right;font-weight:700;color:#0b1928;'>" + trials + "</td></tr>" +
      "<tr><td style='padding:8px 0;color:#666;font-size:14px;'>Monthly recurring revenue</td><td style='text-align:right;font-weight:700;color:#3ecf8e;'>$" + mrr + "</td></tr>" +
      "<tr><td style='padding:8px 0;color:#666;font-size:14px;border-top:1px solid #eee;'>Calls handled today</td><td style='text-align:right;font-weight:700;color:#0b1928;border-top:1px solid #eee;'>" + totalCalls + "</td></tr>" +
      "<tr><td style='padding:8px 0;color:#666;font-size:14px;'>Leads captured today</td><td style='text-align:right;font-weight:700;color:#3ecf8e;'>" + totalLeads + "</td></tr>" +
      "</table>" +
      (newToday.length > 0
        ? "<p style='font-size:13px;color:#444;margin:0 0 8px;'><strong>New signups:</strong></p>" +
          newToday.map(function(p) {
            return "<p style='font-size:13px;color:#666;margin:0 0 4px;'>" + p.businessName + " - " + p.email + "</p>";
          }).join("")
        : "") +
      "<p style='font-size:12px;color:#999;margin:24px 0 0;'>ZeroMissCall Admin &mdash; zeromisscall.com</p>" +
      "</div></body></html>";
    await resend.emails.send({
      from:    "ZeroMissCall <reports@zeromisscall.com>",
      to:      process.env.OWNER_EMAIL || "ianklokic@gmail.com",
      subject: "ZeroMissCall Daily: " + totalCalls + " calls, " + newToday.length + " new signups, $" + mrr + " MRR",
      html:    html,
    });
    console.log("Daily summary sent");
  } catch (err) {
    console.error("Daily summary error:", err.message);
  }
}

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
// SALES LEAD MATCHING (Step 4 of sales dashboard)
// When a signup's email matches a lead in the "leads"
// collection, the lead auto-advances to TRIAL - so the
// sales dashboard's invite → trial conversion tracks
// itself with zero manual work.
// ─────────────────────────────────────────────
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function matchLeadToSignup(db, email, businessName) {
  if (!email) return;
  try {
    const lead = await db.collection("leads").findOne({
      email: { $regex: "^" + escapeRegex(String(email).trim()) + "$", $options: "i" },
      stage: { $nin: ["trial", "customer"] },
    });
    if (!lead) return;
    await db.collection("leads").updateOne(
      { _id: lead._id },
      {
        $set: { stage: "trial", updatedAt: new Date() },
        $push: { notes: { at: new Date(), text: "Signed up for trial" + (businessName ? " as " + businessName : "") } },
      }
    );
    console.log("Sales lead converted to TRIAL: " + lead.businessName + " (" + email + ")");
  } catch (err) {
    // Never let lead matching break a signup
    console.error("Lead match error:", err.message);
  }
}

// ───────────────────────────────────────────────────────────────────────
// createPendingSignup — shared by POST /onboard (public form) and the
// sales dashboard "Sign Up On Call" button. Creates the plumber as
// UNVERIFIED with no number, and sends the verification email. The paid
// number is only provisioned later, in GET /verify, when they click the link.
// deps = { db, db_helpers, emailService }
// data = { businessName, ownerName, email, ownerPhone, state }
// Returns { plumber, verifyUrl }.
// ───────────────────────────────────────────────────────────────────────
async function createPendingSignup(deps, data) {
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://missed-call-bot-production.up.railway.app";
  const verificationToken = crypto.randomBytes(24).toString("hex");

  const plumber = await deps.db_helpers.createPlumber(deps.db, {
    twilioNumber:      null,            // assigned at verification time
    businessName:      data.businessName,
    ownerName:         data.ownerName,
    ownerPhone:        data.ownerPhone,
    email:             data.email,
    state:             data.state || "",
    plan:              "trial",
    verified:          false,
    verificationToken: verificationToken,
  });

  const verifyUrl = baseUrl + "/verify?token=" + verificationToken;
  try {
    await deps.emailService.sendVerificationEmail(plumber, verifyUrl);
  } catch (emailErr) {
    console.error("⚠️ Verification email failed:", emailErr.message);
  }
  return { plumber: plumber, verifyUrl: verifyUrl };
}

// move the matching sales lead to CUSTOMER:
//   const { markLeadCustomerByEmail } = require("./admin");
//   await markLeadCustomerByEmail(db, plumber.email);
async function markLeadCustomerByEmail(db, email) {
  if (!email) return;
  try {
    const lead = await db.collection("leads").findOne({
      email: { $regex: "^" + escapeRegex(String(email).trim()) + "$", $options: "i" },
      stage: { $ne: "customer" },
    });
    if (!lead) return;
    await db.collection("leads").updateOne(
      { _id: lead._id },
      {
        $set: { stage: "customer", updatedAt: new Date() },
        $push: { notes: { at: new Date(), text: "Became a paying customer" } },
      }
    );
    console.log("Sales lead converted to CUSTOMER: " + lead.businessName + " (" + email + ")");
  } catch (err) {
    console.error("Lead customer-match error:", err.message);
  }
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

// ─────────────────────────────────────────────
// ADMIN DASHBOARD HTML
// ─────────────────────────────────────────────
function buildAdminDashboardHtml(plumbers, allStats, invitations) {
  var now = new Date();
  var total        = plumbers.length;
  var active       = plumbers.filter(function(p) { return p.subscriptionStatus === "active"; }).length;
  var trials       = plumbers.filter(function(p) { return p.subscriptionStatus === "trial"; }).length;
  var expired      = plumbers.filter(function(p) { return p.subscriptionStatus === "expired"; }).length;
  var mrr          = active * 69;
  var noForwarding = plumbers.filter(function(p) {
    var s = allStats[p.twilioNumber] || {};
    var daysSince = Math.floor((now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
    return daysSince >= 2 && (s.totalConversations || 0) === 0 && p.subscriptionStatus !== "expired";
  });
  var trialEndingSoon = plumbers.filter(function(p) {
    if (p.subscriptionStatus !== "trial" || !p.trialEndDate) return false;
    var daysLeft = Math.ceil((new Date(p.trialEndDate) - now) / (1000 * 60 * 60 * 24));
    return daysLeft <= 3 && daysLeft >= 0;
  });

  var rows = plumbers.map(function(p) {
    var s = allStats[p.twilioNumber] || {};
    var daysSince = Math.floor((now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
    var daysLeft  = p.trialEndDate ? Math.ceil((new Date(p.trialEndDate) - now) / (1000 * 60 * 60 * 24)) : null;
    var hasForwarding = (s.totalConversations || 0) > 0;
    var statusColor = p.subscriptionStatus === "active" ? "#3ecf8e" : p.subscriptionStatus === "trial" ? "#E8791A" : "#f05252";
    var fwdBadge = hasForwarding
      ? "<span style=\"background:rgba(62,207,142,0.15);color:#3ecf8e;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;\">FORWARDING OK</span>"
      : daysSince < 1
      ? "<span style=\"background:rgba(255,255,255,0.05);color:#6b84a0;padding:3px 10px;border-radius:100px;font-size:11px;\">NEW</span>"
      : "<span style=\"background:rgba(240,82,82,0.12);color:#f05252;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;\">NOT SET UP</span>";
    var trialInfo = p.subscriptionStatus === "trial" && daysLeft !== null
      ? "<div style=\"font-size:11px;color:" + (daysLeft <= 3 ? "#f05252" : "#6b84a0") + ";margin-top:3px;\">" + daysLeft + " days left</div>"
      : "";
    return "<tr style=\"border-bottom:1px solid rgba(255,255,255,0.07);\">" +
      "<td style=\"padding:12px 16px;font-size:13px;color:#fff;font-weight:600;\">" + p.businessName + "<div style=\"font-size:11px;color:#6b84a0;margin-top:2px;\">" + p.ownerName + "</div></td>" +
      "<td style=\"padding:12px 16px;font-size:13px;color:#96aec6;\">" + (p.email || "-") + "</td>" +
      "<td style=\"padding:12px 16px;text-align:center;\">" +
        "<span style=\"color:" + statusColor + ";font-size:12px;font-weight:700;text-transform:uppercase;\">" + p.subscriptionStatus + "</span>" +
        trialInfo +
      "</td>" +
      "<td style=\"padding:12px 16px;text-align:center;\">" + fwdBadge + "</td>" +
      "<td style=\"padding:12px 16px;text-align:center;font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;color:#E8791A;\">" + (s.totalConversations || 0) + "</td>" +
      "<td style=\"padding:12px 16px;text-align:center;font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;color:#3ecf8e;\">" + (s.leadsCaptures || 0) + "</td>" +
      "<td style=\"padding:12px 16px;text-align:center;\">" +
        "<a href=\"/dashboard/" + p.dashboardToken + "\" style=\"color:#E8791A;font-size:12px;font-weight:700;text-decoration:none;\" target=\"_blank\">View</a>" +
      "</td></tr>";
  }).join("");

  var alerts = "";
  if (noForwarding.length > 0) {
    alerts += "<div style=\"background:rgba(240,82,82,0.08);border:1px solid rgba(240,82,82,0.25);border-radius:12px;padding:14px 18px;margin-bottom:12px;\">" +
      "<div style=\"font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#f05252;margin-bottom:6px;\">Call Forwarding Not Set Up (" + noForwarding.length + ")</div>" +
      noForwarding.map(function(p) { return "<div style=\"font-size:12px;color:#96aec6;margin-bottom:3px;\">" + p.businessName + " &mdash; " + p.email + "</div>"; }).join("") +
      "</div>";
  }
  if (trialEndingSoon.length > 0) {
    alerts += "<div style=\"background:rgba(232,121,26,0.08);border:1px solid rgba(232,121,26,0.25);border-radius:12px;padding:14px 18px;margin-bottom:12px;\">" +
      "<div style=\"font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;color:#E8791A;margin-bottom:6px;\">Trials Ending in 3 Days (" + trialEndingSoon.length + ")</div>" +
      trialEndingSoon.map(function(p) {
        var d = Math.ceil((new Date(p.trialEndDate) - now) / (1000 * 60 * 60 * 24));
        return "<div style=\"font-size:12px;color:#96aec6;margin-bottom:3px;\">" + p.businessName + " &mdash; " + d + " day" + (d !== 1 ? "s" : "") + " left &mdash; " + p.email + "</div>";
      }).join("") +
      "</div>";
  }
  if (!alerts) {
    alerts = "<div style=\"background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.2);border-radius:12px;padding:14px 18px;font-size:13px;color:#3ecf8e;\">No alerts right now</div>";
  }

  var statCards = [
    { n: total,        label: "Total Customers", color: "#fff"     },
    { n: active,       label: "Active (Paying)",  color: "#3ecf8e" },
    { n: trials,       label: "On Trial",         color: "#E8791A" },
    { n: expired,      label: "Expired",          color: "#f05252" },
    { n: "$" + mrr,    label: "MRR",              color: "#3ecf8e" },
  ].map(function(s) {
    return "<div style='background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;text-align:center;'>" +
      "<div style='font-family:Nunito,sans-serif;font-size:28px;font-weight:900;color:" + s.color + ";letter-spacing:-1px;'>" + s.n + "</div>" +
      "<div style='font-size:11px;color:#6b84a0;margin-top:4px;'>" + s.label + "</div>" +
      "</div>";
  }).join("");

  // ── Recent invitations list ──
  var invites = invitations || [];
  var inviteRows = invites.map(function(inv) {
    var when = inv.sentAt ? new Date(inv.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + new Date(inv.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "-";
    return "<div style='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);'>" +
      "<div><span style='font-size:13px;color:#fff;font-weight:600;'>" + inv.email + "</span>" +
      (inv.name ? "<span style='font-size:12px;color:#6b84a0;margin-left:8px;'>(" + inv.name + ")</span>" : "") +
      "</div>" +
      "<span style='font-size:11px;color:#6b84a0;'>" + when + "</span>" +
      "</div>";
  }).join("");
  var inviteHistory = invites.length > 0
    ? "<div style='margin-top:18px;'>" +
      "<div style='font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b84a0;font-weight:600;margin-bottom:6px;'>Recent invitations</div>" +
      inviteRows +
      "</div>"
    : "";

  var inviteSection =
    "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;margin:24px 0 12px;'>Send Invitation</h2>" +
    "<div style='background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;padding:20px;'>" +
    "<p style='font-size:13px;color:#96aec6;margin-bottom:14px;'>Just got off a call with an interested plumber? Send them a signup invitation while it's fresh.</p>" +
    "<div style='display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;'>" +
    "<input id='inv-email' type='email' placeholder='Email address' style='flex:2;min-width:220px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;font-family:DM Sans,sans-serif;outline:none;'/>" +
    "<input id='inv-name' type='text' placeholder='First name (optional)' style='flex:1;min-width:160px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;font-family:DM Sans,sans-serif;outline:none;'/>" +
    "<button id='inv-btn' onclick='sendInvite()' style='background:#E8791A;color:#fff;border:none;border-radius:8px;padding:11px 24px;font-family:Nunito,sans-serif;font-size:14px;font-weight:800;cursor:pointer;'>Send Invitation</button>" +
    "</div>" +
    "<div id='inv-msg' style='font-size:13px;margin-top:10px;min-height:16px;'></div>" +
    inviteHistory +
    "</div>";

  var inviteScript =
    "<script>" +
    "async function sendInvite(){" +
    "var email=document.getElementById('inv-email').value.trim();" +
    "var name=document.getElementById('inv-name').value.trim();" +
    "var msg=document.getElementById('inv-msg');" +
    "var btn=document.getElementById('inv-btn');" +
    "if(!email||email.indexOf('@')===-1){msg.style.color='#f05252';msg.textContent='Enter a valid email address';return;}" +
    "btn.disabled=true;btn.textContent='Sending...';msg.textContent='';" +
    "try{" +
    "var secret=new URLSearchParams(window.location.search).get('secret');" +
    "var r=await fetch('/admin/invite?secret='+encodeURIComponent(secret),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,name:name})});" +
    "var d=await r.json();" +
    "if(r.ok){msg.style.color='#3ecf8e';msg.textContent='Invitation sent to '+email;document.getElementById('inv-email').value='';document.getElementById('inv-name').value='';setTimeout(function(){location.reload();},1500);}" +
    "else{msg.style.color='#f05252';msg.textContent=(d&&(d.message||d.error))||'Failed to send invitation';}" +
    "}catch(e){msg.style.color='#f05252';msg.textContent='Network error: '+e.message;}" +
    "btn.disabled=false;btn.textContent='Send Invitation';" +
    "}" +
    "<\/script>";

  var dateStr = now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  return "<!DOCTYPE html><html lang='en'><head>" +
    "<meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1.0'/>" +
    "<title>ZeroMissCall Admin</title>" +
    "<link rel='icon' type='image/png' href='" + ZMC_FAVICON + "'/>" +
    "<link href='https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap' rel='stylesheet'>" +
    "<style>:root{--navy:#0b1928;--orange:#E8791A;--green:#3ecf8e;--border:rgba(255,255,255,0.07);}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#0b1928;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased;}.wrap{max-width:1100px;margin:0 auto;padding:0 20px 60px;}table{width:100%;border-collapse:collapse;}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b84a0;font-weight:600;padding:10px 16px;}tr:hover td{background:rgba(255,255,255,0.02);}input::placeholder{color:#5a7390;}@media(max-width:900px){.hide-mobile{display:none;}}</style>" +
    "</head><body>" +
    "<div style='position:sticky;top:0;z-index:100;background:rgba(11,25,40,0.95);backdrop-filter:blur(24px);border-bottom:1px solid var(--border);padding:0 20px;'>" +
    "<div style='max-width:1100px;margin:0 auto;height:60px;display:flex;align-items:center;justify-content:space-between;'>" +
    "<span style='font-family:Nunito,sans-serif;font-weight:900;font-size:18px;'><span style='color:#E8791A;'>zero</span><span style='color:#fff;'>miss</span><span style='color:#E8791A;'>call</span> <span style='color:#6b84a0;font-size:13px;font-weight:600;'>Admin</span></span>" +
    "<span style='font-size:12px;color:#6b84a0;'>" + dateStr + "</span>" +
    "</div></div>" +
    "<div class='wrap' style='padding-top:28px;'>" +
    "<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px;'>" + statCards + "</div>" +
    "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;margin-bottom:12px;'>Alerts</h2>" + alerts +
    inviteSection +
    "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;margin:24px 0 12px;'>All Customers</h2>" +
    "<div style='background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;overflow:hidden;'>" +
    "<table><thead><tr style='border-bottom:1px solid var(--border);'>" +
    "<th>Business</th><th class='hide-mobile'>Email</th><th style='text-align:center;'>Status</th><th style='text-align:center;'>Forwarding</th><th style='text-align:center;'>Calls</th><th style='text-align:center;'>Leads</th><th style='text-align:center;'>Dashboard</th>" +
    "</tr></thead><tbody>" +
    (rows || "<tr><td colspan='7' style='padding:40px;text-align:center;color:#6b84a0;'>No customers yet</td></tr>") +
    "</tbody></table></div>" +
    "<p style='font-size:12px;color:#6b84a0;margin-top:16px;text-align:center;'>Reload to refresh &mdash; data is live from MongoDB</p>" +
    "</div>" +
    inviteScript +
    "</body></html>";
}


function registerAdminRoutes(app, db, db_helpers, emailService) {

  // ── CREATE PLUMBER ────────────────────────────────────────
  // POST /admin/plumbers
  // Body: { twilioNumber, businessName, ownerName, ownerPhone,
  //         email, serviceArea, hours, services, customFaqs,
  //         emergencyAvailable, averageJobValue, timezone }

  // ── Admin dashboard HTML page ──
  app.get("/admin/dashboard", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const plumbers = await db_helpers.getAllPlumbers(db);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const allStats = {};
      for (const p of plumbers) {
        allStats[p.twilioNumber] = await db_helpers.getStats(db, p.twilioNumber, startOfMonth, now);
      }
      let invitations = [];
      try {
        invitations = await db.collection("invitations")
          .find({})
          .sort({ sentAt: -1 })
          .limit(10)
          .toArray();
      } catch (invErr) {
        console.error("Could not load invitations:", invErr.message);
      }
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache");
      res.send(buildAdminDashboardHtml(plumbers, allStats, invitations));
    } catch (err) {
      res.status(500).send("Error: " + err.message);
    }
  });

  // ── SEND SALES INVITATION ─────────────────────────────────
  // POST /admin/invite
  // Body: { email, name (optional) }
  // Sends the invitation email (email2.js) to a prospect after a
  // sales call and logs it in the invitations collection.
  app.post("/admin/invite", requireAdminAuth, async (req, res) => {
    try {
      const email = (req.body.email || "").trim();
      const name  = (req.body.name  || "").trim();

      if (!email || !email.includes("@")) {
        return res.status(400).json({
          error: "Validation failed",
          message: "A valid email address is required",
        });
      }

      // Don't invite someone who already has an account
      const existing = await db.collection("plumbers").findOne({ email: email });
      if (existing) {
        return res.status(409).json({
          error: "Already a customer",
          message: email + " already has an account (" + existing.businessName + ", status: " + existing.subscriptionStatus + ")",
        });
      }

      await email2.sendInvitationEmail(email, name);

      // Log the invitation for follow-ups
      try {
        await db.collection("invitations").insertOne({
          email:  email,
          name:   name || null,
          sentAt: new Date(),
        });
      } catch (logErr) {
        console.error("Invitation log failed:", logErr.message);
        // Email was sent - don't fail the request over logging
      }

      console.log("Invitation sent to " + email + (name ? " (" + name + ")" : ""));

      res.json({
        success: true,
        message: "Invitation sent to " + email,
      });
    } catch (err) {
      console.error("❌ Send invitation error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

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

      await sendWelcomeSMS(plumber);
      await notifyOwnerNewSignup(plumber);
      await matchLeadToSignup(db, plumber.email, plumber.businessName);
      console.log("Plumber created: " + plumber.businessName + " (" + plumber.twilioNumber + ")");

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
  // NOTE: the public signup form does NOT send twilioNumber — it is
  // auto-assigned here (shared trial number). Per-customer numbers come later.
  const DEFAULT_TRIAL_NUMBER = "+18885760762";

  // ── PER-CUSTOMER NUMBER PROVISIONING ─────────────────────────────────────
  // Buys a local 10-digit number in the customer's area code, points its
  // webhooks at our app, and (if configured) attaches it to the A2P Messaging
  // Service so it can send SMS immediately. Returns the E.164 number on success.
  // On ANY failure it returns null so the caller can fall back to the shared
  // number — a Twilio hiccup must never block a signup.
  //
  // Requires env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.
  // Optional env: TWILIO_MESSAGING_SERVICE_SID (the A2P campaign's MG... SID).
  //   Until that is set, numbers are bought + webhook-wired but NOT attached to
  //   the campaign (so SMS won't send yet) — fine for staging before A2P approval.
  const APP_BASE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://missed-call-bot-production.up.railway.app";
  const SITE_URL = "https://zeromisscall.com";

  async function provisionLocalNumber(areaCode) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn("⚠️  Provisioning skipped: Twilio credentials not set.");
      return null;
    }
    let client;
    try {
      client = require("twilio")(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } catch (e) {
      console.error("❌ Could not init Twilio client:", e.message);
      return null;
    }

    // 1. Find an available local number — try the customer's area code first,
    //    then fall back to any US local number with SMS + voice.
    async function findNumber() {
      const tries = [];
      if (areaCode) tries.push({ areaCode: areaCode, smsEnabled: true, voiceEnabled: true, limit: 1 });
      tries.push({ smsEnabled: true, voiceEnabled: true, limit: 1 }); // any US local
      for (const opts of tries) {
        try {
          const list = await client.availablePhoneNumbers("US").local.list(opts);
          if (list && list.length > 0) return list[0].phoneNumber;
        } catch (e) {
          console.warn("⚠️  Number search failed (" + JSON.stringify(opts) + "): " + e.message);
        }
      }
      return null;
    }

    try {
      const phoneNumber = await findNumber();
      if (!phoneNumber) {
        console.warn("⚠️  No available local numbers found.");
        return null;
      }

      // 2. Buy it and wire webhooks to our app (voice = /voice, sms = /incoming-sms)
      const bought = await client.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
        voiceUrl:    APP_BASE_URL + "/voice",
        voiceMethod: "POST",
        smsUrl:      APP_BASE_URL + "/incoming-sms",
        smsMethod:   "POST",
        friendlyName: "ZeroMissCall trial " + phoneNumber,
      });

      // 3. Attach to the A2P Messaging Service so it can send (if configured)
      const msgSvc = process.env.TWILIO_MESSAGING_SERVICE_SID;
      if (msgSvc) {
        try {
          await client.messaging.v1.services(msgSvc)
            .phoneNumbers.create({ phoneNumberSid: bought.sid });
        } catch (e) {
          console.warn("⚠️  Bought " + phoneNumber + " but Messaging Service attach failed: " + e.message);
        }
      } else {
        console.warn("⚠️  TWILIO_MESSAGING_SERVICE_SID not set — " + phoneNumber + " bought but not attached to A2P campaign (SMS won't send yet).");
      }

      console.log("✅ Provisioned local number " + phoneNumber + " (sid " + bought.sid + ")");
      return phoneNumber;
    } catch (e) {
      console.error("❌ Number provisioning failed:", e.message);
      return null;
    }
  }

  app.post("/onboard", async (req, res) => {
    try {
      const body = req.body || {};

      // ── Normalise inputs ────────────────────────────────────
      const businessName = (body.businessName || "").trim();
      const ownerName    = (body.ownerName || "").trim();
      const email        = (body.email || "").trim().toLowerCase();
      const state        = (body.state || "").trim();

      // Normalise phone to E.164 (US default). Form sends raw digits.
      let ownerPhone = (body.ownerPhone || "").trim();
      const phoneDigits = ownerPhone.replace(/[^\d]/g, "");
      if (ownerPhone.startsWith("+")) {
        ownerPhone = "+" + phoneDigits;
      } else if (phoneDigits.length === 10) {
        ownerPhone = "+1" + phoneDigits;               // US 10-digit
      } else if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) {
        ownerPhone = "+" + phoneDigits;                // US 11-digit (1XXXXXXXXXX)
      } else {
        ownerPhone = phoneDigits ? "+" + phoneDigits : "";
      }

      // ── Field-by-field validation with clear, user-facing messages ──
      if (!businessName) {
        return res.status(400).json({ error: "Please enter your business name.", field: "businessName" });
      }
      if (!ownerName) {
        return res.status(400).json({ error: "Please enter your name.", field: "ownerName" });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address.", field: "email" });
      }
      if (!ownerPhone || ownerPhone.replace(/[^\d]/g, "").length < 10) {
        return res.status(400).json({ error: "Please enter a valid business phone number (e.g. 214-555-0123).", field: "ownerPhone" });
      }

      // ── Duplicate checks — specific, visible messages ───────
      const existingEmail = await db.collection("plumbers").findOne({ email: email });
      if (existingEmail) {
        return res.status(409).json({
          error: "That email is already registered. Try logging in, or use a different email.",
          field: "email",
        });
      }
      const existingPhone = await db.collection("plumbers").findOne({ ownerPhone: ownerPhone });
      if (existingPhone) {
        return res.status(409).json({
          error: "That phone number is already registered. If this is you, email hello@zeromisscall.com.",
          field: "ownerPhone",
        });
      }

      // ── Create the plumber as UNVERIFIED — no number bought yet ──
      // We only provision a paid number after the person confirms their email
      // (see GET /verify). This stops fake/spam signups from spending money.
      const { plumber } = await createPendingSignup(
        { db: db, db_helpers: db_helpers, emailService: emailService },
        { businessName: businessName, ownerName: ownerName, email: email, ownerPhone: ownerPhone, state: state }
      );

      console.log("New UNVERIFIED signup: " + plumber.businessName + " (" + plumber.email + ") - awaiting email confirmation");

      res.status(201).json({
        success: true,
        email: plumber.email,
        pendingVerification: true,
        message: "Almost there! Check your email to confirm and activate your account.",
      });
    } catch (err) {
      // Friendly translation of MongoDB duplicate-key errors (code 11000)
      if (err && err.code === 11000) {
        const dupKey = err.keyPattern ? Object.keys(err.keyPattern)[0] : "";
        if (dupKey === "email") {
          return res.status(409).json({ error: "That email is already registered.", field: "email" });
        }
        if (dupKey === "ownerPhone") {
          return res.status(409).json({ error: "That phone number is already registered.", field: "ownerPhone" });
        }
        if (dupKey === "twilioNumber") {
          // Shared trial number is unique-indexed and already in use by another trial.
          // See note in db.js ensureIndexes — this index must be made non-unique
          // before a second trial can be created on the shared number.
          console.error("⚠️ Onboard blocked: shared twilioNumber unique-index collision.");
          return res.status(503).json({
            error: "We can't auto-create your account right now. Email hello@zeromisscall.com and we'll set you up in minutes.",
          });
        }
        return res.status(409).json({ error: "An account with these details already exists." });
      }
      console.error("❌ Onboard error:", err.message);
      res.status(500).json({ error: "Something went wrong creating your account. Please try again, or email hello@zeromisscall.com." });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // GET /verify?token=...
  // Clicked from the verification email. This is where the real work happens:
  // provision the customer's dedicated number, start their trial, send the
  // welcome email. No paid number is ever bought until this point.
  // ───────────────────────────────────────────────────────────────────────
  function verifyPage(title, message, ctaUrl, ctaText) {
    var btn = ctaUrl
      ? "<a href=\"" + ctaUrl + "\" style=\"display:inline-block;margin-top:24px;background:#E8791A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;\">" + ctaText + "</a>"
      : "";
    return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
      "<title>" + title + "</title></head>" +
      "<body style=\"margin:0;background:#0b1928;font-family:Arial,Helvetica,sans-serif;\">" +
      "<div style=\"max-width:520px;margin:60px auto;background:#ffffff;border-radius:14px;padding:40px;text-align:center;\">" +
      "<h1 style=\"color:#0b1928;font-size:24px;margin:0 0 12px;\">" + title + "</h1>" +
      "<p style=\"color:#444444;font-size:16px;line-height:1.6;margin:0;\">" + message + "</p>" +
      btn + "</div></body></html>";
  }

  app.get("/verify", async (req, res) => {
    const token = (req.query.token || "").trim();
    if (!token) {
      return res.status(400).type("html").send(
        verifyPage("Invalid link", "This verification link is missing its token. Please use the button in your email.", SITE_URL, "Go to ZeroMissCall")
      );
    }

    try {
      const plumber = await db.collection("plumbers").findOne({ verificationToken: token });

      if (!plumber) {
        return res.status(404).type("html").send(
          verifyPage("Link not found", "This verification link is invalid or has already been used. If you've already confirmed, you're all set. Otherwise, try signing up again.", SITE_URL, "Go to ZeroMissCall")
        );
      }

      // Already verified — friendly no-op (e.g. they clicked the link twice)
      if (plumber.verified) {
        const dashUrl = APP_BASE_URL + "/dashboard/" + plumber.dashboardToken;
        return res.type("html").send(
          verifyPage("You're already set up", "Your email is confirmed and your account is active. Head to your dashboard to get going.", dashUrl, "Open my dashboard")
        );
      }

      // ── Provision the dedicated local number now (first real spend) ──
      const areaCode = (plumber.ownerPhone || "").replace(/[^\d]/g, "").replace(/^1/, "").substring(0, 3);
      let assignedNumber = await provisionLocalNumber(areaCode);
      if (!assignedNumber) {
        assignedNumber = DEFAULT_TRIAL_NUMBER;
        console.warn("⚠️  Falling back to shared number for " + plumber.email + " — assign a dedicated number manually.");
      }

      // ── Activate: set number, start a fresh 14-day trial, mark verified ──
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);

      await db.collection("plumbers").updateOne(
        { _id: plumber._id },
        { $set: {
            twilioNumber:      assignedNumber,
            verified:          true,
            verificationToken: null,        // single-use: consume it
            subscriptionStatus:"trial",
            trialStartDate:    now,
            trialEndDate:      trialEnd,
            updatedAt:         now,
          } }
      );

      const activated = { ...plumber, twilioNumber: assignedNumber, verified: true, trialEndDate: trialEnd };

      // ── Now send the welcome email + alerts (post-verification) ──
      try {
        await sendWelcomeEmail(activated, emailService);
        await db.collection("plumbers").updateOne({ _id: plumber._id }, { $set: { welcomeEmailSent: true } });
      } catch (e) {
        console.error("⚠️ Welcome email failed:", e.message);
      }
      try { await sendWelcomeSMS(activated); } catch (e) { console.error("⚠️ Welcome SMS failed:", e.message); }
      try { await notifyOwnerNewSignup(activated); } catch (e) { console.error("⚠️ Owner notify failed:", e.message); }
      try { await matchLeadToSignup(db, activated.email, activated.businessName); } catch (e) {}

      console.log("✅ VERIFIED & activated: " + activated.businessName + " (" + activated.email + ") on " + assignedNumber);

      const dashUrl = APP_BASE_URL + "/dashboard/" + plumber.dashboardToken;
      return res.type("html").send(
        verifyPage("You're all set, " + plumber.ownerName + "!",
          "Your email is confirmed and your free trial is now active. We've emailed you the 2-minute call-forwarding setup - do that and you're live.",
          dashUrl, "Open my dashboard")
      );
    } catch (err) {
      console.error("❌ Verify error:", err.message);
      return res.status(500).type("html").send(
        verifyPage("Something went wrong", "We couldn't confirm your email just now. Please try the link again, or email hello@zeromisscall.com and we'll sort it.", SITE_URL, "Go to ZeroMissCall")
      );
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
  // Single source of truth: delegate to the main template in email.js
  // (sendWelcomeEmail there includes the call-forwarding setup box and the
  // onboarding PDF attachment). Do NOT maintain a second welcome template here.
  if (!plumber || !plumber.email) return;
  return emailService.sendWelcomeEmail(plumber);
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

module.exports = { registerAdminRoutes, sendDailySummaryEmail, notifyOwnerLeadCaptured, notifyOwnerError, markLeadCustomerByEmail, createPendingSignup };

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
// STEP 6 — Send a sales invitation (also available as a form on
// the admin dashboard at /admin/dashboard?secret=...):
// POST /admin/invite?secret=zeromisscall123
// Content-Type: application/json
// Body: { "email": "prospect@example.com", "name": "Mike" }
//
// STEP 7 — Sales lead tracking (Step 4 of sales dashboard):
// Signups via /onboard or /admin/plumbers automatically flip a
// matching sales lead (by email) to TRIAL. Nothing to do.
//
// To also track TRIAL → CUSTOMER: in your Stripe webhook handler,
// at the point where you set subscriptionStatus to "active"
// (e.g. checkout.session.completed / invoice paid), add:
//   const { markLeadCustomerByEmail } = require("./admin");
//   await markLeadCustomerByEmail(db, plumber.email);
// Paste me your billing/webhook file and I'll place it exactly.
//
// ─────────────────────────────────────────────────────────────
