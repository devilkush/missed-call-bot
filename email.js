const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDERS = {
  reports: "ZeroMissCall <reports@zeromisscall.com>",
  trial:   "Ian from ZeroMissCall <ian@zeromisscall.com>",
};

const BRAND = {
  navy:      "#0b1928",
  navyMid:   "#0f2035",
  orange:    "#E8791A",
  green:     "#3ecf8e",
  siteUrl:   "https://zeromisscall.com",
  railwayUrl:"https://missed-call-bot-production.up.railway.app",
};

// -------------------------------------------------
// WRAP EMAIL
// Rock-solid mobile email wrapper
// Tested against Gmail iOS, Apple Mail, Outlook
// -------------------------------------------------
function wrapEmail(contentHtml, previewText) {
  const preview = previewText
    ? '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0b1928;">' + previewText + '</div>'
    : "";

  return '<!DOCTYPE html>' +
'<html lang="en" xmlns="http://www.w3.org/1999/xhtml">' +
'<head>' +
'<meta charset="UTF-8" />' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
'<meta http-equiv="X-UA-Compatible" content="IE=edge" />' +
'<meta name="x-apple-disable-message-reformatting" />' +
'<meta name="color-scheme" content="light" />' +
'<meta name="supported-color-schemes" content="light" />' +
'<title>ZeroMissCall</title>' +
'<style>' +
':root { color-scheme: light only; supported-color-schemes: light only; }' +
'body { margin:0!important; padding:0!important; background-color:#f0f4f8!important; -webkit-text-size-adjust:100%; }' +
'table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }' +
'img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }' +
'@media only screen and (max-width:620px) {' +
'  .email-container { width:100%!important; }' +
'  .content-pad { padding:24px 20px!important; }' +
'  .header-pad { padding:24px 20px!important; }' +
'  .footer-pad { padding:20px!important; }' +
'  .stat-col { display:inline-block!important; width:47%!important; margin-bottom:12px!important; }' +
'  .btn-full { width:100%!important; display:block!important; text-align:center!important; box-sizing:border-box!important; }' +
'}' +
'@media (prefers-color-scheme: dark) {' +
'  body { background-color:#f0f4f8!important; }' +
'  .email-body { background-color:#ffffff!important; color:#333333!important; }' +
'  .email-text { color:#333333!important; }' +
'  .email-muted { color:#666666!important; }' +
'}' +
'</style>' +
'</head>' +
'<body style="margin:0;padding:0;background-color:#f0f4f8;">' +
preview +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;">' +
'<tr><td align="center" style="padding:32px 16px;">' +

'<table role="presentation" class="email-container" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">' +

'<!-- HEADER -->' +
'<tr><td style="background-color:#0b1928;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;border-bottom:3px solid #E8791A;" class="header-pad">' +
'<span style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#E8791A;letter-spacing:-0.5px;">zero</span>' +
'<span style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">miss</span>' +
'<span style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#E8791A;letter-spacing:-0.5px;">call</span>' +
'</td></tr>' +

'<!-- CONTENT -->' +
'<tr><td class="email-body" style="background-color:#ffffff;">' +
contentHtml +
'</td></tr>' +

'<!-- FOOTER -->' +
'<tr><td style="background-color:#0f2035;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;" class="footer-pad">' +
'<p style="font-family:Arial,sans-serif;font-size:13px;color:#8ba4bb;line-height:1.6;margin:0 0 6px 0;">' +
'ZeroMissCall &mdash; Never miss a customer again.<br/>' +
'<a href="https://zeromisscall.com" style="color:#E8791A;text-decoration:none;">zeromisscall.com</a>' +
'</p>' +
'<p style="font-family:Arial,sans-serif;font-size:12px;color:#4a6278;margin:0;">' +
'You are receiving this because you have an active ZeroMissCall account.<br/>' +
'To update your preferences, <a href="https://zeromisscall.com/contact.html" style="color:#8ba4bb;">contact us</a>.' +
'</p>' +
'</td></tr>' +

'</table>' +
'</td></tr></table>' +
'</body></html>';
}

