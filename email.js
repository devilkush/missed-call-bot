"use strict";
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_REPORTS = "ZeroMissCall <reports@zeromisscall.com>";
const FROM_IAN     = "Ian from ZeroMissCall <ian@zeromisscall.com>";
const SITE         = "https://zeromisscall.com";
const RAILWAY      = "https://missed-call-bot-production.up.railway.app";
const ORANGE       = "#E8791A";
const NAVY         = "#0b1928";
const GREEN        = "#3ecf8e";

// ─── SHARED WRAPPER ──────────────────────────────────────────────────────────
// Pure table-based layout. No divs for structure. No template literals.
// Light mode forced. Works on Gmail iOS, Apple Mail, Outlook.
// ─────────────────────────────────────────────────────────────────────────────
function wrap(body, preview) {
  var pre = preview
    ? "<div style='display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f7fb;'>" + preview + "</div>"
    : "";

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

    // Header
    "<tr><td class='hpad' bgcolor='" + NAVY + "' align='center' style='padding:28px 40px;border-radius:12px 12px 0 0;border-bottom:3px solid " + ORANGE + ";'>" +
    "<span style='font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:" + ORANGE + ";letter-spacing:-0.5px;'>zero</span>" +
    "<span style='font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;'>miss</span>" +
    "<span style='font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:" + ORANGE + ";letter-spacing:-0.5px;'>call</span>" +
    "</td></tr>" +

    // Body
    "<tr><td bgcolor='#ffffff' style='border-radius:0;'>" +
    body +
    "</td></tr>" +

    // Footer
    "<tr><td class='fpad' bgcolor='#0f2035' align='center' style='padding:24px 40px;border-radius:0 0 12px 12px;border-top:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8ba4bb;line-height:1.6;margin:0 0 6px 0;'>" +
    "ZeroMissCall &mdash; Never miss a customer again.<br/>" +
    "<a href='" + SITE + "' style='color:" + ORANGE + ";text-decoration:none;'>zeromisscall.com</a>" +
    "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4a6278;margin:0;line-height:1.6;'>" +
    "You are receiving this because you have an active ZeroMissCall account.<br/>" +
    "To update preferences, <a href='" + SITE + "/contact.html' style='color:#8ba4bb;'>contact us</a>." +
    "</p>" +
    "</td></tr>" +

    "</table>" +
    "</td></tr></table>" +
    "</body></html>"
  );
}

// ─── REUSABLE PARTS ──────────────────────────────────────────────────────────
function section(html) {
  return "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:32px 40px 0;'>" + html + "</td></tr></table>";
}

function sectionBottom(html) {
  return "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px;'>" + html + "</td></tr></table>";
}

function divider() {
  return "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td style='padding:0 40px;'><table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td height='1' bgcolor='#eeeeee' style='font-size:0;line-height:0;'>&nbsp;</td></tr></table></td></tr></table>";
}

function infoBox(borderColor, title, body, btnUrl, btnText, btnBg) {
  var btn = btnUrl
    ? "<table cellpadding='0' cellspacing='0' border='0' style='margin-top:16px;'><tr>" +
      "<td bgcolor='" + (btnBg || ORANGE) + "' style='border-radius:8px;'>" +
      "<a href='" + btnUrl + "' style='display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;'>" + btnText + "</a>" +
      "</td></tr></table>"
    : "";
  var heading = title
    ? "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;'>" + title + "</p>"
    : "";
  return (
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:20px;'><tr>" +
    "<td bgcolor='#f8f9fa' style='padding:18px 20px;border-radius:8px;border-left:4px solid " + borderColor + ";'>" +
    heading +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;line-height:1.7;margin:0;'>" + body + "</p>" +
    btn +
    "</td></tr></table>"
  );
}

function bigCta(url, text) {
  return (
    "<table cellpadding='0' cellspacing='0' border='0' align='center'><tr>" +
    "<td bgcolor='" + ORANGE + "' style='border-radius:8px;'>" +
    "<a href='" + url + "' style='display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;'>" + text + "</a>" +
    "</td></tr></table>"
  );
}

// 2-col stat row (dark background - for weekly/trial)
function statRow2Dark(n1, label1, color1, n2, label2, color2) {
  return (
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:8px;'><tr>" +
    "<td align='center' bgcolor='" + NAVY + "' width='49%' style='padding:20px 8px;border-radius:10px;border:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:900;color:" + color1 + ";margin:0;line-height:1;'>" + n1 + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8ba4bb;margin:8px 0 0 0;'>" + label1 + "</p>" +
    "</td>" +
    "<td width='8' style='width:8px;font-size:0;'></td>" +
    "<td align='center' bgcolor='" + NAVY + "' width='49%' style='padding:20px 8px;border-radius:10px;border:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:900;color:" + color2 + ";margin:0;line-height:1;'>" + n2 + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8ba4bb;margin:8px 0 0 0;'>" + label2 + "</p>" +
    "</td>" +
    "</tr></table>"
  );
}

