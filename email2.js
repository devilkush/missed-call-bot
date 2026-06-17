"use strict";
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

var FROM_REPORTS = "ZeroMissCall <reports@zeromisscall.com>";
var FROM_IAN     = "Ian from ZeroMissCall <ian@zeromisscall.com>";
var SITE         = "https://zeromisscall.com";
var RAILWAY      = "https://missed-call-bot-production.up.railway.app";
var ORANGE       = "#E8791A";
var NAVY         = "#0b1928";
var GREEN        = "#3ecf8e";

// ─── WRAP (identical to email.js) ────────────────────────────────────────────
// footerNote is optional - defaults to the standard "active account" line.
// The invitation email passes a custom line because recipients are prospects,
// not customers. All existing emails call wrap(body, preview) and are unchanged.
function wrap(body, preview, footerNote) {
  var pre = preview
    ? "<div style='display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f7fb;'>" + preview + "</div>"
    : "";
  var footer = footerNote || "You are receiving this because you have an active ZeroMissCall account.";
  return (
    "<!DOCTYPE html>" +
    "<html lang='en'>" +
    "<head>" +
    "<meta charset='UTF-8'/>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>" +
    "<meta name='color-scheme' content='light'/>" +
    "<meta name='supported-color-schemes' content='light'/>" +
    "<title>ZeroMissCall</title>" +
    "<style>" +
    ":root{color-scheme:light only;supported-color-schemes:light only;}" +
    "body,table,td,p,a,li{-webkit-text-size-adjust:100%;}" +
    "table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}" +
    "body{margin:0;padding:0;background-color:#f4f7fb;}" +
    "@media only screen and (max-width:600px){" +
    ".wrap{width:100%!important;}" +
    ".pad{padding:24px 20px!important;}" +
    ".hpad{padding:24px 20px!important;}" +
    ".fpad{padding:20px!important;}" +
    "}" +
    "</style>" +
    "</head>" +
    "<body style='margin:0;padding:0;background-color:#f4f7fb;'>" +
    pre +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#f4f7fb'>" +
    "<tr><td align='center' style='padding:32px 16px;'>" +
    "<table class='wrap' width='560' cellpadding='0' cellspacing='0' border='0' style='max-width:560px;width:100%;'>" +
    "<tr><td class='hpad' bgcolor='" + NAVY + "' align='center' style='padding:28px 40px;border-radius:12px 12px 0 0;border-bottom:3px solid " + ORANGE + ";'>" +
    "<span style='font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:" + ORANGE + ";letter-spacing:-0.5px;'>zero</span>" +
    "<span style='font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;'>miss</span>" +
    "<span style='font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:" + ORANGE + ";letter-spacing:-0.5px;'>call</span>" +
    "</td></tr>" +
    "<tr><td bgcolor='#ffffff'>" +
    body +
    "</td></tr>" +
    "<tr><td class='fpad' bgcolor='#0f2035' align='center' style='padding:24px 40px;border-radius:0 0 12px 12px;border-top:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8ba4bb;line-height:1.6;margin:0 0 6px 0;'>" +
    "ZeroMissCall &mdash; Never miss a customer again.<br/>" +
    "<a href='" + SITE + "' style='color:" + ORANGE + ";text-decoration:none;'>zeromisscall.com</a>" +
    "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4a6278;margin:0;line-height:1.6;'>" +
    footer + "<br/>" +
    "To update preferences, <a href='" + SITE + "/contact.html' style='color:#8ba4bb;'>contact us</a>." +
    "</p>" +
    "</td></tr>" +
    "</table>" +
    "</td></tr></table>" +
    "</body></html>"
  );
}

function section(html) {
  return "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:32px 40px 0;'>" + html + "</td></tr></table>";
}

function sectionFull(html) {
  return "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px;'>" + html + "</td></tr></table>";
}

function divider() {
  return "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td style='padding:0 40px;'><table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td height='1' bgcolor='#eeeeee' style='font-size:0;line-height:0;'>&nbsp;</td></tr></table></td></tr></table>";
}

function infoBox(borderColor, title, body) {
  var heading = title
    ? "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;'>" + title + "</p>"
    : "";
  return (
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:20px;'><tr>" +
    "<td bgcolor='#f8f9fa' style='padding:18px 20px;border-radius:8px;border-left:4px solid " + borderColor + ";'>" +
    heading +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;line-height:1.7;margin:0;'>" + body + "</p>" +
    "</td></tr></table>"
  );
}