// Helper: orange CTA button
function ctaButton(url, text, style) {
  var bg = style === "dark" ? "#0b1928" : "#E8791A";
  var textColor = "#ffffff";
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">' +
    '<tr><td style="background-color:' + bg + ';border-radius:8px;">' +
    '<a href="' + url + '" style="display:inline-block;background-color:' + bg + ';color:' + textColor + ';font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;">' + text + '</a>' +
    '</td></tr></table>';
}

// Helper: info box
function infoBox(borderColor, titleHtml, bodyHtml) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">' +
    '<tr><td style="background-color:#f8f9fa;border-radius:8px;padding:18px 20px;border-left:4px solid ' + borderColor + ';">' +
    (titleHtml ? '<p style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;">' + titleHtml + '</p>' : '') +
    '<p style="font-family:Arial,sans-serif;font-size:14px;color:#444444;line-height:1.7;margin:0;">' + bodyHtml + '</p>' +
    '</td></tr></table>';
}

// -------------------------------------------------
// TEMPLATE D - WELCOME EMAIL
// -------------------------------------------------
function buildWelcomeEmail(plumber, trialEnd) {
  var dashUrl = BRAND.railwayUrl + "/dashboard/" + plumber.dashboardToken;

  var content =
    '<div style="padding:32px 40px 0;" class="content-pad">' +
    '<p style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#0b1928;margin:0 0 10px 0;">' +
    'Welcome, ' + plumber.ownerName + '!</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px 0;">' +
    'Your 14-day free trial for <strong>' + plumber.businessName + '</strong> is now active. ' +
    'ZeroMissCall will automatically reply to every missed call starting right now.' +
    '</p></div>' +

    '<div style="padding:0 40px 20px;" class="content-pad">' +
    infoBox('#E8791A',
      'Here is what happens when someone calls and you miss it:',
      '1. &nbsp;They hear a friendly voice message<br/>' +
      '2. &nbsp;They get a text within 60 seconds<br/>' +
      '3. &nbsp;Our AI handles the conversation<br/>' +
      '4. &nbsp;You get an alert when a lead is captured<br/>' +
      '5. &nbsp;You call them back ready to close the job'
    ) +
    '</div>' +

    '<div style="padding:0 40px 20px;" class="content-pad">' +
    infoBox('#E8791A',
      '',
      '<strong>Your trial runs until ' + trialEnd + '.</strong> ' +
      'After that it is just $69/month - cancel anytime, no contracts. ' +
      'We will email you the day before your trial ends with a full summary.'
    ) +
    '</div>' +

    '<div style="height:1px;background-color:#eeeeee;margin:0 40px 20px;" class="content-pad"></div>' +

    '<div style="padding:0 40px 20px;" class="content-pad">' +
    infoBox('#3ecf8e',
      'Your personal dashboard',
      'Bookmark this link. It is how you view your conversations, captured leads, and account settings.' +
      ctaButton(dashUrl, 'View My Dashboard', 'dark')
    ) +
    '</div>' +

    '<div style="padding:0 40px 20px;" class="content-pad">' +
    infoBox('#0b1928',
      'Before you go live - takes 2 minutes',
      'Log in to your dashboard and update these details so the AI gives accurate answers:<br/><br/>' +
      '<strong>Service area</strong> - what city or region do you cover?<br/>' +
      '<strong>Business hours</strong> - when are you available?<br/>' +
      '<strong>Average job value</strong> - used for revenue stats<br/>' +
      '<strong>Services</strong> - drain, boiler, leak detection etc.' +
      ctaButton(dashUrl, 'Update My Settings', 'orange')
    ) +
    '</div>' +

    '<div style="padding:0 40px 32px;text-align:center;" class="content-pad">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;">' +
    '<tr><td style="background-color:#E8791A;border-radius:8px;">' +
    '<a href="https://zeromisscall.com" style="display:inline-block;background-color:#E8791A;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">Visit ZeroMissCall</a>' +
    '</td></tr></table>' +
    '<p style="font-family:Arial,sans-serif;font-size:14px;color:#666666;line-height:1.6;margin:0;">' +
    'Questions? Just reply to this email - Ian reads every one.<br/>' +
    '<strong style="color:#333333;">Ian from ZeroMissCall</strong>' +
    '</p></div>';

  return {
    subject: "Welcome to ZeroMissCall - your trial is active, " + plumber.ownerName + "!",
    html: wrapEmail(content, "Your ZeroMissCall trial is active. Here is everything you need to get started."),
  };
}