// Full-width stat (dark background)
function statFullDark(value, label, color) {
  return (
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr>" +
    "<td align='center' bgcolor='" + NAVY + "' style='padding:20px 8px;border-radius:10px;border:1px solid #1a3550;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:900;color:" + color + ";margin:0;line-height:1;'>" + value + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8ba4bb;margin:8px 0 0 0;'>" + label + "</p>" +
    "</td></tr></table>"
  );
}

// 2-col stat row (light background - for monthly)
function statRow2Light(n1, label1, color1, n2, label2, color2, border2) {
  return (
    "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:8px;'><tr>" +
    "<td align='center' bgcolor='#f8f9fa' width='49%' style='padding:18px 8px;border-radius:10px;border:1px solid #eeeeee;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:900;color:" + color1 + ";margin:0;line-height:1;'>" + n1 + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;margin:8px 0 0 0;'>" + label1 + "</p>" +
    "</td>" +
    "<td width='8' style='width:8px;font-size:0;'></td>" +
    "<td align='center' bgcolor='#f8f9fa' width='49%' style='padding:18px 8px;border-radius:10px;border:1px solid " + (border2 || "#eeeeee") + ";'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:900;color:" + color2 + ";margin:0;line-height:1;'>" + n2 + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;margin:8px 0 0 0;'>" + label2 + "</p>" +
    "</td>" +
    "</tr></table>"
  );
}

// ─── CALL-FORWARDING HELPERS (shared by welcome + day-3 emails) ──────────────
// fwdDigits  -> bare 10-digit US number for star codes (e.g. 7135551234)
// fwdDisplay -> friendly display (e.g. +1 713 555 1234)
// Each customer has their own assigned number (plumber.twilioNumber), so these
// keep all forwarding instructions correct per-customer.
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

// ─── TEMPLATE A: WEEKLY DIGEST ───────────────────────────────────────────────
function buildWeeklyDigestEmail(plumber, stats) {
  var total   = stats.totalConversations;
  var leads   = stats.leadsCaptures;
  var revenue = stats.estimatedRevenue;
  var weekOf  = stats.weekOf;

  var body =
    section(
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#666666;margin:0 0 4px 0;'>Hey " + plumber.ownerName + ",</p>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0b1928;margin:0 0 6px 0;'>Your ZeroMissCall weekly summary</p>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:0;'>Week of " + weekOf + " &mdash; " + plumber.businessName + "</p>"
    ) +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px;'>" +
    statRow2Dark(total, "Calls Handled", ORANGE, leads, "Leads Captured", GREEN) +
    statFullDark("$" + revenue, "Estimated Revenue Recovered", GREEN) +
    "</td></tr></table>" +
    divider() +
    sectionBottom(
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#333333;line-height:1.7;margin:0 0 16px 0;'>" +
      "ZeroMissCall handled every one of those missed calls while you were out on the job. " +
      (leads > 0
        ? "<strong>" + leads + " customer" + (leads > 1 ? "s" : "") + " gave their details and " + (leads > 1 ? "are" : "is") + " ready to book.</strong>"
        : "Keep an eye on your texts for any follow-ups.") +
      "</p>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#999999;line-height:1.6;margin:0;'>Have a great week - we have got your calls covered.</p>"
    );

  return {
    subject: "Your ZeroMissCall Weekly Summary - " + total + " calls handled",
    html: wrap(body, "Last week: " + total + " missed calls handled, " + leads + " leads captured."),
  };
}