function bigCta(url, text, bg) {
  var bgColor = bg || ORANGE;
  return (
    "<table cellpadding='0' cellspacing='0' border='0' align='center'><tr>" +
    "<td bgcolor='" + bgColor + "' style='border-radius:8px;'>" +
    "<a href='" + url + "' style='display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;'>" + text + "</a>" +
    "</td></tr></table>"
  );
}

function greeting(name) {
  return "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#666666;margin:0 0 4px 0;'>Hey " + name + ",</p>";
}

function bodyText(text) {
  return "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 16px 0;'>" + text + "</p>";
}

function muted(text) {
  return "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;line-height:1.6;margin:0;'>" + text + "</p>";
}

// ─── CALL-FORWARDING HELPERS (kept identical to email.js) ────────────────────
// fwdDigits  -> bare 10-digit US number for star codes (e.g. 7135551234)
// fwdDisplay -> friendly display (e.g. +1 713 555 1234)
// Each customer has their own assigned number (plumber.twilioNumber).
function fwdDigits(plumber) {
  var raw = (plumber && plumber.twilioNumber) ? String(plumber.twilioNumber) : "";
  var digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.substring(1);
  return digits;
}
function fwdDisplay(plumber) {
  var d = fwdDigits(plumber);
  if (d.length === 10) return "+1 " + d.substring(0, 3) + " " + d.substring(3, 6) + " " + d.substring(6);
  return (plumber && plumber.twilioNumber) ? String(plumber.twilioNumber) : "";
}
// The full conditional-forwarding instructions, dynamic per customer.
function forwardingInstructionsHtml(plumber) {
  var num = fwdDigits(plumber);
  var disp = fwdDisplay(plumber);
  var codeStyle = "font-family:Consolas,Menlo,Courier,monospace;background:#fff3e6;color:#0b1928;padding:3px 7px;border-radius:4px;font-weight:700;";
  return (
    "This is the one step that makes everything work. You need to forward the calls you <strong>miss</strong> to your ZeroMissCall number, so the AI can text those callers back for you.<br/><br/>" +
    "<strong>Your ZeroMissCall number: " + disp + "</strong><br/><br/>" +
    "Open your phone's keypad, type the code for your carrier exactly as shown (no spaces), then press call:<br/><br/>" +
    "<strong>Verizon:</strong> &nbsp;<span style=\"" + codeStyle + "\">*71 " + num + "</span><br/><br/>" +
    "<strong>AT&amp;T or T-Mobile:</strong> &nbsp;<span style=\"" + codeStyle + "\">*61*" + num + "#</span><br/><br/>" +
    "<strong>Not sure / other carrier:</strong> &nbsp;<span style=\"" + codeStyle + "\">*61*" + num + "#</span><br/><br/>" +
    "You'll hear a short confirmation tone &mdash; that's it. Your phone still rings normally, and only the calls you <strong>don't answer</strong> get forwarded to the AI.<br/><br/>" +
    "<strong>&#9888;&#65039; Don't use &lsquo;forward all calls&rsquo;</strong> (Verizon <strong>*72</strong>, AT&amp;T/T-Mobile <strong>*21*</strong>). Those send <em>every</em> call straight to the AI and your phone never rings. The iPhone toggle under Settings &gt; Phone &gt; Call Forwarding does the same thing &mdash; so skip it and use the code above instead.<br/><br/>" +
    "<strong>&#9989; Test it:</strong> from another phone, call your business number, let it ring out <em>without</em> answering, and you should get a ZeroMissCall text within a minute. If you do &mdash; you're live.<br/><br/>" +
    "<span style=\"font-size:13px;color:#888888;\">To switch forwarding off later: Verizon dial <strong>*73</strong>; AT&amp;T/T-Mobile dial <strong>#61#</strong>.</span>"
  );
}

// ─── EMAIL 1: DAY 3 CHECK-IN ─────────────────────────────────────────────────
// Sends on day 3 of trial if no calls have come in yet
// Purpose: catch plumbers who signed up but never set up call forwarding
// ─────────────────────────────────────────────────────────────────────────────
function buildDay3CheckinEmail(plumber) {
  var dash = RAILWAY + "/dashboard/" + plumber.dashboardToken;

  var body =
    section(
      greeting(plumber.ownerName) +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0b1928;margin:0 0 16px 0;'>Is ZeroMissCall set up on your phone?</p>" +
      bodyText("You signed up 3 days ago but we have not seen any missed calls come through yet. That usually means call forwarding has not been set up on your phone.") +
      bodyText("Call forwarding is the one step that makes everything work. It only takes 2 minutes.")
    ) +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:20px 40px;'>" +
    infoBox(ORANGE, "&#9889; Turn on call forwarding (2 minutes)",
      forwardingInstructionsHtml(plumber)
    ) +
    "</td></tr></table>" +
    divider() +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:28px 40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;margin:0 0 20px 0;'>Once forwarding is on, test it by missing a call from a friend. You should see the conversation appear in your dashboard within 60 seconds.</p>" +
    bigCta(dash, "View My Dashboard", NAVY) +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:16px 0 0 0;line-height:1.5;'>Need help setting it up? Just reply to this email - Ian will walk you through it.</p>" +
    "</td></tr></table>";

  return {
    subject: "Is ZeroMissCall set up on your phone, " + plumber.ownerName + "?",
    html: wrap(body, "You signed up 3 days ago but we have not seen any missed calls yet. Here is how to set up call forwarding."),
  };
}