async function sendWelcomeEmail(plumber) {
  if (!plumber.email) return;
  var trialEnd = plumber.trialEndDate
    ? new Date(plumber.trialEndDate).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "in 14 days";
  var _ref = buildWelcomeEmail(plumber, trialEnd);
  var subject = _ref.subject;
  var html = _ref.html;
  try {
    var result = await resend.emails.send({
      from: SENDERS.trial,
      to: plumber.email,
      subject: subject,
      html: html,
    });
    console.log("Welcome email sent to " + plumber.email);
    return result;
  } catch (err) {
    console.error("Welcome email FAILED: " + err.message);
    throw err;
  }
}

// -------------------------------------------------
// TEMPLATE A - WEEKLY DIGEST
// -------------------------------------------------
function buildWeeklyDigestEmail(plumber, stats) {
  var totalConversations = stats.totalConversations;
  var leadsCaptures = stats.leadsCaptures;
  var estimatedRevenue = stats.estimatedRevenue;
  var weekOf = stats.weekOf;

  var content =
    '<div style="padding:32px 40px 20px;" class="content-pad">' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;color:#444444;margin:0 0 4px 0;">Hey ' + plumber.ownerName + ',</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:20px;font-weight:900;color:#0b1928;margin:0 0 6px 0;">Here is your ZeroMissCall weekly summary</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:13px;color:#888888;margin:0 0 28px 0;">Week of ' + weekOf + ' &mdash; ' + plumber.businessName + '</p>' +
    '</div>' +

    '<div style="padding:0 40px 28px;" class="content-pad">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '<tr>' +
    '<td class="stat-col" align="center" style="background-color:#0b1928;border-radius:10px;padding:20px 12px;border:1px solid #1a3550;width:32%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:34px;font-weight:900;color:#E8791A;line-height:1;">' + totalConversations + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">Missed calls<br/>handled</div>' +
    '</td>' +
    '<td width="2%"></td>' +
    '<td class="stat-col" align="center" style="background-color:#0b1928;border-radius:10px;padding:20px 12px;border:1px solid #1a3550;width:32%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:34px;font-weight:900;color:#3ecf8e;line-height:1;">' + leadsCaptures + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">Leads<br/>captured</div>' +
    '</td>' +
    '<td width="2%"></td>' +
    '<td class="stat-col" align="center" style="background-color:#0b1928;border-radius:10px;padding:20px 12px;border:1px solid #1a3550;width:32%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:34px;font-weight:900;color:#3ecf8e;line-height:1;">$' + estimatedRevenue + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:12px;color:#6b84a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">Est. revenue<br/>recovered</div>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +

    '<div style="height:1px;background-color:#eeeeee;margin:0 40px 24px;"></div>' +

    '<div style="padding:0 40px 36px;" class="content-pad">' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;color:#333333;line-height:1.7;margin:0 0 16px 0;">' +
    'ZeroMissCall handled every one of those missed calls while you were out on the job. ' +
    (leadsCaptures > 0
      ? '<strong>' + leadsCaptures + ' customer' + (leadsCaptures > 1 ? 's' : '') + ' gave their details and ' + (leadsCaptures > 1 ? 'are' : 'is') + ' ready to book.</strong>'
      : 'Keep an eye on your texts for any follow-ups.') +
    '</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:14px;color:#888888;line-height:1.6;margin:0;">Have a great week - we have got your calls covered.</p>' +
    '</div>';

  return {
    subject: "Your ZeroMissCall Weekly Summary - " + totalConversations + " calls handled",
    html: wrapEmail(content, "Last week: " + totalConversations + " missed calls handled, " + leadsCaptures + " leads captured."),
  };
}