// ─── TEMPLATE B: TRIAL END ───────────────────────────────────────────────────
function buildTrialEndEmail(plumber, stats, conversations) {
  var total    = stats.totalConversations;
  var leads    = stats.leadsCaptures;
  var revenue  = stats.estimatedRevenue;
  var checkout = RAILWAY + "/billing/create-checkout/" + plumber.dashboardToken;

  var snippets = (conversations || []).filter(function(c) { return c.messages && c.messages.length >= 2; }).slice(0, 1);
  var convoHtml = "";
  if (snippets.length > 0) {
    var msgs = snippets[0].messages.slice(0, 4);
    convoHtml =
      "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:20px;'><tr>" +
      "<td bgcolor='#f8f9fa' style='padding:16px 20px;border-radius:8px;border-left:3px solid " + ORANGE + ";'>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px 0;'>Real conversation</p>" +
      msgs.map(function(m) {
        var isUser = m.role === "user";
        var text = m.content.length > 100 ? m.content.substring(0, 100) + "..." : m.content;
        return (
          "<table cellpadding='0' cellspacing='0' border='0' style='margin-bottom:8px;" + (isUser ? "" : "margin-left:auto;") + "'><tr>" +
          "<td bgcolor='" + (isUser ? "#e9ecef" : ORANGE) + "' style='padding:8px 12px;border-radius:10px;max-width:300px;'>" +
          "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:" + (isUser ? "#333333" : "#ffffff") + ";margin:0;line-height:1.5;'>" + text + "</p>" +
          "</td></tr></table>"
        );
      }).join("") +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;margin:8px 0 0 0;'>Customer numbers hidden for privacy.</p>" +
      "</td></tr></table>";
  }

  var body =
    // Dark hero
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr>" +
    "<td bgcolor='" + NAVY + "' align='center' style='padding:40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:64px;font-weight:900;color:" + ORANGE + ";margin:0;line-height:1;'>" + total + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#c8dce8;margin:8px 0;'>missed calls answered while you were on the job</p>" +
    (revenue > 0 ? "<p style='font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:" + GREEN + ";margin:0;'>Estimated $" + revenue + " in jobs recovered</p>" : "") +
    "</td></tr></table>" +

    section(
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#666666;margin:0 0 4px 0;'>Hey " + plumber.ownerName + ",</p>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0b1928;margin:0 0 16px 0;'>Your ZeroMissCall trial ends tomorrow.</p>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px 0;'>" +
      "During your trial, ZeroMissCall replied to <strong>" + total + " missed call" + (total !== 1 ? "s" : "") + "</strong>" +
      (leads > 0 ? " and captured <strong>" + leads + " lead" + (leads !== 1 ? "s" : "") + "</strong> with full contact details" : "") +
      ". Here is what some of those conversations looked like:" +
      "</p>"
    ) +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:0 40px 24px;'>" +
    convoHtml +
    "</td></tr></table>" +

    divider() +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:32px 40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#0b1928;margin:0 0 6px 0;'>Keep ZeroMissCall working for " + plumber.businessName + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#999999;margin:0 0 24px 0;'>$69/month - cancel anytime - no contracts</p>" +
    bigCta(checkout, "Keep ZeroMissCall Active") +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:16px 0 0 0;line-height:1.5;'>" +
    "If you do not upgrade, your number stops responding to missed calls tomorrow.<br/>" +
    "Questions? Reply to this email - Ian reads every one." +
    "</p>" +
    "</td></tr></table>";

  return {
    subject: "Your trial ends tomorrow - " + total + " calls handled for " + plumber.businessName,
    html: wrap(body, "Your trial ends tomorrow. Here is what ZeroMissCall captured for " + plumber.businessName + "."),
  };
}