// ─── EMAIL 2: FIRST LEAD CAPTURED ────────────────────────────────────────────
// Fires the moment the AI captures the first lead for a plumber
// Purpose: make the product feel real, drive excitement, push toward upgrade
// ─────────────────────────────────────────────────────────────────────────────
function buildFirstLeadEmail(plumber, lead) {
  var dash     = RAILWAY + "/dashboard/" + plumber.dashboardToken;
  var checkout = RAILWAY + "/billing/create-checkout/" + plumber.dashboardToken;
  var jobDesc  = lead.jobDescription || "a plumbing job";
  var zip      = lead.callerZip      || "unknown zip";
  var phone    = lead.callerNumber   || "unknown number";

  var body =
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr>" +
    "<td bgcolor='" + NAVY + "' align='center' style='padding:36px 40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;'>First Lead Captured</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:40px;font-weight:900;color:" + GREEN + ";margin:0;line-height:1;'>You just got a lead!</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c8dce8;margin:10px 0 0 0;'>ZeroMissCall captured your first job enquiry</p>" +
    "</td></tr></table>" +

    section(
      greeting(plumber.ownerName) +
      bodyText("While you were out on the job, someone called and ZeroMissCall captured a lead for you. Here are the details:") +
      infoBox(GREEN, "Lead Details",
        "<b>Phone:</b> " + phone + "<br/>" +
        "<b>Job needed:</b> " + jobDesc + "<br/>" +
        "<b>Location:</b> Zip " + zip
      ) +
      bodyText("Call them back as soon as you can - leads convert best when you follow up within the hour.")
    ) +
    divider() +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:28px 40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 6px 0;'>See the full conversation</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;margin:0 0 20px 0;'>Your dashboard shows the complete thread with everything the customer said.</p>" +
    bigCta(dash, "View My Dashboard", NAVY) +
    "</td></tr></table>" +
    divider() +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px;'>" +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='background-color:#fff8f2;border-radius:8px;border-left:4px solid " + ORANGE + ";'><tr>" +
    "<td style='padding:18px 20px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 8px 0;'>This is what ZeroMissCall does every day</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;line-height:1.7;margin:0 0 16px 0;'>Every missed call gets the same treatment. That lead you just saw would have gone to a competitor 10 minutes ago without ZeroMissCall. Keep it running after your trial for just $69/month.</p>" +
    bigCta(checkout, "Upgrade - Keep ZeroMissCall Active") +
    "</td></tr></table>" +
    "</td></tr></table>";

  return {
    subject: "You just got a lead - " + plumber.businessName,
    html: wrap(body, "ZeroMissCall just captured a lead for " + plumber.businessName + ". Here are the details."),
  };
}

// ─── EMAIL 3: PAYMENT FAILED ─────────────────────────────────────────────────
// Fires when Stripe invoice.payment_failed webhook fires
// Purpose: recover failed payments before account deactivates
// ─────────────────────────────────────────────────────────────────────────────
function buildPaymentFailedEmail(plumber) {
  var portal   = RAILWAY + "/billing/portal/" + plumber.dashboardToken;
  var checkout = RAILWAY + "/billing/create-checkout/" + plumber.dashboardToken;

  var body =
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr>" +
    "<td bgcolor='#7f1d1d' align='center' style='padding:28px 40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fca5a5;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;'>Action Required</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0;line-height:1.3;'>Your payment did not go through</p>" +
    "</td></tr></table>" +

    section(
      greeting(plumber.ownerName) +
      bodyText("We tried to charge your card for your ZeroMissCall subscription but the payment failed. This can happen if your card expired, has insufficient funds, or your bank blocked the charge.") +
      bodyText("ZeroMissCall is still active right now, but if we cannot collect payment your account will be paused and missed calls will stop getting text-backs.")
    ) +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:16px 40px 28px;'>" +
    infoBox("#e53e3e", "What you need to do",
      "Update your payment details in the billing portal. It takes less than 2 minutes and your account will stay active with no interruption."
    ) +
    "</td></tr></table>" +
    divider() +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:28px 40px;'>" +
    bigCta(portal, "Update Payment Details") +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:16px 0 0 0;line-height:1.5;'>" +
    "If you have any trouble, just reply to this email and Ian will sort it out for you." +
    "</p>" +
    "</td></tr></table>";

  return {
    subject: "Action required - ZeroMissCall payment failed for " + plumber.businessName,
    html: wrap(body, "Your ZeroMissCall payment did not go through. Update your card to keep your account active."),
  };
}