// -------------------------------------------------
// TEMPLATE B - TRIAL END EMAIL
// -------------------------------------------------
function buildTrialEndEmail(plumber, stats, conversations) {
  var totalConversations = stats.totalConversations;
  var leadsCaptures = stats.leadsCaptures;
  var estimatedRevenue = stats.estimatedRevenue;
  var checkoutUrl = BRAND.railwayUrl + "/billing/create-checkout/" + plumber.dashboardToken;

  var snippets = conversations
    .filter(function(c) { return c.messages && c.messages.length >= 2; })
    .slice(0, 1);

  var snippetHtml = '';
  if (snippets.length > 0) {
    var msgs = snippets[0].messages.slice(0, 4);
    snippetHtml =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">' +
      '<tr><td style="background-color:#f8f9fa;border-radius:8px;padding:16px 20px;border-left:3px solid #E8791A;">' +
      '<p style="font-family:Arial,sans-serif;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Real conversation</p>' +
      msgs.map(function(m) {
        return '<p style="font-family:Arial,sans-serif;font-size:13px;background-color:' +
          (m.role === 'user' ? '#e9ecef' : '#E8791A') +
          ';color:' + (m.role === 'user' ? '#333333' : '#ffffff') +
          ';padding:8px 12px;border-radius:10px;display:inline-block;max-width:80%;margin:0 0 8px ' +
          (m.role === 'user' ? '0' : 'auto') + ';line-height:1.4;">' +
          (m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content) +
          '</p><br/>';
      }).join('') +
      '<p style="font-family:Arial,sans-serif;font-size:12px;color:#888888;margin:8px 0 0 0;">Customer numbers hidden for privacy.</p>' +
      '</td></tr></table>';
  }

  var content =
    '<div style="background-color:#0b1928;padding:36px 40px;text-align:center;" class="content-pad">' +
    '<div style="font-family:Arial,sans-serif;font-size:60px;font-weight:900;color:#E8791A;line-height:1;margin-bottom:8px;">' + totalConversations + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#c8dce8;margin-bottom:8px;">missed calls answered while you were on the job</div>' +
    (estimatedRevenue > 0 ? '<div style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#3ecf8e;">Estimated $' + estimatedRevenue + ' in jobs recovered</div>' : '') +
    '</div>' +

    '<div style="padding:32px 40px 0;" class="content-pad">' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;color:#444444;margin:0 0 6px 0;">Hey ' + plumber.ownerName + ',</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:20px;font-weight:900;color:#0b1928;margin:0 0 16px 0;">Your ZeroMissCall trial ends tomorrow.</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px 0;">' +
    'During your trial, ZeroMissCall replied to <strong>' + totalConversations + ' missed call' + (totalConversations !== 1 ? 's' : '') + '</strong>' +
    (leadsCaptures > 0 ? ' and captured <strong>' + leadsCaptures + ' lead' + (leadsCaptures !== 1 ? 's' : '') + '</strong> with full contact details' : '') +
    '. Here is what some of those conversations looked like:' +
    '</p>' +
    '</div>' +

    '<div style="padding:0 40px 20px;" class="content-pad">' + snippetHtml + '</div>' +

    '<div style="height:1px;background-color:#eeeeee;margin:0 40px 28px;"></div>' +

    '<div style="padding:0 40px 36px;text-align:center;" class="content-pad">' +
    '<p style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#0b1928;margin:0 0 6px 0;">Keep ZeroMissCall working for ' + plumber.businessName + '</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:14px;color:#888888;margin:0 0 20px 0;">$69/month - cancel anytime - no contracts</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">' +
    '<tr><td style="background-color:#E8791A;border-radius:8px;">' +
    '<a href="' + checkoutUrl + '" style="display:inline-block;background-color:#E8791A;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">Keep ZeroMissCall Active</a>' +
    '</td></tr></table>' +
    '<p style="font-family:Arial,sans-serif;font-size:13px;color:#888888;line-height:1.5;margin:0;">' +
    'If you do not upgrade, your number stops responding to missed calls tomorrow.<br/>' +
    'Questions? Reply to this email - Ian reads every one.' +
    '</p>' +
    '</div>';

  return {
    subject: "Your trial ends tomorrow - " + totalConversations + " calls handled for " + plumber.businessName,
    html: wrapEmail(content, "Your trial ends tomorrow. Here is what ZeroMissCall captured for " + plumber.businessName + "."),
  };
}