// ─── TEMPLATE C: MONTHLY REPORT ──────────────────────────────────────────────
function buildMonthlyReportEmail(plumber, stats, monthName) {
  var total    = stats.totalConversations;
  var leads    = stats.leadsCaptures;
  var emerg    = stats.emergencies || 0;
  var revenue  = stats.estimatedRevenue;
  var jobs     = stats.topJobTypes || [];
  var best     = stats.bestConvo;
  var rate     = Math.round((leads / Math.max(total, 1)) * 100);
  var avgJob   = plumber.averageJobValue || 250;

  var bestHtml = "";
  if (best && best.messages) {
    bestHtml =
      "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:20px;'><tr>" +
      "<td bgcolor='#f8f9fa' style='padding:16px 20px;border-radius:8px;border-left:3px solid " + GREEN + ";'>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px 0;'>Best conversation this month</p>" +
      best.messages.slice(0, 6).map(function(m) {
        var isUser = m.role === "user";
        var text = m.content.length > 120 ? m.content.substring(0, 120) + "..." : m.content;
        return (
          "<table cellpadding='0' cellspacing='0' border='0' style='margin-bottom:8px;'><tr>" +
          "<td bgcolor='" + (isUser ? "#e9ecef" : ORANGE) + "' style='padding:8px 12px;border-radius:10px;max-width:300px;'>" +
          "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:" + (isUser ? "#333333" : "#ffffff") + ";margin:0;line-height:1.5;'>" + text + "</p>" +
          "</td></tr></table>"
        );
      }).join("") +
      (best.leadCaptured ? "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:" + GREEN + ";margin:8px 0 0 0;'>Lead captured - all 3 details collected</p>" : "") +
      "</td></tr></table>";
  }

  var jobsHtml = "";
  if (jobs.length > 0) {
    jobsHtml =
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;'>Top job types this month</p>" +
      jobs.map(function(j) {
        return (
          "<table width='100%' cellpadding='0' cellspacing='0' border='0' style='border-bottom:1px solid #eeeeee;'><tr>" +
          "<td style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;padding:8px 0;text-transform:capitalize;'>" + j.type + "</td>" +
          "<td align='right' style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:" + ORANGE + ";padding:8px 0;'>" + j.count + " " + (j.count === 1 ? "enquiry" : "enquiries") + "</td>" +
          "</tr></table>"
        );
      }).join("");
  }

  var body =
    // Dark hero
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr>" +
    "<td bgcolor='" + NAVY + "' align='center' style='padding:36px 40px;'>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;'>" + monthName + " Report &mdash; " + plumber.businessName + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c8dce8;margin:0 0 4px 0;'>Estimated revenue recovered</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:60px;font-weight:900;color:" + GREEN + ";margin:0;line-height:1;'>$" + revenue + "</p>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b84a0;margin:8px 0 0 0;'>Based on " + total + " missed calls x $" + avgJob + " avg job value</p>" +
    "</td></tr></table>" +

    // Stats 2x2
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:28px 40px 20px;'>" +
    statRow2Light(total, "Calls Handled", ORANGE, leads, "Leads Captured", GREEN) +
    statRow2Light(rate + "%", "Lead Capture Rate", NAVY, emerg, "Emergency Alerts", emerg > 0 ? "#e53e3e" : NAVY, emerg > 0 ? "#fed7d7" : "#eeeeee") +
    "</td></tr></table>" +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:0 40px 24px;'>" +
    bestHtml + jobsHtml +
    "</td></tr></table>" +

    divider() +

    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px 32px;'>" +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'>" +
    "<tr><td style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;padding:6px 0;'>Next billing date</td><td align='right' style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;padding:6px 0;'>1st of next month</td></tr>" +
    "<tr><td style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;padding:6px 0;'>Monthly subscription</td><td align='right' style='font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0b1928;padding:6px 0;'>$69.00</td></tr>" +
    "</table>" +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999;margin:16px 0 0 0;line-height:1.6;'>" +
    "Questions about your account? Reply to this email or visit <a href='" + SITE + "/contact.html' style='color:" + ORANGE + ";'>zeromisscall.com/contact</a>" +
    "</p>" +
    "</td></tr></table>";

  return {
    subject: plumber.businessName + " - Your " + monthName + " ZeroMissCall Report",
    html: wrap(body, plumber.businessName + " - your " + monthName + " report. Estimated $" + revenue + " recovered."),
  };
}

// ─── TEMPLATE D: WELCOME ─────────────────────────────────────────────────────
function buildWelcomeEmail(plumber, trialEnd) {
  var dash = RAILWAY + "/dashboard/" + plumber.dashboardToken;

  var body =
    section(
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0b1928;margin:0 0 10px 0;'>Welcome, " + plumber.ownerName + "!</p>" +
      "<p style='font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px 0;'>Your 14-day free trial for <strong>" + plumber.businessName + "</strong> is now active. ZeroMissCall will automatically reply to every missed call starting right now.</p>"
    ) +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:0 40px 24px;'>" +
    infoBox(ORANGE, "Here is what happens when someone calls and you miss it:",
      "1. &nbsp;They hear a friendly voice message<br/>" +
      "2. &nbsp;They get a text within 60 seconds<br/>" +
      "3. &nbsp;Our AI handles the conversation<br/>" +
      "4. &nbsp;You get an alert when a lead is captured<br/>" +
      "5. &nbsp;You call them back ready to close the job"
    ) +
    infoBox(ORANGE, "",
      "<strong>Your trial runs until " + trialEnd + ".</strong> After that it is just $69/month - cancel anytime, no contracts. We will email you the day before your trial ends with a full summary."
    ) +
    divider() +
    "</td></tr></table>" +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' style='padding:24px 40px;'>" +
    infoBox(ORANGE, "&#9889; Step 1: Turn on call forwarding (2 minutes &mdash; do this first)",
      forwardingInstructionsHtml(plumber)
    ) +
    infoBox(GREEN, "Your personal dashboard",
      "Bookmark this link. It is how you view your conversations, captured leads, and account settings.",
      dash, "View My Dashboard", NAVY
    ) +
    infoBox(NAVY, "Before you go live - takes 2 minutes",
      "Log in to your dashboard and update these details so the AI gives accurate answers:<br/><br/>" +
      "<strong>Service area</strong> - what city or region do you cover?<br/>" +
      "<strong>Business hours</strong> - when are you available?<br/>" +
      "<strong>Average job value</strong> - used for your revenue stats<br/>" +
      "<strong>Services</strong> - drain, boiler, leak detection etc.",
      dash, "Update My Settings", ORANGE
    ) +
    "</td></tr></table>" +
    divider() +
    "<table width='100%' cellpadding='0' cellspacing='0' border='0'><tr><td class='pad' align='center' style='padding:32px 40px;'>" +
    bigCta(SITE, "Visit ZeroMissCall") +
    "<p style='font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#999999;line-height:1.6;margin:20px 0 0 0;'>Questions? Just reply to this email - Ian reads every one.<br/><strong style='color:#444444;'>Ian from ZeroMissCall</strong></p>" +
    "</td></tr></table>";

  return {
    subject: "Welcome to ZeroMissCall - your trial is active, " + plumber.ownerName + "!",
    html: wrap(body, "Your ZeroMissCall trial is active. Here is everything you need to get started."),
  };
}