// ─── EMAIL 4: CANCELLATION WIN-BACK ──────────────────────────────────────────
// Fires 3 days after customer.subscription.deleted webhook
// Purpose: win back cancelled customers with their own stats
// ─────────────────────────────────────────────────────────────────────────────
function buildWinBackEmail(plumber, stats) {
  var total    = (stats && stats.totalConversations) || 0;
  var leads    = (stats && stats.leadsCaptures)      || 0;
  var revenue  = (stats && stats.estimatedRevenue)   || 0;
  var checkout = RAILWAY + "/billing/create-checkout/" + plumber.dashboardToken;

  var body =
    section(
      greeting(plumber.ownerName) +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0b1928;margin:0 0 16px 0;'>We miss you - and so do your customers</p>" +
      bodyText("You cancelled your ZeroMissCall subscription 3 days ago. Since then, every missed call has gone unanswered. We wanted to share what ZeroMissCall did for " + plumber.businessName + " while it was active:")
    ) +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:20px 40px;'>" +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:8px;'><tr>" +
    "<td align='center' bgcolor='" + NAVY + "' width='49%' style='padding:20px 8px;border-radius:10px;border:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:900;color:" + ORANGE + ";margin:0;line-height:1;'>" + total + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8ba4bb;margin:8px 0 0 0;'>Calls Handled</p>" +
    "</td>" +
    "<td width='8' style='width:8px;font-size:0;'></td>" +
    "<td align='center' bgcolor='" + NAVY + "' width='49%' style='padding:20px 8px;border-radius:10px;border:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:900;color:" + GREEN + ";margin:0;line-height:1;'>" + leads + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8ba4bb;margin:8px 0 0 0;'>Leads Captured</p>" +
    "</td>" +
    "</tr></table>" +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr>" +
    "<td align='center' bgcolor='" + NAVY + "' style='padding:20px 8px;border-radius:10px;border:1px solid #1a3550;margin-top:8px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:900;color:" + GREEN + ";margin:0;line-height:1;'>$" + revenue + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8ba4bb;margin:8px 0 0 0;'>Estimated Revenue Recovered</p>" +
    "</td></tr></table>" +
    "</td></tr></table>" +

    divider() +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px;'>" +
    infoBox(ORANGE, "Come back for just $69/month",
      "No setup fee. No contract. Cancel anytime. Every missed call gets a text-back within 60 seconds from the moment you reactivate."
    ) +
    "</td></tr></table>" +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:0 40px 32px;'>" +
    bigCta(checkout, "Reactivate ZeroMissCall") +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:16px 0 0 0;line-height:1.5;'>" +
    "Questions or feedback on why you cancelled? Reply to this email - Ian reads every one." +
    "</p>" +
    "</td></tr></table>";

  return {
    subject: "You cancelled - here is what ZeroMissCall did for " + plumber.businessName,
    html: wrap(body, "Here is what ZeroMissCall captured for " + plumber.businessName + " while it was active."),
  };
}