// -------------------------------------------------
// TEMPLATE C - MONTHLY REPORT
// -------------------------------------------------
function buildMonthlyReportEmail(plumber, stats, monthName) {
  var totalConversations = stats.totalConversations;
  var leadsCaptures = stats.leadsCaptures;
  var emergencies = stats.emergencies;
  var estimatedRevenue = stats.estimatedRevenue;
  var topJobTypes = stats.topJobTypes;
  var bestConvo = stats.bestConvo;
  var captureRate = Math.round((leadsCaptures / Math.max(totalConversations, 1)) * 100);

  var bestConvoHtml = '';
  if (bestConvo && bestConvo.messages) {
    bestConvoHtml =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">' +
      '<tr><td style="background-color:#f8f9fa;border-radius:8px;padding:16px 20px;border-left:3px solid #3ecf8e;">' +
      '<p style="font-family:Arial,sans-serif;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Best conversation this month</p>' +
      bestConvo.messages.slice(0, 6).map(function(m) {
        return '<p style="font-family:Arial,sans-serif;font-size:13px;background-color:' +
          (m.role === 'user' ? '#e9ecef' : '#E8791A') +
          ';color:' + (m.role === 'user' ? '#333333' : '#ffffff') +
          ';padding:8px 12px;border-radius:10px;display:inline-block;max-width:80%;margin:0 0 8px 0;line-height:1.4;">' +
          (m.content.length > 120 ? m.content.substring(0, 120) + '...' : m.content) +
          '</p><br/>';
      }).join('') +
      (bestConvo.leadCaptured ? '<p style="font-family:Arial,sans-serif;font-size:12px;color:#3ecf8e;margin:8px 0 0 0;">Lead captured - all 3 details collected</p>' : '') +
      '</td></tr></table>';
  }

  var jobTypesHtml = '';
  if (topJobTypes && topJobTypes.length > 0) {
    jobTypesHtml =
      '<p style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;margin:0 0 10px 0;">Top job types this month</p>' +
      topJobTypes.map(function(jt) {
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #eeeeee;">' +
          '<tr>' +
          '<td style="font-family:Arial,sans-serif;font-size:14px;color:#444444;padding:8px 0;text-transform:capitalize;">' + jt.type + '</td>' +
          '<td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#E8791A;text-align:right;padding:8px 0;">' + jt.count + ' ' + (jt.count === 1 ? 'enquiry' : 'enquiries') + '</td>' +
          '</tr></table>';
      }).join('');
  }

  var content =
    '<div style="background-color:#0b1928;padding:36px 40px;text-align:center;" class="content-pad">' +
    '<p style="font-family:Arial,sans-serif;font-size:12px;color:#6b84a0;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px 0;">' + monthName + ' Report &mdash; ' + plumber.businessName + '</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:14px;color:#c8dce8;margin:0 0 4px 0;">Estimated revenue recovered</p>' +
    '<div style="font-family:Arial,sans-serif;font-size:60px;font-weight:900;color:#3ecf8e;line-height:1;">$' + estimatedRevenue + '</div>' +
    '<p style="font-family:Arial,sans-serif;font-size:13px;color:#6b84a0;margin:8px 0 0 0;">Based on ' + totalConversations + ' missed calls x $' + (plumber.averageJobValue || 250) + ' avg job value</p>' +
    '</div>' +

    '<div style="padding:28px 40px 20px;" class="content-pad">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '<tr>' +
    '<td class="stat-col" align="center" style="background-color:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid #eeeeee;width:23%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#E8791A;">' + totalConversations + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:11px;color:#888888;margin-top:4px;line-height:1.3;">Missed calls<br/>handled</div>' +
    '</td><td width="2%"></td>' +
    '<td class="stat-col" align="center" style="background-color:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid #eeeeee;width:23%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#3ecf8e;">' + leadsCaptures + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:11px;color:#888888;margin-top:4px;line-height:1.3;">Leads<br/>captured</div>' +
    '</td><td width="2%"></td>' +
    '<td class="stat-col" align="center" style="background-color:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid #eeeeee;width:23%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:#0b1928;">' + captureRate + '%</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:11px;color:#888888;margin-top:4px;line-height:1.3;">Lead<br/>capture rate</div>' +
    '</td><td width="2%"></td>' +
    '<td class="stat-col" align="center" style="background-color:#f8f9fa;border-radius:10px;padding:16px 8px;border:1px solid ' + (emergencies > 0 ? '#fed7d7' : '#eeeeee') + ';width:23%;">' +
    '<div style="font-family:Arial,sans-serif;font-size:26px;font-weight:900;color:' + (emergencies > 0 ? '#e53e3e' : '#0b1928') + ';">' + emergencies + '</div>' +
    '<div style="font-family:Arial,sans-serif;font-size:11px;color:#888888;margin-top:4px;line-height:1.3;">Emergency<br/>alerts</div>' +
    '</td>' +
    '</tr></table>' +
    '</div>' +

    '<div style="padding:0 40px 20px;" class="content-pad">' +
    bestConvoHtml +
    jobTypesHtml +
    '</div>' +

    '<div style="height:1px;background-color:#eeeeee;margin:0 40px 20px;"></div>' +

    '<div style="padding:0 40px 32px;" class="content-pad">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
    '<tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#444444;padding:6px 0;">Next billing date</td>' +
    '<td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;text-align:right;padding:6px 0;">1st of next month</td></tr>' +
    '<tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#444444;padding:6px 0;">Monthly subscription</td>' +
    '<td style="font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#0b1928;text-align:right;padding:6px 0;">$69.00</td></tr>' +
    '</table>' +
    '<p style="font-family:Arial,sans-serif;font-size:13px;color:#888888;margin:16px 0 0 0;line-height:1.6;">' +
    'Questions about your account? Reply to this email or visit <a href="https://zeromisscall.com/contact.html" style="color:#E8791A;">zeromisscall.com/contact</a>' +
    '</p>' +
    '</div>';

  return {
    subject: plumber.businessName + " - Your " + monthName + " ZeroMissCall Report",
    html: wrapEmail(content, plumber.businessName + " - your " + monthName + " ZeroMissCall report. Estimated $" + estimatedRevenue + " recovered."),
  };
}

