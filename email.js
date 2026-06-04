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
    infoBox(GREEN, "Your personal dashboard",
      "Bookmark this link. It is how you view your conversations, captured leads, and account settings.",
      dash, "View My Dashboard", NAVY
    ) +
    infoBox(GREEN, "Setup guide attached",
      "We have attached a PDF setup guide to this email. It includes step-by-step call forwarding instructions for iPhone and Android, plus a full dashboard walkthrough. Save it to your phone.",
      null, null, null
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
// Onboarding guide PDF - base64 encoded
var ONBOARDING_PDF_B64 = "JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNSAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0NvbnRlbnRzIDE1IDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTQgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db250ZW50cyAxNiAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE0IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9Db250ZW50cyAxNyAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE0IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9Db250ZW50cyAxOCAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE0IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db250ZW50cyAxOSAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDE0IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iagoxMCAwIG9iago8PAovQ29udGVudHMgMjAgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCAxNCAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTEgMCBvYmoKPDwKL0NvbnRlbnRzIDIxIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTQgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjEyIDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgMTQgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagoxMyAwIG9iago8PAovQXV0aG9yIChcKGFub255bW91c1wpKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNjA0MTkyMzM2KzAwJzAwJykgL0NyZWF0b3IgKFwodW5zcGVjaWZpZWRcKSkgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNjA0MTkyMzM2KzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKFwodW5zcGVjaWZpZWRcKSkgL1RpdGxlIChcKGFub255bW91c1wpKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjE0IDAgb2JqCjw8Ci9Db3VudCA3IC9LaWRzIFsgNCAwIFIgNiAwIFIgNyAwIFIgOCAwIFIgOSAwIFIgMTAgMCBSIDExIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKMTUgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggODQ5Cj4+CnN0cmVhbQpHYXQ9aD51MDMvJ1NjKUovJ1xTOitRPCxIOjshV0VMYG9LXlsjUltqJy9xJ2hENzRoVl91VlVbYTclWXA+IlNrRjpvaFVETzNkXmFTQ19APG5cYjlDPFdSUz1pNj1hck4naFVmOUcuWlJCL2lQOWdPTyxiVURUNkI2dCg+RWZVaVtzMzZeN2E2clArKSN0LjY8QTNedUM9dHNdVyFAaz1VQkZJSWRKZktHYUskcWdzKCkhYFk+WV08IXIqZT1BOUA3bVtCaXVLQ25lNzByMzgiWypdWXQiIihBIT9VZkhPM0JSIyQ4UDtQQjQtPDNbJkw3UHVyQWtualNITiZpLy8sV3RIVWdKayYoJFkwJmtTRyxIaVtcU3JjQi9yQztjY1BnRmRvRmVEVDdWYiEoajhSSURUMD43UFMwcmBcNyVKMjFbVGcjKCVpMVxSTj8zUkVqLSEoKV5wVisiJTxaaDY8Mk9LMjtQRkhIVEM1bUFNaUVJVkRSOEFabypEYkhYLUxAUy9LJjMjSVdHbSFLVUppLiRTWyosOjtKRk5SMEo/TyVLWi9BcjV0Y2UqR0ZJQ0dIOSM9ZmE/a29dYDM4NS5PWE1FLypNUDMvaUVOLiNxZSVQYFE+UT1OLDp0RUI7JFUyX2lVKy1NUEdscyIpMjltTFMsalUtO048S0o4LXVVUDkkSD5UJ1gkbmVnWk1ec3IxNSpVQkxHKl9KOGRRQztqR3JuOiJhY1plQFFYYXV1JUpHUF1DcEAqTyhoQEchU0cmW2w2cGc8SFVVXGN1QXI8WVgiPmJ1VyQ6clloN2UoMHVjbUhDPSVFRFNoOzohSSxBNSw2MGxvdEVBNSRYSkpeZjtrYyxFLTU5MW9uMCxxcE4+PU43PUtDT1AmO1tUWVBcKSFKaXJGJGYxanVdR18jJ2QlXSI5JUJdN2c0KTtZRiZXakYwXUwoWD5gMF1AN1FpPEVYTkYjNWtkN2kkPF00KlVNNVVycW8lPDd0Il5xcVNDSGU9LD9VZGsjOzJnLGBmJyJQbEluMGczXUJqS25TJFFoNnBFKklrcmhyUVBIaU1OLTZERGVyRi1YYERCKGZGSVpZLm9WYlldO0glS11DLDRnJTY0UUAhQkxSY15Bfj5lbmRzdHJlYW0KZW5kb2JqCjE2IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDE2NTcKPj4Kc3RyZWFtCkdiITtkOy9iMlklIkByUys+QDJCZ2RdYmBVbSUlQEFRXXBuQlVYKkU9KCcrLUNuNShEZXQlIkdhJU5aWjVNak1mQVFzMzJfP1NgNE0kK2tnbmZvVEgtMzRwNE0+XVhnIS5JVCFRUFRjMUtrKFYxR0MycWZfMCszJ1ZydFMoOCVdQlEyaV8sciMpPD00QE5NSidUInAtIUotIVIuNDlnXFxHZ0xNQF9ydWE1TE9NTE1oJ0ZkI0w+RC1mNVdsKGxFN2UlbmRgS3EtT0AlIzQ4LitTXGMnPnJkYk9SLVI6PHQnWSNnJ2s5VVEpTERMQS5qOTdYJkc+P0tCSVgtMT5TVEMwPktabiRudDhpK0FRbl1IT2M9bGpCUy07OjZALktCZmQkLFZqUF0qTUI/TEQ+OSdXJEgrYmY5WzYyJ2hyLWZ0UyssWkFyam1PMTBXbFFNXnUtbjJXWzVBTisjcVVPbFdYZCM2U1cnX1JQWktmK1NSKVBjc2MuO0YxYk5iPnE7YCJkOyg9KU1DSyhbZlQ5KmI9W1ImYThKUUlwVSZSbVopMz40PiU8dCk+JzRsRDNlS1Mhci9mcnJiKyRic0hcYFcjUGZgalBAbkVvZVghWkQoST05V2Y5OjRuZjYtcmNnVSRWPTxjXCxwQk5eUm4zaicoRFlEKiIjaGBhR1pIYzNZYFEqWywuZEAqajpSUyhybThcakJUTjsrcEEzJ1UjW0MiJzM6XVVNLzZtXmMubUpXRlN1YFxUI2VIM0k8a1cuS1ojQUo+dEZYZkZFVXA5S11wRlhkIj85WHFzS2ZcLD9FPmYpSG9ZbERfLj9EVT08cEFkXl4oUjUnbUBuZXA8Z2hAa0UnYVBvO3NBSGUnUjAlbFc7TF9DRFA3blUpVC1mZVJfZDhLMEdRQW1FdS0+Iz8nNUFhM2JAQzM0WDBVdDYuTytlP2ttVzk3cUJYZi1bSiJLOlBzOnFtcXVNMkBcQ0tuJ2xEOzVeYEAjTTk7KE1OZ1JYNWpCP2pDIXFUTFgwTl8mT2pGYkxvVCtRIzUhMk1fMU8tTl5oUnUpYVc/OEdbKzpWJ1ticD5cSWpJdSg7O1xVSSIiRi9OYkYqNGE/bi83NiFPWF0scWdsVG9OQEJyZzJUNVh0P1VOYjpOW3NSO2xmYCRrYEA2NDVma0kwbDtHcW01VFhNZFJlYyo1NT9iaj5IN3MmWV0wcSI8U1RCUFspLi42MS9sXStnWnJIJDQvdW8zTGZUQ09ZVSdzKSI9UU1vKFskXjJNPVw7YUNoJDRdLl9aIjRTVixRM0EpcnFfUTtEQjRzOi1QczdyIU4yLihrKkp1aiY1PlZtRyhpS2xhKEJpVzJvQlUpWl03WlNQbTRJbUU/L2BhZTpqO2lHPWlbOzgtcz1UKE9fa3EiOVgnSmgoVEFmIT5rKVZYbkZxPj5yS1MoIkRKRj1Kb1otZnRqSGkhZ1N0X3M1aHFRTENqJjZZc2tYOiE6KD9vZUxnU1w0XW9PUCotZ2tlRDMmPFlOVUpkMVlaUmZkU01GNzxASklLQi0qP2xEY0hPL1tHV2k9Y3ApUiNmXllTaCRyYEdXQFxaIVo3YTheW0snImEwMCxbMENhKjNIKWE+dGBhMyldMHJVInU9W0xiWVtaRUkyWGU0Rl0yUD1DUmtYPTVPTkQ8UVM7RTdoQVlQOUAiPjQsV2owb1xXJW8xJzsiPlllbl1aSzVmUTZtRClYWiJQLV5xV00+SVF1al91YmxrZ1RaV09KKlEwNDdqPTw+W3U2WCRATWlzXyJtOCFZWWhkYUtRXC5wNF8sSV4uTUNZVXRoX0tZW11HMWBOcmw8PyFwXzAvbWpORmRoLE9kY3JaYnFiQzU9M1xiXW5hOVRASU4xcyhKUDFLUFtacWhLOTQmMittZ3BoLl8pRjZja0QvMG1gcClQTFFsJiN1bEQ/Zy11MGJobExsdDI+Ujw7NVNiNjdfQFdxKVJcP1w3P01mWSE3LyNZWmJNQDFwdW5QcC4lZ0JbaCZEVTxXNi1ZRFNcdVs1dElHUl07M0g0M0I9aj5fZ0tWPVYsaHRyIUArL2RSUGFtRHMkJC5ITHVBazZIMGI9aTohWCxSOzVbSyhfaHBCNCMkSUNRLF4yczpWZiJSdEZdOzluaCdzJm9lMjBqdU1NPSZJJTI1XDdpQ3ViOVtMc0RNXGw7TllGLnI9bV1GcGZXfj5lbmRzdHJlYW0KZW5kb2JqCjE3IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDkzOQo+PgpzdHJlYW0KR2F0PShnUSVhVyY6Tl5sN11LTUNWUUZWUUEiWlV0W3MuTVI/KTNiXjdZbTg0ImhaXnNrdVJjWE5ic3JgOFgibzRMczowLEYzXDJWJG4sSCtyPi4/LFdza1Q3QVxeOTlGJ3NTKmE/SUcwL0dLcWsuUkZvajVcUVY1MEVvPDtSRSxyYCwldHE6KihjNyUvWDBXV2JVM0VfWGVQaz9ATSg+OlZfIitXXSI4cSU9UWpjbjZrMjYoYzM/Nl9MS0dtYmVTdExUKT8lKl5nUGBfRSpeYilRZnUsb3I3YkMySjNIYGFFSU9sJ1hLVnQ7YShPYicmPXJGaEo/JTM3TnFKckgmRT1ddFwvOzdUVWYtRFs7SE9EKygzNzdvKVw4VzthK0skLDwoISk0RylLZ2hNcGFmRUZsJ0sjPyxCMERjJlVrXUtQJytdXXEqSUEsRWtUQ2UyRyxOMVgpaC0ibF8nYW9LXEhZO28qZS44a2tIWGRpOXI4VG9UOEt0PnNgNCtcIyp1UXMwTFg4JXBrSFZBLnQ3UzhKRmY5OUUmVjNfLipEImNWNlk7TSpFUS5TYWxUaEo0LVZeVElKQTNIM0lBYFlRViZMTlowNSFSLTtQQU1gWTYtJ1tHJGJLQ1JBcSxBQGdRUCdMYmMsYGMnP1FNYlIhKDFkU1I1LTVNSz1gZEo+amZKXEZpIi1CUk9IT1I7PiNMLS5PVm1iMTtaVlMyJDFETT5oInR0STBkMGRJNC8wMidYKiMhTjZGV0dfTWNBPXNrWC46OElcNzBQIURCcW81U0taZUIiIUpjVWs1alIsI3NmRzQ7LW5pQWlwSlEpRVtJaDZfLFYxY2ciT2diQ1dacmZvXl8+Lk5mKjZiSyc4aCs0WU04b0NtUDdTVkJuSUxfZ1I3YmRDVThBbF5nSihDczlfamhwXykxMVlsOmteMlJIOjpnP3U2JlRTSzJwMTxxZj1hS0hNbls9QzlgKTg3PDgwYWdmMkg4JTBhK2FEJCxMQmQ/YlUtNjJzZ3MhPklYNVlOYjYuN0ciU1dKTGxILSZWPShCJXA5ISxKKjs9M1hkcSw1RzdiWkxhTldLT184TzBIJURNYjhgO0o5KChSb3NNXWdvaiJQV04kVEc4cmNAMF03VyslPEhzKyQkMHJPNyUrbFZCJ0dSO2lKYmgnVTdmL0ZcMGFPRyMkSDVtWDVGaydvLk5EJV1hcWR0Ki5BTEtPQk9mQGlGaGEhXFtpR2JSIVZcK2oiVH4+ZW5kc3RyZWFtCmVuZG9iagoxOCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNjk1Cj4+CnN0cmVhbQpHYiEjW2dNWWI4JjpPOlNiWDZxMkpdcnVjRG90X1FgKEFbV0pgQm9fUl9nXi5FYi1zTFxdY1s/PENLLWRCOXEkbltTLWUmSkpzaHMrZFkhK2NDQztuRl9RTG5mPWlVOWRBbi9gbkNBbztVWTE2KGhza0ZTLyVxQEFIb1oxOXJuJjVdakdZR1VCS1JIWSVEayhFUEowNDBuU2YxcSddUUI7ODZYSSRxMiRvZEtnJU1HajlJPCdPNSo9am5vRic2LEJtc1AiQVtWRl5pZCpvLWg4WW1BIiIsaHBldHIjNHU7Py9hUmElJHFiND9aXUdOQk9oQVgraFg+VElML1VuYSVoSUw5ZkZeby9kODU1R1ZEQ1R0YUE+cVxxSFtqWyI5JkhCOFtOSXFQP2kqKXROYW0pPy4qb0BXciFjPScwST1OcSxSVjM1NVBTVS40QkZjKF4zTDpGSlsjM3MkMm8qYW5Vbj87ajwjcWQ1ZnNRVkxMSC4nUChGQSNNZjkqQV5zamVzPkRPTT5qQmVTVD8+cT8yNFdOVihoJE06MEMocCdFTS5bM0tiP0BzLV1xQ0VkLlZfUEk8MjhcT1IscVFaU1Q5YlVYTHBINTIxWFIuLyI5XzJYKFBldUE+QyR0azcySypAMV1sJ0RkVzZqKj45TCVZTTViXkU/IjNSWFkjMFYlNS1IP1FZNUU7ZiJ0NmFkWTtcQkFXRC4wUChndHRMWCVEUTtIP19xZWcvRCZrIjtgX1RpWlY5RmNUS3A8RCM8S0hDO1UwZmBFK29RUC9xIyQqQ05yVmRxNj88Vm8xWWFyQD0+VyYlRWxDSCVTKDInZDBhS0JQNT0qSGhxPiM4Ozw+cldxTCFrOHM/dTYtKiQiJ2diTEJcdGlNbG9qWkJhUU9dbGFVNy9DRVY2JTtEMilWVjMvZjUjXFdnRCdKWEpuKEMzXStiI2wtSWlyQyYiIVZQZmFtYT4mI1huKkFOPz1fK2hXMD1RdWo+b1Y3SmU3bDpuUmhHK2FZXCUtazhncFhKZDxPOjE2PVRVOVxNVl5WUmRDNSMmOWorNjowbkRuc0RoYjQ9Q0paYDJWK0pKJ2VQKV5RT1tIO3RSN1xnWiwicCEqcVs/UyUiU2U8Ny5QcXRyN2FOJmtsMj9nWTE9Sj4tRi1Uaz1IYD9aY1VFZFlIW2xmKXAyXCd1XEdBaEheN1ptQWRTYlk2QkRLczJsOUBPajsjckFDMSsnKl1iZDJFJ1wrWk4sWmtzWjldOkNQSzBLWm87UThbNl06JF9cQSYmM2hsUDtacltYVzUhPGZuPUhfOTJETUNILlB1UT1BKmgxcCspZz5WKWEkbVteMXA+QjhuNDVzaCgrTlUsXlFcPk8mT0VWMCdeXSlKJ0szbyl0Wi1GY2FiLTQwJzRKYyluXTBpJ0FeJmNdKmt1R11Cc11XaictUTJQVidDVzJeSFZJW249XDxvWWFgIT9CcUYsRltoS0E6O2EoS2RcV2xrYFhmNyZIQkVtJDJSPD8jJCRLXDQpTSpbWSE8cksxKldZMXFOWEMuImBmREEyLjY5TGNMVktjSnJAW1kxcC1uI1xpSUJhUDctRilwXW9jS1tecU5dR1xaQkA3VCtNOSNoNVlcVSdxSV02JUlTZCFDZT4iK1RVK3NITTRSVCY9MVsuRzIhMD8lQWhiLztXaVZRXyMkIlNOPyxPYU8+X2pgMTBoQl05PzgxWHIiWVVjN2prVWtPKmQmNVBGTTpqYlFxTWRZKSpRYlEqaS5WLipISCdxbHVcJiFRLWRfc2JyOy9HNkM/TmYoPEJ0QTxPcDFtXzZZUiQjV1JdQG08QnJOVUs/Jm1eLFBxb1U9J0NeWDY9LUtOTHNEJzhbWChyUlc9RzlMQVU8SyU2KTBVYChDWFtCWiFCU2lZYl1CWzJsRjRVMF9TZ0tBJU5VZSpSXWY1TFs+XzJlPis7TWFTPmRYRiNlW0p0bktNSUsrOjRmOkhqRG1JWiErOV1tLHEwQ2dATlYqakZLcFQ7bDVWQz9cLVpmXUw8JylMJHFbSVU7TSJhRFY3aE4iNmtfLTdeJExKIWpCWzxncTU6UERUN1UjYzI8VE1hdS1rYj5FVEVpNlJMRmpfZUdNPitxRkcsRnRVOC4uIXFwZWEjYV44K087O15tcFk/RWRwaT8hdF1QOzk3NEE6MnMvK2A1Iy1bX2VQNTI7Zlg2dS1zO0NwPkdgRyE3P2FLSCsnWlBWVD80amRTWzA5K3IhUTtKWVBcfj5lbmRzdHJlYW0KZW5kb2JqCjE5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDQzMgo+PgpzdHJlYW0KR2FzMVs+PktsKidSbzRISSNpP3I4a1VWcDhgUklyQl06ZFIxcWtOQl9gPUBzLEtsJDFoRXVNKS9NZSktZzJrIV8uPkxcMEdNZmItREEkNDJGKVpcQCQ4LmA3bnFhb3Jxc3ArLSIhMGo8SV1XSmojMzJFKi5SOThFLHJKMmRKdGZcPVRlYCMvNFZrTVwma2tiTWpBYlI9PVJpaVRFPHUnTEVKLiMmMywicSZqP3MnM2RSWGA7Pzs1IidBcCQ2UmtQNiFZJWpfK15RbyY5NTdmVTFpJz89MzFjcU1BPl1Lb0lMQ2dlZlBiYkZwTzZTazQhJWRuJmFDUjxKWydPLWIubGE3UCc+OTM1PzthTk1TaHJMYVo6RlVRdVdNU0Q/NmdxWS9GKmk9W2ZGY145JFlfUm1sN00jZTMmOmglVipjMFNOYFxbNTJXcUg/aC81JmdoMXRlXFl1dCojbW9mKz04ITJoSktBLkppLkNfRnVFLUo9K0NVKC9TUUY8NWxDIT5Ac1BQUFY+VkVXJk08XFFBKWJgcT8hRCU3QWo9aydaZV4xKVJTJVIjJ08kYUhWI34+ZW5kc3RyZWFtCmVuZG9iagoyMCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNTk0Cj4+CnN0cmVhbQpHYiEjW2grdWNyJjpgbEhSKWNROD9pOTxcRjpjbW8sV04ybldwNUctTlAxMilnMFVDcVNNXG1xbk1kZUQzIkA1JUU8Nkk6Jls5a0tvREAxLlltaih1Wk0hW3IhNFxROURzcU1IKkxQLWdwKy1gT2YuYFZhci1gI2A0a0ZqRVlfSm9ka2AzSGFyPylHUFcjJGctNHJqRCIiU2U/JzVnPGE6cDtAbHM2NFlWI29SJVVFJisqNSVkckhKSCFTYy1aSG4zamZfIUNcQFNeO3BBTGdYRSVpJUpEcFJuVXNaYk9bWUhyPENgW1psIWs7aC88I147IipPL2hUS3NiYjhJX2JOPm5pYl8vJFJAV2k9cClQOW1sSm4rIWFvOGwpNChbTkdaK2huKTkjYiUjTXJQaU0hSklOa1dqMHVcc2pNP1dQXHM1NlxxbzNENG1uN0YmWWM9VDd0JzZxb0phLGImUSttOktVS1ReSFojPTQibGA8P1MkTXBPbzBPSnQmNjFfPkZnUEc6UDdVPlZsaDctSkFxW2coPDxDPmoiUzRSRmk0O25OMisqJ1RccVlHR10+UCpIRk0uW2g5WVFxVi5FZV1BamAhcXBAImZgSSpUbixpZF5pSDwxWkpLSysqT1tQMHJfYkhrIThSTW0pYiRjZCI3bklpVSVgOjMnIjZUSk9QYTUtb2RLVVY3WjM6Xm4nZTlUM1xsXmwwJGxRcDNDN1JdSGUyOGxvJ1ZcUmtIIWBJWWU3Ui9tKDY6NXRQJzZFYF1mM0kxX2Jga1pwU0FtdEkxNzdCVT5CPkk9WlhfPTUrcE9nMnNUZnQlSCVZWjpiMmk0Ij9fNjswQ0csLEZKYyxCKUNFOmNddVdTPFBwKnApLzxNVnVRIm9UOmNqOztHXUxpPllmVEg/cUZXb18kQU9zYDtpMSQrKV9VIztFS3JYOVZOW0AiLFpAXnVLbCIuYSs/UHNMak0tMldnZyMpP0gwLG9xRFl1cFM3WyxkW2IrMF9XO0pAKmcqbXVSbFlaRm8vMGFQRzZaNl1UdThfOTcnNChGWlxTXk1sS2Aubz9zVVhGdTxMPCQ0IUkwVTdMIyhca0gwNGgwcD5dXVo4TUBvOHMzO0M8W2MxQFlHL0otPldcRmgrZGdFZVArViY5ZjwhWCIpRFZSaTBQazhzX2s5VjpnR0xYLHMpNmU5ImlEakJVVDUyZ0JwUj4sLV4kXC8rKE4+PSg5ZURhYlJMOkcvZlkzIVNFJE80MkZhUEguND1iWktKUjQvM2ZBUSFsSUQ/dSpRLDhPOm9BSHEmK1teP01bS1E3Oyo2J05aNVVcK1guSl1ZaVJMWl8rNGRrcVtTLGlwVWo+LitONV0yZmFFJGMmQG1KZz1fLnVsK1ZIbTZgKzYtSVx0Ii1SRmtaK04rJVEhYyMjODQtIUFLJlEqMmUyYUdfMWYnVWpXWGIjRmgnLSFKal1Iaih0VWh0PikvUVxsXE5QQE9KUjFRR2pARUBoP3NiL20nXVE7YkFZQXJEbWw3NUFSVWRQXVVUP0c1LDo0SytWNCMxJydyWSVDcSVySGBOJkhOLidMNU5cb2hTbTVrLV85K1JFUkc+TktyJk9ha3ItdF8wQ2guPiNiKTFlR0w1TTEkMzZAZ1VcMGEoPTlYXkw8SjxLSj5CZSVpbWJvUFpaMSdlXmtvM1M4ZmAmIVZKJmksL1IjR29YYDE4R1xBPG8/UVEmNU06KyYtPClUaGdXUTlZQkxJYExlMC07UDkxTzZLV05bUEkmRStlTjtuR2tyRW5ccEJBO2hxPz9iMEBETShJJ1tWXmtWN1U3RnApRzZdMl8lZiM3MVtvUCNVZWJoU2QvWG43bl4pMzY7TXInJDBpOVQyTVMoQmFPK2ZCO2twY0QsIkZNQU5sWyNALG1cN2JSNHRiNGNWbixGYEEkZTZRcWUnTiRZRFI7WyVKXlM8cD84P05pTVNGYjpBTT5pbihyPU5YYUA1Y1NQX0NcV1dZSU5lNTM/bnAjT2tjM0lMKSVwU2pPWDFwRidkIT5TXVNrbGpUWlZdZ2c2ZmBHOS5WJWlIXyRjcilnXkY4V3VQM11SdEBoN0IiTScxVVhIaCR1TUB0S25vIU9IJF9ZNX4+ZW5kc3RyZWFtCmVuZG9iagoyMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNTQwCj4+CnN0cmVhbQpHYXVgU2dNWiUwJjpNbCtiWmluVzx1I2thZ208MUNoNlszK01fPSJgZlk1YyhmTz8oZiQ7JjUsVSomODlBTk5YMmJEWC8kT2MnbTBpbG1wNmsmQTZdVWJDa1soSCcjKik+bkhtSjQyLnIhX1wrSkFmcCFMbSxJRlcjYTpYcCcqdUhoKmxfK2E9SVM+UyUhbSU+bC8+NCY1dDZwUykvK11iUnU6XD4oKydTPFA5YV9INENscCJcYEgiRSI+JzckZE5JO2FUXi1FYGM2UyE1UUddZVlkR0xuUS1YazRGWUglJiJwKCxDKFxBYVtXNFJQW2dMT1FfcmpeKE5LI0xSWS5oZHBUKVdfcFlDZzl1UT4+SHR0ckk/MTtePExOVjNVS3MhIkZQaS45aj1aTVhPZVNTZ2tPPWFPV2k7a0lDJ2s7OlxBUSlSO2RyYitUOmIiJzhGQmxsUGZVdDBJKC8sWEkiYTc3PVNlRjYzc18/ZjNNZl4pTmxdJERAZmhVTkg6c2w5TTRyaGYuKyIjUGtZZzgrMzk1aF0ibS1La2AzWUpLXCY3RSVqJ0BTazxaPzlyREssXUw+O1RBL0JxPyUhYjUmXktnbT05blE9YUUqY2BiQ1VGTGc6amgoSyw8NXBFLjooIzB1azppRSFVUHNlST5WXF4zbEFlOV5vJG1Pb0xUPnRKZihOXjFmbiReVVsxXV1TSF9jI19WZipgYScnVE5gLi50KTJAPykhIjNDQHNJdUBIXT1fXFVdaF4wT2M+Uid1OU01cTNwRGMkcjBiKzxmNjFxQU8jYi8kRWdlMFkuLlEtXm1eL2dLSlhKPytyST04U1ZGaVFWY2U8XXI7UzdXImdKMXQqVUNsM2RVLz84NjZfMDlfIWBeUDUtSnBlTiY0Ojk4XUtMPSNaREw5MkpYL0NQQGROIyNuJ1lxUlNxZllpSkFAT2dpSkM3PmVyYlM2XkNocD5POiFuN01OPlkySWtybFxeMVNIR1leJSdkVW9yUyYvXzhpOHBWcFhWVU1rSkVsZlVuOlxkaChiM0AoLks2PEkqSCNZcGU2QlhoZD1cK1FzYCE9LmYiLDJwMUJ0MUwqWG4nL1MoWWs2cjczb1pQZlElSztsTCwvJltbczY4ZGkrLVNoXkhbNj1LQmdkQjpIP1pWZlxNKFU0LHEmYV1XY1NkWEZeTW5yPDEuXCJ1SDhYZCotIzZkKWRlXSQ2ayxLO0FbdFRRTzNQTzNva1BbMzJET0tEcEBXQ1whMVU7bmpcZjhPcT4pYGUvXV5OS1VGaiFyL01EXiFkW2sqRjlUZVNcdClsRzxZZD9dPi4pMDVsRVViOiJYcSJgOytdKEpEXGwxRm1oMz88X00nQkE+Q0xJXGwibzM7L0hNb002a1tWZSQmUWQ7KWAjMyRYb1I9R3FoUFZSMC5kSD9xKS1bYV43L0Q7RiphLytrdEBHVFhgblRBaCxJLG1YLk9iPkVqVG8nQiRsRV5STjBoSC8pcEAva01oUkMoU1IlUl9NbmErNFo2amxPTkhfQWhpXzY2OC48bCJKJXAyQCxWN0QpK0BDX0xdNTVnMVEndXFHTjctNylvMXEtOnUtNW1nMypcW0dadGxhaGNOYjkrT0V1V3BBdUBIbmJGMCVqQHQ4SUhSZERnQSR0NTBUTm1qbWk4YDsrSTtHMm1aJEIoM1BYbDsyMjg9Y2tfKUYmPDtEaVgjYnJdRG5ELV80cmZxNEdeWmE0TExSUCtxSV0rbUM6byQpVlcqLC42aFAtLWdYa3I9dFxHPVRTJzJWLDhHYDFgKiZMM1xVT1NOXk0yUDdFLitxMV9CNjU2Z0dDW05VRjNoX0lYLENzbE5EOTJFbTxyVDg1a0JUcWA/REUjZSNXRyNwV2U4K0p1LU5TXkMqKThbX08qLnA4NmRBMmpVJWEtXExaaTJlSihxMVVIP0l0YW4lU2MpREtQSDdsdCZaUTg0RmJMLSgqPDYxTiNONko6N1hUYnE3NHEqMy1tI1JET3Bqb05rXmFvKTJORURpS2pjWjwtVTluSzJwMChqY34+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMjIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA1MjYgMDAwMDAgbiAKMDAwMDAwMDY0MSAwMDAwMCBuIAowMDAwMDAwODM2IDAwMDAwIG4gCjAwMDAwMDEwMzEgMDAwMDAgbiAKMDAwMDAwMTIyNiAwMDAwMCBuIAowMDAwMDAxNDIxIDAwMDAwIG4gCjAwMDAwMDE2MTcgMDAwMDAgbiAKMDAwMDAwMTgxMyAwMDAwMCBuIAowMDAwMDAxODgzIDAwMDAwIG4gCjAwMDAwMDIxNjQgMDAwMDAgbiAKMDAwMDAwMjI2MiAwMDAwMCBuIAowMDAwMDAzMjAyIDAwMDAwIG4gCjAwMDAwMDQ5NTEgMDAwMDAgbiAKMDAwMDAwNTk4MSAwMDAwMCBuIAowMDAwMDA3NzY4IDAwMDAwIG4gCjAwMDAwMDgyOTEgMDAwMDAgbiAKMDAwMDAwOTk3NyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzw4YTU5NTUxMmI2MzU5Y2EwZjEzNTcyNzc5OWExMjkxYj48OGE1OTU1MTJiNjM1OWNhMGYxMzU3Mjc3OTlhMTI5MWI+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDEzIDAgUgovUm9vdCAxMiAwIFIKL1NpemUgMjIKPj4Kc3RhcnR4cmVmCjExNjA5CiUlRU9GCg==";

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
    attachments: [{
      filename: "ZeroMissCall-Setup-Guide.pdf",
      content: ONBOARDING_PDF_B64,
      contentType: "application/pdf",
    }],
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