// ─── EMAIL 5: SALES INVITATION ───────────────────────────────────────────────
// Sent manually from the admin dashboard after a sales call
// Purpose: get a warm prospect to sign up while the call is fresh
// name is OPTIONAL - falls back to a generic greeting/subject if blank
// ─────────────────────────────────────────────────────────────────────────────
function buildInvitationEmail(name) {
  var hasName  = name && String(name).trim().length > 0;
  var safeName = hasName ? String(name).trim() : "";
  var signup   = SITE + "/signup.html";

  var body =
    section(
      greeting(hasName ? safeName : "there") +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0b1928;margin:0 0 16px 0;'>Great speaking with you today</p>" +
      bodyText("As promised, here is your link to get started with ZeroMissCall. Your 14-day free trial is ready - no card needed to start, and setup takes about 2 minutes.") +
      bodyText("From the moment you are set up, every call you miss gets an instant text-back. Our AI chats with the customer, finds out what job they need, and sends you the lead - so the work stays with you instead of going to the next plumber on Google.")
    ) +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:20px 40px;'>" +
    infoBox(ORANGE, "What happens when you sign up",
      "1. Fill in your business details (takes 2 minutes)<br/>" +
      "2. We send you a quick setup guide for call forwarding<br/>" +
      "3. Your missed calls start getting answered automatically<br/>" +
      "4. You get every lead by text and in your dashboard"
    ) +
    infoBox("#0b1928", "The numbers",
      "<b>14-day free trial</b> - try it on real calls first<br/>" +
      "<b>$69/month</b> after the trial<br/>" +
      "<b>No contract</b> - cancel anytime<br/>" +
      "One recovered job usually pays for months of service"
    ) +
    "</td></tr></table>" +
    divider() +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:28px 40px;'>" +
    bigCta(signup, "Start My Free Trial") +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:16px 0 0 0;line-height:1.5;'>" +
    "Any questions at all? Just reply to this email - it comes straight to Ian." +
    "</p>" +
    "</td></tr></table>";

  var subject = hasName
    ? "Your ZeroMissCall free trial is ready, " + safeName
    : "Your ZeroMissCall free trial is ready";

  return {
    subject: subject,
    html: wrap(
      body,
      "Great speaking with you today. Here is your link to start your 14-day free ZeroMissCall trial.",
      "You are receiving this because you spoke with Ian from ZeroMissCall."
    ),
  };
}

// ─── SEND FUNCTIONS ──────────────────────────────────────────────────────────
async function sendDay3Checkin(plumber) {
  if (!plumber.email) return;
  var t = buildDay3CheckinEmail(plumber);
  var r = await resend.emails.send({ from: FROM_IAN, to: plumber.email, subject: t.subject, html: t.html });
  console.log("Day 3 checkin sent to " + plumber.email);
  return r;
}

async function sendFirstLeadEmail(plumber, lead) {
  if (!plumber.email) return;
  var t = buildFirstLeadEmail(plumber, lead);
  var r = await resend.emails.send({ from: FROM_IAN, to: plumber.email, subject: t.subject, html: t.html });
  console.log("First lead email sent to " + plumber.email);
  return r;
}

async function sendPaymentFailedEmail(plumber) {
  if (!plumber.email) return;
  var t = buildPaymentFailedEmail(plumber);
  var r = await resend.emails.send({ from: FROM_REPORTS, to: plumber.email, subject: t.subject, html: t.html });
  console.log("Payment failed email sent to " + plumber.email);
  return r;
}

async function sendWinBackEmail(plumber, stats) {
  if (!plumber.email) return;
  var t = buildWinBackEmail(plumber, stats);
  var r = await resend.emails.send({ from: FROM_IAN, to: plumber.email, subject: t.subject, html: t.html });
  console.log("Win-back email sent to " + plumber.email);
  return r;
}

async function sendInvitationEmail(toEmail, name) {
  if (!toEmail) return;
  var t = buildInvitationEmail(name);
  var r = await resend.emails.send({ from: FROM_IAN, to: toEmail, subject: t.subject, html: t.html });
  console.log("Invitation email sent to " + toEmail + (name ? " (" + name + ")" : ""));
  return r;
}

// ─── TEST SEND - fires all 4 to one address ──────────────────────────────────
async function sendTestEmails2(toEmail) {
  var p = {
    businessName:   "Dave's Plumbing Co.",
    ownerName:      "Dave",
    email:          toEmail,
    averageJobValue: 250,
    dashboardToken: "test-token-123",
    trialEndDate:   new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
  };
  var lead = {
    callerNumber:   "+15551234567",
    jobDescription: "kitchen drain completely blocked",
    callerZip:      "75201",
  };
  var stats = {
    totalConversations: 9,
    leadsCaptures:      6,
    estimatedRevenue:   2250,
  };
  await sendDay3Checkin(p);
  await sendFirstLeadEmail(p, lead);
  await sendPaymentFailedEmail(p);
  await sendWinBackEmail(p, stats);
  console.log("All 4 email2 test emails sent to " + toEmail);
}

// ─── TEST SEND - invitation only (named + unnamed versions) ──────────────────
async function sendTestInvitation(toEmail) {
  await sendInvitationEmail(toEmail, "Mike");
  await sendInvitationEmail(toEmail, "");
  console.log("Both invitation test emails (named + generic) sent to " + toEmail);
}

module.exports = {
  sendDay3Checkin,
  sendFirstLeadEmail,
  sendPaymentFailedEmail,
  sendWinBackEmail,
  sendInvitationEmail,
  sendTestEmails2,
  sendTestInvitation,
};