// -------------------------------------------------
// SEND FUNCTIONS
// -------------------------------------------------
async function sendWeeklyDigest(plumber, stats) {
  if (!plumber.email) return;
  var _ref = buildWeeklyDigestEmail(plumber, stats);
  try {
    var result = await resend.emails.send({ from: SENDERS.reports, to: plumber.email, subject: _ref.subject, html: _ref.html });
    console.log("Weekly digest sent to " + plumber.email);
    return result;
  } catch (err) {
    console.error("Weekly digest failed for " + plumber.email + ": " + err.message);
    throw err;
  }
}

async function sendTrialEndEmail(plumber, stats, conversations) {
  if (!plumber.email) return;
  var _ref = buildTrialEndEmail(plumber, stats, conversations);
  try {
    var result = await resend.emails.send({ from: SENDERS.trial, to: plumber.email, subject: _ref.subject, html: _ref.html });
    console.log("Trial end email sent to " + plumber.email);
    return result;
  } catch (err) {
    console.error("Trial end email failed for " + plumber.email + ": " + err.message);
    throw err;
  }
}

async function sendMonthlyReport(plumber, stats, monthName) {
  if (!plumber.email) return;
  var _ref = buildMonthlyReportEmail(plumber, stats, monthName);
  try {
    var result = await resend.emails.send({ from: SENDERS.reports, to: plumber.email, subject: _ref.subject, html: _ref.html });
    console.log("Monthly report sent to " + plumber.email);
    return result;
  } catch (err) {
    console.error("Monthly report failed for " + plumber.email + ": " + err.message);
    throw err;
  }
}

async function sendTestEmails(toEmail) {
  var testPlumber = {
    businessName: "Dave's Plumbing Co.",
    ownerName: "Dave",
    email: toEmail,
    ownerPhone: "+15551234567",
    averageJobValue: 250,
    dashboardToken: "test-token-123",
    trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  };
  var testStats = {
    totalConversations: 9,
    leadsCaptures: 6,
    emergencies: 1,
    estimatedRevenue: 2250,
    weekOf: "May 26 - Jun 1, 2026",
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

  await sendWelcomeEmail(testPlumber);
  await sendWeeklyDigest(testPlumber, testStats);
  await sendTrialEndEmail(testPlumber, testStats, [testStats.bestConvo]);
  await sendMonthlyReport(testPlumber, testStats, "May 2026");
  console.log("All 4 test emails sent to " + toEmail);
}

module.exports = {
  sendWelcomeEmail,
  sendWeeklyDigest,
  sendTrialEndEmail,
  sendMonthlyReport,
  sendTestEmails,
  buildWelcomeEmail,
  buildWeeklyDigestEmail,
  buildTrialEndEmail,
  buildMonthlyReportEmail,
};