// ─── SEND FUNCTIONS ──────────────────────────────────────────────────────────

async function sendWelcomeEmail(plumber) {
  if (!plumber.email) return;
  var trialEnd = plumber.trialEndDate
    ? new Date(plumber.trialEndDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "in 14 days";
  var t = buildWelcomeEmail(plumber, trialEnd);
  var r = await resend.emails.send({
    from: FROM_IAN,
    to: plumber.email,
    subject: t.subject,
    html: t.html,
  });
  console.log("Welcome email sent to " + plumber.email);
  return r;
}

async function sendWeeklyDigest(plumber, stats) {
  if (!plumber.email) return;
  var t = buildWeeklyDigestEmail(plumber, stats);
  var r = await resend.emails.send({ from: FROM_REPORTS, to: plumber.email, subject: t.subject, html: t.html });
  console.log("Weekly digest sent to " + plumber.email);
  return r;
}

async function sendTrialEndEmail(plumber, stats, conversations) {
  if (!plumber.email) return;
  var t = buildTrialEndEmail(plumber, stats, conversations);
  var r = await resend.emails.send({ from: FROM_IAN, to: plumber.email, subject: t.subject, html: t.html });
  console.log("Trial end email sent to " + plumber.email);
  return r;
}

async function sendMonthlyReport(plumber, stats, monthName) {
  if (!plumber.email) return;
  var t = buildMonthlyReportEmail(plumber, stats, monthName);
  var r = await resend.emails.send({ from: FROM_REPORTS, to: plumber.email, subject: t.subject, html: t.html });
  console.log("Monthly report sent to " + plumber.email);
  return r;
}

async function sendTestEmails(toEmail) {
  var p = {
    businessName: "Dave's Plumbing Co.", ownerName: "Dave", email: toEmail,
    averageJobValue: 250, dashboardToken: "test-token-123",
    trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  };
  var s = {
    totalConversations: 9, leadsCaptures: 6, emergencies: 1,
    estimatedRevenue: 2250, weekOf: "May 26 - Jun 1, 2026",
    topJobTypes: [{ type: "drain", count: 4 }, { type: "boiler", count: 3 }, { type: "leak", count: 2 }],
    bestConvo: {
      leadCaptured: true,
      messages: [
        { role: "assistant", content: "Hey! Thanks for calling Dave's Plumbing - sorry we missed you. What do you need?" },
        { role: "user",      content: "Hi yeah my kitchen drain is completely blocked, water isn't going down at all" },
        { role: "assistant", content: "That sounds frustrating! We can definitely sort that out. What's your zip code?" },
        { role: "user",      content: "75201" },
      ],
    },
  };
  await sendWelcomeEmail(p);
  await sendWeeklyDigest(p, s);
  await sendTrialEndEmail(p, s, [s.bestConvo]);
  await sendMonthlyReport(p, s, "May 2026");
  console.log("All 4 test emails sent to " + toEmail);
}

module.exports = {
  sendWelcomeEmail, sendWeeklyDigest, sendTrialEndEmail, sendMonthlyReport, sendTestEmails,
  buildWelcomeEmail, buildWeeklyDigestEmail, buildTrialEndEmail, buildMonthlyReportEmail,
};
