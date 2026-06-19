// ─────────────────────────────────────────────────────────────
// SALES DASHBOARD — STEP 3
// ZeroMissCall outbound sales machine
//
// HOW TO USE:
// 1. Save this file as sales.js (replaces the Step 2 version)
// 2. server.js integration is unchanged:
//      const { registerSalesRoutes } = require("./sales");
//      registerSalesRoutes(app, db);
//
// WHAT THIS DOES (Steps 1 + 2 + 3):
//   GET  /admin/sales                  → sales dashboard HTML page
//   POST /admin/sales/leads            → add a lead manually
//   PUT  /admin/sales/leads/:id        → edit a lead
//   POST /admin/sales/leads/:id/log    → one-tap call logging
//   POST /admin/sales/import/csv       → bulk import leads from CSV  [NEW]
//   POST /admin/sales/import/osm       → free OpenStreetMap city     [NEW]
//                                        search (no API key needed)
//
// FREE DATA SOURCES THAT FEED THE CSV IMPORT:
//   - State plumbing license rosters (TX TDLR, FL DBPR, etc.)
//   - Scraper tool free-trial exports (Outscraper, Scrap.io)
//   - Anything you compile by hand in a spreadsheet
//
// Coming in Step 4:
//   auto-match signups to leads (invite → trial tracking)
//
// REQUIRES: email2.js in the same folder, Node 18+ (for fetch -
// Railway's default is fine)
// ─────────────────────────────────────────────────────────────

const { ObjectId } = require("mongodb");
const email2 = require("./email2");
const { createPendingSignup } = require("./admin");

// ── FAVICON (optional) ───────────────────────
// Paste the same base64 favicon string you used in admin.js
// between the quotes below. Leave as-is and the page just
// won't have a favicon - everything else works fine.
var SALES_FAVICON = "PASTE_YOUR_BASE64_FAVICON_STRING_HERE";

// ─────────────────────────────────────────────
// STATE → TIMEZONE MAP (v1: primary timezone per state)
// ─────────────────────────────────────────────
var STATE_TZ = {
  AL: "America/Chicago",     AK: "America/Anchorage",   AZ: "America/Phoenix",
  AR: "America/Chicago",     CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York",    DE: "America/New_York",    FL: "America/New_York",
  GA: "America/New_York",    HI: "Pacific/Honolulu",    ID: "America/Boise",
  IL: "America/Chicago",     IN: "America/New_York",    IA: "America/Chicago",
  KS: "America/Chicago",     KY: "America/New_York",    LA: "America/Chicago",
  ME: "America/New_York",    MD: "America/New_York",    MA: "America/New_York",
  MI: "America/New_York",    MN: "America/Chicago",     MS: "America/Chicago",
  MO: "America/Chicago",     MT: "America/Denver",      NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York",    NJ: "America/New_York",
  NM: "America/Denver",      NY: "America/New_York",    NC: "America/New_York",
  ND: "America/Chicago",     OH: "America/New_York",    OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York",    RI: "America/New_York",
  SC: "America/New_York",    SD: "America/Chicago",     TN: "America/Chicago",
  TX: "America/Chicago",     UT: "America/Denver",      VT: "America/New_York",
  VA: "America/New_York",    WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago",     WY: "America/Denver",      DC: "America/New_York",
};

var TZ_LABEL = {
  "America/New_York":    "ET",
  "America/Chicago":     "CT",
  "America/Denver":      "MT",
  "America/Phoenix":     "MST",
  "America/Boise":       "MT",
  "America/Los_Angeles": "PT",
  "America/Anchorage":   "AKT",
  "Pacific/Honolulu":    "HT",
};

var STAGES = ["new", "no_answer", "spoke", "interested", "invited", "signed_up", "trial", "customer", "lost"];

var STAGE_META = {
  new:        { label: "NEW",        color: "#6b84a0" },
  no_answer:  { label: "NO ANSWER",  color: "#96aec6" },
  spoke:      { label: "SPOKE",      color: "#4a9eda" },
  interested: { label: "INTERESTED", color: "#E8791A" },
  invited:    { label: "INVITED",    color: "#d4a017" },
  signed_up:  { label: "SIGNED UP",  color: "#a78bfa" },
  trial:      { label: "TRIAL",      color: "#3ecf8e" },
  customer:   { label: "CUSTOMER",   color: "#3ecf8e" },
  lost:       { label: "LOST",       color: "#f05252" },
};

var OUTCOMES = {
  no_answer:      { stage: "no_answer",  connect: false, label: "No Answer" },
  voicemail:      { stage: "no_answer",  connect: false, label: "Voicemail" },
  spoke:          { stage: "spoke",      connect: true,  label: "Spoke" },
  not_interested: { stage: "lost",       connect: true,  label: "Not Interested" },
  interested:     { stage: "interested", connect: true,  label: "Interested" },
};

var CALLABLE_STAGES = ["new", "no_answer", "spoke"];

var MAX_CSV_ROWS = 2000;

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE (same pattern as admin.js)
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
// HELPERS
// ─────────────────────────────────────────────
function normalizePhone(raw) {
  if (!raw) return null;
  var digits = String(raw).replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
  if (String(raw).trim().charAt(0) === "+" && digits.length >= 10) return "+" + digits;
  return null;
}

function timezoneForState(state) {
  if (!state) return "America/Chicago";
  var key = String(state).trim().toUpperCase();
  return STATE_TZ[key] || "America/Chicago";
}

function localTimeFor(timezone) {
  try {
    var now = new Date();
    var time = now.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    });
    var hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(now)
    );
    return { time: time, hour: hour };
  } catch (e) {
    return { time: "-", hour: 12 };
  }
}

function inCallingWindow(timezone) {
  var lt = localTimeFor(timezone);
  return lt.hour >= 8 && lt.hour < 18;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJs(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function validateLeadData(data) {
  var errors = [];
  if (!data.businessName || !String(data.businessName).trim()) {
    errors.push("businessName is required");
  }
  var phone = normalizePhone(data.phone);
  if (!phone) {
    errors.push("phone is required and must be a valid US number (10 digits)");
  }
  if (data.email && !String(data.email).includes("@")) {
    errors.push("email must be a valid email address");
  }
  return { errors: errors, phone: phone };
}

function newLeadDoc(fields, source) {
  var now = new Date();
  var state = fields.state ? String(fields.state).trim().toUpperCase() : "";
  var lead = {
    businessName: String(fields.businessName).trim(),
    phone:        fields.phone,
    email:        fields.email ? String(fields.email).trim() : null,
    ownerName:    fields.ownerName ? String(fields.ownerName).trim() : null,
    website:      fields.website ? String(fields.website).trim() : null,
    city:         fields.city ? String(fields.city).trim() : null,
    state:        state || null,
    zip:          fields.zip ? String(fields.zip).trim() : null,
    timezone:     timezoneForState(state),
    source:       source,
    stage:        "new",
    doNotCall:    false,
    notes:        [],
    callbackAt:   null,
    callAttempts: [],
    createdAt:    now,
    updatedAt:    now,
  };
  if (fields.note && String(fields.note).trim()) {
    lead.notes.push({ at: now, text: String(fields.note).trim() });
  }
  return lead;
}

// ─────────────────────────────────────────────
// CSV PARSER — handles quoted fields with commas
// Rows are newline-separated (quoted newlines not supported in v1)
// ─────────────────────────────────────────────
function parseCsvLine(line) {
  var fields = [];
  var cur = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields.map(function(f) { return f.trim(); });
}

// Flexible header matching - works with state license rosters,
// scraper exports, and hand-made spreadsheets
var HEADER_MAP = {
  businessName: ["businessname", "business", "name", "company", "companyname", "title", "dba", "tradename"],
  phone:        ["phone", "phonenumber", "telephone", "tel", "phone1", "businessphone", "mobile", "cell"],
  email:        ["email", "emailaddress", "mail"],
  ownerName:    ["ownername", "owner", "contact", "contactname", "firstname", "fullname", "licensee", "licenseholder", "principal"],
  city:         ["city", "town", "municipality"],
  state:        ["state", "st", "region", "province"],
  zip:          ["zip", "zipcode", "postalcode", "postcode"],
  website:      ["website", "url", "web", "site", "domain", "homepage"],
};

function mapHeaders(headerRow) {
  var mapping = {};
  for (var i = 0; i < headerRow.length; i++) {
    var clean = String(headerRow[i]).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var field in HEADER_MAP) {
      if (mapping[field] === undefined && HEADER_MAP[field].indexOf(clean) !== -1) {
        mapping[field] = i;
      }
    }
  }
  return mapping;
}

// ─────────────────────────────────────────────
// STATS — computed from callAttempts + stages
// ─────────────────────────────────────────────
function computeStats(leads) {
  var now = new Date();
  var todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  var weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000);

  var dialsToday = 0;
  var dialsWeek  = 0;
  var dialsAll   = 0;
  var connectsWeek = 0;

  for (var i = 0; i < leads.length; i++) {
    var attempts = leads[i].callAttempts || [];
    for (var j = 0; j < attempts.length; j++) {
      var a = attempts[j];
      var at = new Date(a.at);
      dialsAll++;
      if (at >= weekStart) {
        dialsWeek++;
        var meta = OUTCOMES[a.outcome];
        if (meta && meta.connect) connectsWeek++;
      }
      if (at >= todayStart) dialsToday++;
    }
  }

  var invited   = leads.filter(function(l) { return ["invited", "signed_up", "trial", "customer"].indexOf(l.stage) !== -1; }).length;
  var trials    = leads.filter(function(l) { return l.stage === "trial" || l.stage === "customer"; }).length;
  var customers = leads.filter(function(l) { return l.stage === "customer"; }).length;

  return {
    dialsToday:   dialsToday,
    dialsWeek:    dialsWeek,
    dialsAll:     dialsAll,
    connectRate:  dialsWeek > 0 ? Math.round((connectsWeek / dialsWeek) * 100) : 0,
    invited:      invited,
    trials:       trials,
    customers:    customers,
    dialsPerCustomer: customers > 0 ? Math.round(dialsAll / customers) : null,
  };
}

// ─────────────────────────────────────────────
// CALL QUEUE
// ─────────────────────────────────────────────
function buildQueue(leads) {
  var now = new Date();

  var active = leads.filter(function(l) {
    return !l.doNotCall && CALLABLE_STAGES.indexOf(l.stage) !== -1;
  });

  var dueCallbacks = active.filter(function(l) {
    return l.callbackAt && new Date(l.callbackAt) <= now;
  });
  dueCallbacks.sort(function(a, b) { return new Date(a.callbackAt) - new Date(b.callbackAt); });

  var ready = active.filter(function(l) {
    if (l.callbackAt) return false;
    return inCallingWindow(l.timezone);
  });
  ready.sort(function(a, b) {
    var aNew = a.stage === "new" ? 0 : 1;
    var bNew = b.stage === "new" ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;
    var aLast = (a.callAttempts && a.callAttempts.length > 0) ? new Date(a.callAttempts[a.callAttempts.length - 1].at) : new Date(0);
    var bLast = (b.callAttempts && b.callAttempts.length > 0) ? new Date(b.callAttempts[b.callAttempts.length - 1].at) : new Date(0);
    return aLast - bLast;
  });

  return { dueCallbacks: dueCallbacks, ready: ready.slice(0, 12) };
}

// ─────────────────────────────────────────────
// QUEUE CARD HTML
// ─────────────────────────────────────────────
function buildQueueCard(l, isCallback) {
  var lt = localTimeFor(l.timezone);
  var tzLabel = TZ_LABEL[l.timezone] || "";
  var location = [l.city, l.state].filter(Boolean).join(", ") || "-";
  var attemptsCount = (l.callAttempts || []).length;
  var lastNote = (l.notes && l.notes.length > 0) ? l.notes[l.notes.length - 1].text : "";
  var ownerAttr = escapeJs(l.ownerName || "");
  var emailAttr = escapeJs(l.email || "");
  var meta = STAGE_META[l.stage] || STAGE_META.new;
  var inWindow = lt.hour >= 8 && lt.hour < 18;

  var badge = isCallback
    ? "<span style='background:rgba(232,121,26,0.15);color:#E8791A;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:800;'>CALLBACK DUE</span>"
    : "<span style='color:" + meta.color + ";font-size:10px;font-weight:800;letter-spacing:0.5px;'>" + meta.label + "</span>";

  var windowNote = !inWindow
    ? "<span style='color:#f05252;font-size:11px;font-weight:700;margin-left:8px;'>outside their window</span>"
    : "";

  var btn = function(label, outcome, bg, color, border) {
    return "<button onclick='logCall(\"" + l._id + "\",\"" + outcome + "\",\"" + emailAttr + "\",\"" + ownerAttr + "\")' " +
      "style='background:" + bg + ";border:1px solid " + border + ";color:" + color + ";border-radius:8px;padding:9px 14px;font-family:Nunito,sans-serif;font-size:12px;font-weight:800;cursor:pointer;'>" + label + "</button>";
  };

  return "<div style='background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:18px;margin-bottom:12px;'>" +
    "<div style='display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;'>" +
    "<div>" +
    "<div style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;color:#fff;'>" + escapeHtml(l.businessName) + " " + badge + "</div>" +
    "<div style='font-size:12px;color:#6b84a0;margin-top:3px;'>" + escapeHtml(l.ownerName || "owner unknown") + " &mdash; " + escapeHtml(location) +
    " &mdash; <span style='color:" + (inWindow ? "#3ecf8e" : "#f05252") + ";font-weight:700;'>" + lt.time + " " + tzLabel + "</span>" + windowNote +
    " &mdash; " + attemptsCount + " attempt" + (attemptsCount !== 1 ? "s" : "") + "</div>" +
    (lastNote ? "<div style='font-size:12px;color:#96aec6;margin-top:5px;'>&#8220;" + escapeHtml(lastNote) + "&#8221;</div>" : "") +
    "</div>" +
    "<a href='tel:" + escapeHtml(l.phone) + "' style='font-family:Nunito,sans-serif;font-size:18px;font-weight:900;color:#E8791A;text-decoration:none;white-space:nowrap;'>" + escapeHtml(l.phone) + "</a>" +
    "</div>" +
    "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;'>" +
    btn("No Answer", "no_answer", "rgba(255,255,255,0.05)", "#96aec6", "rgba(255,255,255,0.12)") +
    btn("Voicemail", "voicemail", "rgba(255,255,255,0.05)", "#96aec6", "rgba(255,255,255,0.12)") +
    btn("Spoke", "spoke", "rgba(74,158,218,0.12)", "#4a9eda", "rgba(74,158,218,0.3)") +
    btn("Not Interested", "not_interested", "rgba(240,82,82,0.1)", "#f05252", "rgba(240,82,82,0.25)") +
    btn("Interested &#8594; Invite", "interested", "#E8791A", "#fff", "#E8791A") +
    "<button onclick='signupOnCall(\"" + l._id + "\",\"" + emailAttr + "\",\"" + ownerAttr + "\")' style='background:#3ecf8e;border:1px solid #3ecf8e;color:#06281c;border-radius:8px;padding:9px 14px;font-family:Nunito,sans-serif;font-size:12px;font-weight:900;cursor:pointer;'>&#9989; Sign Up On Call</button>" +
    "<button onclick='setCallback(\"" + l._id + "\")' style='background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.2);color:#6b84a0;border-radius:8px;padding:9px 14px;font-family:Nunito,sans-serif;font-size:12px;font-weight:800;cursor:pointer;'>&#128197; Callback</button>" +
    "</div>" +
    "</div>";
}

// ─────────────────────────────────────────────
// SALES DASHBOARD HTML
// ─────────────────────────────────────────────
function buildSalesDashboardHtml(leads, imports) {
  var now = new Date();
  var stats = computeStats(leads);
  var queue = buildQueue(leads);

  var total      = leads.length;
  var fresh      = leads.filter(function(l) { return l.stage === "new"; }).length;
  var interested = leads.filter(function(l) { return l.stage === "interested" || l.stage === "invited" || l.stage === "signed_up"; }).length;
  var won        = leads.filter(function(l) { return l.stage === "trial" || l.stage === "customer"; }).length;
  var dnc        = leads.filter(function(l) { return l.doNotCall; }).length;

  function card(n, label, color) {
    return "<div style='background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;text-align:center;'>" +
      "<div style='font-family:Nunito,sans-serif;font-size:28px;font-weight:900;color:" + color + ";letter-spacing:-1px;'>" + n + "</div>" +
      "<div style='font-size:11px;color:#6b84a0;margin-top:4px;'>" + label + "</div>" +
      "</div>";
  }

  var pipelineCards =
    card(total, "Total Leads", "#fff") +
    card(fresh, "New (Not Called)", "#6b84a0") +
    card(interested, "Interested / Invited", "#E8791A") +
    card(won, "Trial / Customer", "#3ecf8e") +
    card(dnc, "Do Not Call", "#f05252");

  var activityCards =
    card(stats.dialsToday, "Dials Today", "#fff") +
    card(stats.dialsWeek, "Dials (7 Days)", "#fff") +
    card(stats.connectRate + "%", "Connect Rate (7d)", stats.connectRate >= 20 ? "#3ecf8e" : "#E8791A") +
    card(stats.invited, "Invites Sent", "#d4a017") +
    card(stats.dialsPerCustomer !== null ? stats.dialsPerCustomer : "-", "Dials per Customer", "#3ecf8e");

  // ── Call queue ──
  var queueHtml = "";
  if (queue.dueCallbacks.length > 0) {
    queueHtml += "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;margin:24px 0 12px;'>Callbacks Due (" + queue.dueCallbacks.length + ")</h2>";
    queueHtml += queue.dueCallbacks.map(function(l) { return buildQueueCard(l, true); }).join("");
  }
  queueHtml += "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;margin:24px 0 12px;'>Ready to Call (" + queue.ready.length + ")</h2>";
  if (queue.ready.length > 0) {
    queueHtml += queue.ready.map(function(l) { return buildQueueCard(l, false); }).join("");
  } else {
    queueHtml += "<div style='background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.2);border-radius:12px;padding:14px 18px;font-size:13px;color:#3ecf8e;'>" +
      "Nothing in the calling window right now. Leads appear here when it's 8am&ndash;6pm their local time.</div>";
  }

  // ── Import section ──
  var stateOptions = Object.keys(STATE_TZ).sort().map(function(s) {
    return "<option value='" + s + "'>" + s + "</option>";
  }).join("");

  var inputStyle = "background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;font-family:DM Sans,sans-serif;outline:none;width:100%;";

  var recentImports = "";
  if (imports && imports.length > 0) {
    recentImports = "<div style='margin-top:18px;'>" +
      "<div style='font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b84a0;font-weight:600;margin-bottom:6px;'>Recent imports</div>" +
      imports.map(function(imp) {
        var when = imp.at ? new Date(imp.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-";
        return "<div style='display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;'>" +
          "<span style='color:#fff;font-weight:600;'>" + escapeHtml(imp.label || imp.type) + "</span>" +
          "<span style='color:#6b84a0;'>" + imp.inserted + " added &middot; " + (imp.duplicates || 0) + " dupes &middot; " + when + "</span>" +
          "</div>";
      }).join("") +
      "</div>";
  }

  var importSection =
    "<details style='margin-top:24px;'>" +
    "<summary style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;cursor:pointer;margin-bottom:12px;color:#E8791A;'>&#11015; Import Leads (CSV / OpenStreetMap)</summary>" +
    "<div style='background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;padding:20px;'>" +

    // -- OSM search --
    "<p style='font-family:Nunito,sans-serif;font-size:13px;font-weight:800;color:#fff;margin-bottom:8px;'>Search OpenStreetMap (free, no key)</p>" +
    "<p style='font-size:12px;color:#6b84a0;margin-bottom:12px;'>Finds plumbers mapped in a city. Coverage is patchy and phone numbers are hit-and-miss, but it costs nothing. Only results with a phone number are imported.</p>" +
    "<div style='display:flex;gap:10px;flex-wrap:wrap;'>" +
    "<input id='osm-city' type='text' placeholder='City (e.g. Dallas)' style='" + inputStyle + "flex:2;min-width:180px;width:auto;'/>" +
    "<select id='osm-state' style='" + inputStyle + "flex:1;min-width:100px;width:auto;'><option value=''>State...</option>" + stateOptions + "</select>" +
    "<button id='osm-btn' onclick='importOsm()' style='background:#E8791A;color:#fff;border:none;border-radius:8px;padding:11px 22px;font-family:Nunito,sans-serif;font-size:13px;font-weight:800;cursor:pointer;'>Search &amp; Import</button>" +
    "</div>" +
    "<div id='osm-msg' style='font-size:13px;margin-top:10px;min-height:16px;'></div>" +

    "<div style='height:1px;background:rgba(255,255,255,0.08);margin:20px 0;'></div>" +

    // -- CSV import --
    "<p style='font-family:Nunito,sans-serif;font-size:13px;font-weight:800;color:#fff;margin-bottom:8px;'>Import CSV</p>" +
    "<p style='font-size:12px;color:#6b84a0;margin-bottom:12px;'>Works with state license rosters, scraper exports, or your own spreadsheet. First row must be headers - it auto-detects columns like name/company, phone, email, owner/licensee, city, state, zip, website. Rows without a valid phone are skipped.</p>" +
    "<div style='display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;'>" +
    "<input id='csv-file' type='file' accept='.csv,text/csv' style='color:#96aec6;font-size:13px;'/>" +
    "<select id='csv-state' style='" + inputStyle + "width:auto;min-width:170px;'><option value=''>Default state (optional)...</option>" + stateOptions + "</select>" +
    "<input id='csv-label' type='text' placeholder='Label (e.g. TX license roster)' style='" + inputStyle + "width:auto;min-width:200px;flex:1;'/>" +
    "</div>" +
    "<textarea id='csv-text' placeholder='...or paste CSV text here' rows='4' style='" + inputStyle + "resize:vertical;font-size:12px;'></textarea>" +
    "<div style='display:flex;align-items:center;gap:14px;margin-top:12px;'>" +
    "<button id='csv-btn' onclick='importCsv()' style='background:#E8791A;color:#fff;border:none;border-radius:8px;padding:11px 28px;font-family:Nunito,sans-serif;font-size:14px;font-weight:800;cursor:pointer;'>Import CSV</button>" +
    "<span id='csv-msg' style='font-size:13px;'></span>" +
    "</div>" +
    recentImports +
    "</div>" +
    "</details>";

  // ── Stage filter options ──
  var stageOptions = "<option value='all'>All stages</option>" +
    STAGES.map(function(s) {
      return "<option value='" + s + "'>" + STAGE_META[s].label + "</option>";
    }).join("");

  // ── Lead table rows ──
  var rows = leads.map(function(l) {
    var meta = STAGE_META[l.stage] || STAGE_META.new;
    var lt = localTimeFor(l.timezone);
    var inWindow = lt.hour >= 8 && lt.hour < 18;
    var timeColor = inWindow ? "#3ecf8e" : "#f05252";
    var tzLabel = TZ_LABEL[l.timezone] || "";
    var location = [l.city, l.state].filter(Boolean).join(", ") || "-";
    var lastNote = (l.notes && l.notes.length > 0) ? l.notes[l.notes.length - 1].text : "";
    var attemptsCount = (l.callAttempts || []).length;
    var dncStyle = l.doNotCall ? "opacity:0.45;" : "";
    var websiteLink = l.website
      ? " <a href='" + escapeHtml(l.website) + "' target='_blank' style='color:#6b84a0;font-size:11px;text-decoration:none;'>site &#8599;</a>"
      : "";
    var callbackInfo = l.callbackAt
      ? "<div style='font-size:10px;color:#E8791A;font-weight:700;margin-top:2px;'>&#128197; " +
        new Date(l.callbackAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
        new Date(l.callbackAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</div>"
      : "";

    return "<tr class='lead-row' data-stage='" + l.stage + "' style='border-bottom:1px solid rgba(255,255,255,0.07);" + dncStyle + "'>" +
      "<td style='padding:12px 16px;font-size:13px;color:#fff;font-weight:600;'>" +
        escapeHtml(l.businessName) + websiteLink +
        "<div style='font-size:11px;color:#6b84a0;margin-top:2px;'>" + escapeHtml(l.ownerName || "owner unknown") + "</div>" +
      "</td>" +
      "<td style='padding:12px 16px;'>" +
        "<a href='tel:" + escapeHtml(l.phone) + "' style='color:#E8791A;font-size:13px;font-weight:700;text-decoration:none;'>" + escapeHtml(l.phone) + "</a>" +
        "<div style='font-size:11px;color:#6b84a0;margin-top:2px;'>" + escapeHtml(l.email || "no email") + "</div>" +
      "</td>" +
      "<td style='padding:12px 16px;font-size:12px;color:#96aec6;'>" +
        escapeHtml(location) +
        "<div style='font-size:11px;color:" + timeColor + ";margin-top:2px;font-weight:700;'>" + lt.time + " " + tzLabel + "</div>" +
      "</td>" +
      "<td style='padding:12px 16px;text-align:center;'>" +
        "<span style='color:" + meta.color + ";font-size:11px;font-weight:800;letter-spacing:0.5px;'>" + meta.label + "</span>" +
        "<div style='font-size:10px;color:#6b84a0;margin-top:2px;'>" + attemptsCount + " call" + (attemptsCount !== 1 ? "s" : "") + "</div>" +
        callbackInfo +
        (l.doNotCall ? "<div style='font-size:10px;color:#f05252;font-weight:800;margin-top:2px;'>DNC</div>" : "") +
      "</td>" +
      "<td class='hide-mobile' style='padding:12px 16px;font-size:12px;color:#96aec6;max-width:200px;'>" + escapeHtml(lastNote) + "</td>" +
      "<td style='padding:12px 16px;text-align:center;white-space:nowrap;'>" +
        "<button onclick='editLead(\"" + l._id + "\")' style='background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#96aec6;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px;'>Edit</button>" +
        "<button onclick='toggleDnc(\"" + l._id + "\"," + (l.doNotCall ? "false" : "true") + ")' style='background:rgba(240,82,82,0.1);border:1px solid rgba(240,82,82,0.25);color:#f05252;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;'>" + (l.doNotCall ? "Un-DNC" : "DNC") + "</button>" +
      "</td>" +
      "</tr>";
  }).join("");

  // ── Add Lead form ──
  var addLeadForm =
    "<details style='margin-top:16px;'>" +
    "<summary style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;cursor:pointer;margin-bottom:12px;color:#E8791A;'>+ Add Lead Manually</summary>" +
    "<div style='background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;padding:20px;'>" +
    "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;'>" +
    "<input id='lead-business' type='text' placeholder='Business name *' style='" + inputStyle + "'/>" +
    "<input id='lead-phone' type='tel' placeholder='Phone * (e.g. 214 555 0001)' style='" + inputStyle + "'/>" +
    "<input id='lead-owner' type='text' placeholder='Owner name' style='" + inputStyle + "'/>" +
    "<input id='lead-email' type='email' placeholder='Email' style='" + inputStyle + "'/>" +
    "<input id='lead-website' type='text' placeholder='Website' style='" + inputStyle + "'/>" +
    "<input id='lead-city' type='text' placeholder='City' style='" + inputStyle + "'/>" +
    "<select id='lead-state' style='" + inputStyle + "'><option value=''>State...</option>" + stateOptions + "</select>" +
    "<input id='lead-note' type='text' placeholder='Note (optional)' style='" + inputStyle + "'/>" +
    "</div>" +
    "<div style='display:flex;align-items:center;gap:14px;margin-top:14px;'>" +
    "<button id='lead-btn' onclick='addLead()' style='background:#E8791A;color:#fff;border:none;border-radius:8px;padding:11px 28px;font-family:Nunito,sans-serif;font-size:14px;font-weight:800;cursor:pointer;'>Add Lead</button>" +
    "<span id='lead-msg' style='font-size:13px;'></span>" +
    "</div>" +
    "</div>" +
    "</details>";

  // ── Page JS ──
  var script =
    "<script>" +
    "function getSecret(){return new URLSearchParams(window.location.search).get('secret');}" +

    "async function importOsm(){" +
    "var city=document.getElementById('osm-city').value.trim();" +
    "var state=document.getElementById('osm-state').value;" +
    "var msg=document.getElementById('osm-msg');" +
    "var btn=document.getElementById('osm-btn');" +
    "if(!city||!state){msg.style.color='#f05252';msg.textContent='City and state are both required';return;}" +
    "btn.disabled=true;btn.textContent='Searching... (can take 30s)';msg.style.color='#96aec6';msg.textContent='Querying OpenStreetMap...';" +
    "try{" +
    "var r=await fetch('/admin/sales/import/osm?secret='+encodeURIComponent(getSecret()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city:city,state:state})});" +
    "var d=await r.json();" +
    "if(r.ok){msg.style.color='#3ecf8e';msg.textContent=d.message;if(d.inserted>0){setTimeout(function(){location.reload();},1800);}else{btn.disabled=false;btn.textContent='Search & Import';}}" +
    "else{msg.style.color='#f05252';msg.textContent=(d&&(d.message||d.error))||'Import failed';btn.disabled=false;btn.textContent='Search & Import';}" +
    "}catch(e){msg.style.color='#f05252';msg.textContent='Network error: '+e.message;btn.disabled=false;btn.textContent='Search & Import';}" +
    "}" +

    "async function importCsv(){" +
    "var msg=document.getElementById('csv-msg');" +
    "var btn=document.getElementById('csv-btn');" +
    "var fileInput=document.getElementById('csv-file');" +
    "var text=document.getElementById('csv-text').value;" +
    "var label=document.getElementById('csv-label').value.trim();" +
    "var defaultState=document.getElementById('csv-state').value;" +
    "if(fileInput.files&&fileInput.files.length>0){" +
    "text=await fileInput.files[0].text();" +
    "if(!label)label=fileInput.files[0].name;" +
    "}" +
    "if(!text||!text.trim()){msg.style.color='#f05252';msg.textContent='Choose a CSV file or paste CSV text';return;}" +
    "btn.disabled=true;btn.textContent='Importing...';msg.textContent='';" +
    "try{" +
    "var r=await fetch('/admin/sales/import/csv?secret='+encodeURIComponent(getSecret()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv:text,label:label,defaultState:defaultState})});" +
    "var d=await r.json();" +
    "if(r.ok){msg.style.color='#3ecf8e';msg.textContent=d.message;if(d.inserted>0){setTimeout(function(){location.reload();},1800);}else{btn.disabled=false;btn.textContent='Import CSV';}}" +
    "else{msg.style.color='#f05252';msg.textContent=(d&&(d.message||d.error))||'Import failed';btn.disabled=false;btn.textContent='Import CSV';}" +
    "}catch(e){msg.style.color='#f05252';msg.textContent='Network error: '+e.message;btn.disabled=false;btn.textContent='Import CSV';}" +
    "}" +

    "async function logCall(id,outcome,email,owner){" +
    "var body={outcome:outcome};" +
    "if(outcome==='spoke'){" +
    "var note=prompt('Quick note from the call:');" +
    "if(note===null)return;" +
    "if(note.trim())body.note=note.trim();" +
    "}" +
    "if(outcome==='interested'){" +
    "var useEmail=email;" +
    "if(!useEmail){" +
    "useEmail=prompt('Their email for the invitation:');" +
    "if(useEmail===null)return;" +
    "useEmail=useEmail.trim();" +
    "if(useEmail&&useEmail.indexOf('@')!==-1){body.email=useEmail;}" +
    "else{alert('No valid email - lead will be marked INTERESTED but no invite sent. Add their email via Edit and tap Interested again to send it.');}" +
    "}" +
    "var useName=owner;" +
    "if(!useName){" +
    "useName=prompt('Their first name (optional, makes the invite personal):');" +
    "if(useName&&useName.trim())body.name=useName.trim();" +
    "}" +
    "var inote=prompt('Quick note from the call (optional):');" +
    "if(inote&&inote.trim())body.note=inote.trim();" +
    "}" +
    "try{" +
    "var r=await fetch('/admin/sales/leads/'+id+'/log?secret='+encodeURIComponent(getSecret()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});" +
    "var d=await r.json();" +
    "if(r.ok){location.reload();}" +
    "else{alert((d&&(d.message||d.error))||'Failed to log call');}" +
    "}catch(e){alert('Network error: '+e.message);}" +
    "}" +

    "async function signupOnCall(id,email,owner){" +
    "var useEmail=email;" +
    "if(!useEmail){useEmail=prompt('Their email (required to set them up):');if(useEmail===null)return;useEmail=useEmail.trim();}" +
    "if(!useEmail||useEmail.indexOf('@')===-1){alert('A valid email is required to sign them up.');return;}" +
    "var useName=owner;" +
    "if(!useName){useName=prompt('Their first name (optional):');if(useName)useName=useName.trim();}" +
    "if(!confirm('Set up '+useEmail+' now? They will get a confirmation email to click while you are on the call.'))return;" +
    "try{" +
    "var r=await fetch('/admin/sales/leads/'+id+'/signup?secret='+encodeURIComponent(getSecret()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:useEmail,name:useName||''})});" +
    "var d=await r.json();" +
    "if(r.ok){alert(d.message||'Signed up - tell them to check their email and click the link now.');location.reload();}" +
    "else{alert((d&&(d.message||d.error))||'Sign up failed');}" +
    "}catch(e){alert('Network error: '+e.message);}" +
    "}" +

    "async function setCallback(id){" +
    "var hours=prompt('Call back in how many hours? (e.g. 2 = later today, 24 = tomorrow, 0 = clear callback)');" +
    "if(hours===null)return;" +
    "hours=Number(hours);" +
    "if(isNaN(hours)||hours<0){alert('Enter a number of hours');return;}" +
    "try{" +
    "var r=await fetch('/admin/sales/leads/'+id+'?secret='+encodeURIComponent(getSecret()),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({callbackHours:hours})});" +
    "if(r.ok){location.reload();}else{var d=await r.json();alert((d&&(d.message||d.error))||'Update failed');}" +
    "}catch(e){alert('Network error: '+e.message);}" +
    "}" +

    "async function addLead(){" +
    "var msg=document.getElementById('lead-msg');" +
    "var btn=document.getElementById('lead-btn');" +
    "var body={" +
    "businessName:document.getElementById('lead-business').value.trim()," +
    "phone:document.getElementById('lead-phone').value.trim()," +
    "ownerName:document.getElementById('lead-owner').value.trim()," +
    "email:document.getElementById('lead-email').value.trim()," +
    "website:document.getElementById('lead-website').value.trim()," +
    "city:document.getElementById('lead-city').value.trim()," +
    "state:document.getElementById('lead-state').value," +
    "note:document.getElementById('lead-note').value.trim()" +
    "};" +
    "if(!body.businessName){msg.style.color='#f05252';msg.textContent='Business name is required';return;}" +
    "if(!body.phone){msg.style.color='#f05252';msg.textContent='Phone is required';return;}" +
    "btn.disabled=true;btn.textContent='Adding...';msg.textContent='';" +
    "try{" +
    "var r=await fetch('/admin/sales/leads?secret='+encodeURIComponent(getSecret()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});" +
    "var d=await r.json();" +
    "if(r.ok){msg.style.color='#3ecf8e';msg.textContent='Lead added';setTimeout(function(){location.reload();},700);}" +
    "else{msg.style.color='#f05252';msg.textContent=(d&&(d.message||(d.details&&d.details.join(', '))||d.error))||'Failed';btn.disabled=false;btn.textContent='Add Lead';}" +
    "}catch(e){msg.style.color='#f05252';msg.textContent='Network error: '+e.message;btn.disabled=false;btn.textContent='Add Lead';}" +
    "}" +

    "async function editLead(id){" +
    "var email=prompt('Email for this lead (leave blank to skip):');" +
    "if(email===null)return;" +
    "var ownerName=prompt('Owner first name (leave blank to skip):');" +
    "if(ownerName===null)return;" +
    "var note=prompt('Add a note (leave blank to skip):');" +
    "if(note===null)return;" +
    "var body={};" +
    "if(email.trim())body.email=email.trim();" +
    "if(ownerName.trim())body.ownerName=ownerName.trim();" +
    "if(note.trim())body.note=note.trim();" +
    "if(Object.keys(body).length===0)return;" +
    "try{" +
    "var r=await fetch('/admin/sales/leads/'+id+'?secret='+encodeURIComponent(getSecret()),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});" +
    "if(r.ok){location.reload();}else{var d=await r.json();alert((d&&(d.message||d.error))||'Update failed');}" +
    "}catch(e){alert('Network error: '+e.message);}" +
    "}" +

    "async function toggleDnc(id,value){" +
    "try{" +
    "var r=await fetch('/admin/sales/leads/'+id+'?secret='+encodeURIComponent(getSecret()),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({doNotCall:value})});" +
    "if(r.ok){location.reload();}else{var d=await r.json();alert((d&&(d.message||d.error))||'Update failed');}" +
    "}catch(e){alert('Network error: '+e.message);}" +
    "}" +

    "function filterStage(){" +
    "var v=document.getElementById('stage-filter').value;" +
    "var rows=document.querySelectorAll('.lead-row');" +
    "for(var i=0;i<rows.length;i++){" +
    "rows[i].style.display=(v==='all'||rows[i].getAttribute('data-stage')===v)?'':'none';" +
    "}" +
    "}" +
    "<\/script>";

  var dateStr = now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  return "<!DOCTYPE html><html lang='en'><head>" +
    "<meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1.0'/>" +
    "<title>ZeroMissCall Sales</title>" +
    (SALES_FAVICON.indexOf("PASTE_") === 0 ? "" : "<link rel='icon' type='image/png' href='" + SALES_FAVICON + "'/>") +
    "<link href='https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500&display=swap' rel='stylesheet'>" +
    "<style>:root{--navy:#0b1928;--orange:#E8791A;--green:#3ecf8e;--border:rgba(255,255,255,0.07);}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#0b1928;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased;}.wrap{max-width:1100px;margin:0 auto;padding:0 20px 60px;}table{width:100%;border-collapse:collapse;}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b84a0;font-weight:600;padding:10px 16px;}tr:hover td{background:rgba(255,255,255,0.02);}input::placeholder,textarea::placeholder{color:#5a7390;}select option{background:#0b1928;color:#fff;}@media(max-width:900px){.hide-mobile{display:none;}}</style>" +
    "</head><body>" +
    "<div style='position:sticky;top:0;z-index:100;background:rgba(11,25,40,0.95);backdrop-filter:blur(24px);border-bottom:1px solid var(--border);padding:0 20px;'>" +
    "<div style='max-width:1100px;margin:0 auto;height:60px;display:flex;align-items:center;justify-content:space-between;'>" +
    "<span style='font-family:Nunito,sans-serif;font-weight:900;font-size:18px;'><span style='color:#E8791A;'>zero</span><span style='color:#fff;'>miss</span><span style='color:#E8791A;'>call</span> <span style='color:#6b84a0;font-size:13px;font-weight:600;'>Sales</span></span>" +
    "<span style='font-size:12px;color:#6b84a0;'>" + dateStr + "</span>" +
    "</div></div>" +
    "<div class='wrap' style='padding-top:28px;'>" +
    "<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px;'>" + pipelineCards + "</div>" +
    "<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px;'>" + activityCards + "</div>" +
    queueHtml +
    importSection +
    addLeadForm +
    "<div style='display:flex;align-items:center;justify-content:space-between;margin:24px 0 12px;'>" +
    "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;'>All Leads (" + total + ")</h2>" +
    "<select id='stage-filter' onchange='filterStage()' style='background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;font-size:13px;color:#fff;font-family:DM Sans,sans-serif;outline:none;'>" + stageOptions + "</select>" +
    "</div>" +
    "<div style='background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;overflow:hidden;'>" +
    "<table><thead><tr style='border-bottom:1px solid var(--border);'>" +
    "<th>Business</th><th>Phone / Email</th><th>Location / Local Time</th><th style='text-align:center;'>Stage</th><th class='hide-mobile'>Last Note</th><th style='text-align:center;'>Actions</th>" +
    "</tr></thead><tbody>" +
    (rows || "<tr><td colspan='6' style='padding:40px;text-align:center;color:#6b84a0;'>No leads yet - import some above or add one manually</td></tr>") +
    "</tbody></table></div>" +
    "<p style='font-size:12px;color:#6b84a0;margin-top:16px;text-align:center;'>Green local time = inside calling window (8am-6pm their time) &mdash; Red = outside window</p>" +
    "</div>" +
    script +
    "</body></html>";
}

// ─────────────────────────────────────────────
// OSM IMPORT — Nominatim geocode + Overpass query
// Both free, no API keys. Be a polite citizen:
// identify ourselves, low volume, 25km radius searches.
// ─────────────────────────────────────────────
async function fetchOsmPlumbers(city, state) {
  // 1. Geocode the city with Nominatim
  var nominatimUrl = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" +
    encodeURIComponent(city + ", " + state + ", USA");
  var geoRes = await fetch(nominatimUrl, {
    headers: { "User-Agent": "ZeroMissCall-Sales/1.0 (contact: ian@zeromisscall.com)" },
  });
  if (!geoRes.ok) throw new Error("Nominatim geocoding failed (" + geoRes.status + ")");
  var geo = await geoRes.json();
  if (!geo || geo.length === 0) throw new Error("Could not find '" + city + ", " + state + "' on OpenStreetMap");
  var lat = geo[0].lat;
  var lon = geo[0].lon;

  // 2. Overpass query: plumbers within 25km of the city centre
  var query =
    "[out:json][timeout:40];" +
    "(" +
    'nwr["craft"="plumber"](around:25000,' + lat + "," + lon + ");" +
    'nwr["shop"="plumber"](around:25000,' + lat + "," + lon + ");" +
    'nwr["trade"="plumbing"](around:25000,' + lat + "," + lon + ");" +
    ");" +
    "out center tags;";

  var opRes = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ZeroMissCall-Sales/1.0 (contact: ian@zeromisscall.com)",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!opRes.ok) throw new Error("Overpass query failed (" + opRes.status + ") - try again in a minute, the free server rate-limits");
  var data = await opRes.json();

  // 3. Normalize results
  var results = [];
  var elements = data.elements || [];
  for (var i = 0; i < elements.length; i++) {
    var tags = elements[i].tags || {};
    var name = tags.name;
    if (!name) continue;
    var rawPhone = tags.phone || tags["contact:phone"] || "";
    if (rawPhone.indexOf(";") !== -1) rawPhone = rawPhone.split(";")[0];
    results.push({
      businessName: name,
      phone:        rawPhone.trim(),
      website:      tags.website || tags["contact:website"] || null,
      email:        tags.email || tags["contact:email"] || null,
      city:         tags["addr:city"] || city,
      zip:          tags["addr:postcode"] || null,
    });
  }
  return results;
}

// ─────────────────────────────────────────────
// REGISTER SALES ROUTES
// ─────────────────────────────────────────────
function registerSalesRoutes(app, db, db_helpers, emailService) {

  // Indexes (safe to call on every boot)
  db.collection("leads").createIndex({ phone: 1 }).catch(function(e) {
    console.error("leads phone index error:", e.message);
  });
  db.collection("leads").createIndex({ stage: 1 }).catch(function(e) {
    console.error("leads stage index error:", e.message);
  });

  // ── SALES DASHBOARD PAGE ──────────────────────────────────
  app.get("/admin/sales", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const leads = await db.collection("leads")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      let imports = [];
      try {
        imports = await db.collection("lead_imports")
          .find({})
          .sort({ at: -1 })
          .limit(5)
          .toArray();
      } catch (impErr) {
        console.error("Could not load imports:", impErr.message);
      }
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache");
      res.send(buildSalesDashboardHtml(leads, imports));
    } catch (err) {
      res.status(500).send("Error: " + err.message);
    }
  });

  // ── IMPORT FROM CSV ───────────────────────────────────────
  // POST /admin/sales/import/csv
  // Body: { csv*, label?, defaultState? }
  app.post("/admin/sales/import/csv", requireAdminAuth, async (req, res) => {
    try {
      const csv = req.body.csv;
      if (!csv || !String(csv).trim()) {
        return res.status(400).json({ error: "Validation failed", message: "csv text is required" });
      }

      const lines = String(csv).split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
      if (lines.length < 2) {
        return res.status(400).json({ error: "Validation failed", message: "CSV needs a header row plus at least one data row" });
      }
      if (lines.length - 1 > MAX_CSV_ROWS) {
        return res.status(400).json({ error: "Too large", message: "Max " + MAX_CSV_ROWS + " rows per import - split the file" });
      }

      const headers = parseCsvLine(lines[0]);
      const map = mapHeaders(headers);
      if (map.businessName === undefined || map.phone === undefined) {
        return res.status(400).json({
          error: "Headers not recognised",
          message: "Could not find a business-name and phone column. Headers seen: " + headers.join(", ") +
            ". Rename columns to something like 'Business Name' and 'Phone' and retry.",
        });
      }

      const defaultState = req.body.defaultState ? String(req.body.defaultState).trim().toUpperCase() : "";

      // Parse rows
      const candidates = [];
      let invalid = 0;
      const seenPhones = {};
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i]);
        const get = function(field) {
          return map[field] !== undefined && cells[map[field]] !== undefined ? cells[map[field]] : "";
        };
        const businessName = get("businessName");
        const phone = normalizePhone(get("phone"));
        if (!businessName || !phone) { invalid++; continue; }
        if (seenPhones[phone]) { invalid++; continue; } // dupe within file
        seenPhones[phone] = true;
        candidates.push(newLeadDoc({
          businessName: businessName,
          phone:        phone,
          email:        get("email") || null,
          ownerName:    get("ownerName") || null,
          website:      get("website") || null,
          city:         get("city") || null,
          state:        get("state") || defaultState || null,
          zip:          get("zip") || null,
        }, "csv"));
      }

      if (candidates.length === 0) {
        return res.status(400).json({
          error: "Nothing to import",
          message: "0 usable rows - every row was missing a business name or valid 10-digit phone (" + invalid + " skipped)",
        });
      }

      // Dedupe against existing leads
      const phones = candidates.map(function(c) { return c.phone; });
      const existing = await db.collection("leads")
        .find({ phone: { $in: phones } })
        .project({ phone: 1 })
        .toArray();
      const existingSet = {};
      existing.forEach(function(e) { existingSet[e.phone] = true; });
      const fresh = candidates.filter(function(c) { return !existingSet[c.phone]; });
      const duplicates = candidates.length - fresh.length;

      let inserted = 0;
      if (fresh.length > 0) {
        const result = await db.collection("leads").insertMany(fresh, { ordered: false });
        inserted = result.insertedCount;
      }

      const label = req.body.label && String(req.body.label).trim() ? String(req.body.label).trim() : "CSV import";
      await db.collection("lead_imports").insertOne({
        type: "csv",
        label: label,
        inserted: inserted,
        duplicates: duplicates,
        invalid: invalid,
        at: new Date(),
      }).catch(function(e) { console.error("Import log failed:", e.message); });

      console.log("CSV import (" + label + "): " + inserted + " added, " + duplicates + " dupes, " + invalid + " invalid");

      res.json({
        success: true,
        inserted: inserted,
        duplicates: duplicates,
        invalid: invalid,
        message: inserted + " leads imported (" + duplicates + " already existed, " + invalid + " rows skipped)",
      });
    } catch (err) {
      console.error("CSV import error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── IMPORT FROM OPENSTREETMAP ─────────────────────────────
  // POST /admin/sales/import/osm
  // Body: { city*, state* }
  // Free: Nominatim geocode + Overpass query, 25km radius.
  // Only results with a phone number are imported.
  app.post("/admin/sales/import/osm", requireAdminAuth, async (req, res) => {
    try {
      const city = req.body.city ? String(req.body.city).trim() : "";
      const state = req.body.state ? String(req.body.state).trim().toUpperCase() : "";
      if (!city || !state || !STATE_TZ[state]) {
        return res.status(400).json({ error: "Validation failed", message: "city and a valid 2-letter state are required" });
      }

      const found = await fetchOsmPlumbers(city, state);

      // Keep only results with a usable phone, dedupe within batch
      const candidates = [];
      let noPhone = 0;
      const seenPhones = {};
      for (let i = 0; i < found.length; i++) {
        const f = found[i];
        const phone = normalizePhone(f.phone);
        if (!phone) { noPhone++; continue; }
        if (seenPhones[phone]) continue;
        seenPhones[phone] = true;
        candidates.push(newLeadDoc({
          businessName: f.businessName,
          phone:        phone,
          email:        f.email,
          website:      f.website,
          city:         f.city,
          state:        state,
          zip:          f.zip,
        }, "osm"));
      }

      // Dedupe against existing leads
      let inserted = 0;
      let duplicates = 0;
      if (candidates.length > 0) {
        const phones = candidates.map(function(c) { return c.phone; });
        const existing = await db.collection("leads")
          .find({ phone: { $in: phones } })
          .project({ phone: 1 })
          .toArray();
        const existingSet = {};
        existing.forEach(function(e) { existingSet[e.phone] = true; });
        const fresh = candidates.filter(function(c) { return !existingSet[c.phone]; });
        duplicates = candidates.length - fresh.length;
        if (fresh.length > 0) {
          const result = await db.collection("leads").insertMany(fresh, { ordered: false });
          inserted = result.insertedCount;
        }
      }

      const label = "OSM: " + city + ", " + state;
      await db.collection("lead_imports").insertOne({
        type: "osm",
        label: label,
        found: found.length,
        inserted: inserted,
        duplicates: duplicates,
        noPhone: noPhone,
        at: new Date(),
      }).catch(function(e) { console.error("Import log failed:", e.message); });

      console.log("OSM import (" + label + "): " + found.length + " found, " + inserted + " added, " + noPhone + " without phone");

      res.json({
        success: true,
        found: found.length,
        inserted: inserted,
        duplicates: duplicates,
        noPhone: noPhone,
        message: found.length + " plumbers found on OSM near " + city + " - " + inserted + " imported (" +
          duplicates + " already existed, " + noPhone + " had no phone number)",
      });
    } catch (err) {
      console.error("OSM import error:", err.message);
      res.status(500).json({ error: err.message, message: err.message });
    }
  });

  // ── LOG A CALL (one-tap) ──────────────────────────────────
  // POST /admin/sales/leads/:id/log
  // Body: { outcome*, note?, email?, name? }
  app.post("/admin/sales/leads/:id/log", requireAdminAuth, async (req, res) => {
    try {
      let leadId;
      try {
        leadId = new ObjectId(req.params.id);
      } catch (e) {
        return res.status(400).json({ error: "Invalid lead id" });
      }

      const outcome = req.body.outcome;
      const outcomeMeta = OUTCOMES[outcome];
      if (!outcomeMeta) {
        return res.status(400).json({
          error: "Validation failed",
          message: "outcome must be one of: " + Object.keys(OUTCOMES).join(", "),
        });
      }

      const lead = await db.collection("leads").findOne({ _id: leadId });
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const now = new Date();
      const note = req.body.note && String(req.body.note).trim() ? String(req.body.note).trim() : null;

      const setOps = {
        stage: outcomeMeta.stage,
        updatedAt: now,
        callbackAt: null, // a logged call consumes any scheduled callback
      };
      const pushOps = {
        callAttempts: { at: now, outcome: outcome, note: note },
      };
      if (note) {
        pushOps.notes = { at: now, text: note };
      }

      if (req.body.email && String(req.body.email).includes("@")) {
        setOps.email = String(req.body.email).trim();
      }
      if (req.body.name && String(req.body.name).trim()) {
        setOps.ownerName = String(req.body.name).trim();
      }

      let inviteSent = false;
      let inviteMessage = "";

      // ── Interested → fire the invitation email ──
      if (outcome === "interested") {
        const inviteEmail = setOps.email || lead.email;
        const inviteName  = setOps.ownerName || lead.ownerName || "";

        if (inviteEmail) {
          try {
            await email2.sendInvitationEmail(inviteEmail, inviteName);
            inviteSent = true;
            setOps.stage = "invited";
            inviteMessage = "Invitation sent to " + inviteEmail;
            if (!pushOps.notes) {
              pushOps.notes = { at: now, text: "Invitation email sent to " + inviteEmail };
            }
            try {
              await db.collection("invitations").insertOne({
                email:  inviteEmail,
                name:   inviteName || null,
                leadId: leadId,
                sentAt: now,
              });
            } catch (logErr) {
              console.error("Invitation log failed:", logErr.message);
            }
          } catch (emailErr) {
            console.error("Invitation email failed:", emailErr.message);
            inviteMessage = "Marked interested, but the invitation email FAILED: " + emailErr.message;
          }
        } else {
          inviteMessage = "Marked interested. No email on file - add their email via Edit, then tap Interested again to send the invite.";
        }
      }

      await db.collection("leads").updateOne(
        { _id: leadId },
        { $set: setOps, $push: pushOps }
      );

      console.log("Call logged: " + lead.businessName + " - " + outcome + (inviteSent ? " (invite sent)" : ""));

      res.json({
        success: true,
        message: inviteMessage || (outcomeMeta.label + " logged for " + lead.businessName),
        stage: setOps.stage,
        inviteSent: inviteSent,
      });
    } catch (err) {
      console.error("Log call error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── SIGN UP A LEAD ON THE CALL ────────────────────────────
  // POST /admin/sales/leads/:id/signup
  // Body: { email*, name? }
  // Creates the pending (unverified) account via the shared signup flow and
  // sends the verification email, so you can tell the prospect "check your
  // email and click the link" while they're still on the phone. The lead is
  // moved to SIGNED_UP; it auto-flips to TRIAL when they verify (matchLeadToSignup).
  app.post("/admin/sales/leads/:id/signup", requireAdminAuth, async (req, res) => {
    try {
      let leadId;
      try {
        leadId = new ObjectId(req.params.id);
      } catch (e) {
        return res.status(400).json({ error: "Invalid lead id" });
      }

      const lead = await db.collection("leads").findOne({ _id: leadId });
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const email = (req.body.email || lead.email || "").trim();
      if (!email || email.indexOf("@") === -1) {
        return res.status(400).json({ error: "Validation failed", message: "A valid email is required to sign them up." });
      }
      const ownerName = (req.body.name || lead.ownerName || "").trim() || "the team";
      const phone = normalizePhone(lead.phone);
      if (!phone) {
        return res.status(400).json({ error: "Validation failed", message: "This lead has no valid phone number on file." });
      }

      // Don't create a second account if this email is already a plumber
      const existing = await db.collection("plumbers").findOne({ email: email });
      if (existing) {
        return res.status(409).json({
          error: "Duplicate",
          message: email + " already has a ZeroMissCall account (status: " + (existing.verified ? "active" : "pending verification") + ").",
        });
      }

      // Create the pending signup + send verification email (shared with /onboard)
      const { plumber } = await createPendingSignup(
        { db: db, db_helpers: db_helpers, emailService: emailService },
        {
          businessName: lead.businessName,
          ownerName:    ownerName,
          email:        email,
          ownerPhone:   phone,
          state:        lead.state || "",
        }
      );

      // Move the lead to SIGNED_UP and save the email so verification auto-matches it
      const now = new Date();
      await db.collection("leads").updateOne(
        { _id: leadId },
        {
          $set: { stage: "signed_up", email: email, ownerName: ownerName, callbackAt: null, updatedAt: now },
          $push: { notes: { at: now, text: "Signed up on call - verification email sent to " + email } },
        }
      );

      console.log("Signed up on call: " + lead.businessName + " (" + email + ") - awaiting verification");

      res.json({
        success: true,
        message: "Account created for " + email + ". Tell them to open the email and click the confirmation link now - they'll be live in 2 minutes.",
        stage: "signed_up",
      });
    } catch (err) {
      console.error("Signup-on-call error:", err.message);
      res.status(500).json({ error: err.message, message: "Couldn't set them up: " + err.message });
    }
  });

  // ── ADD LEAD (manual) ─────────────────────────────────────
  app.post("/admin/sales/leads", requireAdminAuth, async (req, res) => {
    try {
      const check = validateLeadData(req.body);
      if (check.errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: check.errors });
      }

      const existing = await db.collection("leads").findOne({ phone: check.phone });
      if (existing) {
        return res.status(409).json({
          error: "Duplicate",
          message: check.phone + " is already in your leads (" + existing.businessName + ", stage: " + existing.stage + ")",
        });
      }

      const lead = newLeadDoc({
        businessName: req.body.businessName,
        phone:        check.phone,
        email:        req.body.email,
        ownerName:    req.body.ownerName,
        website:      req.body.website,
        city:         req.body.city,
        state:        req.body.state,
        zip:          req.body.zip,
        note:         req.body.note,
      }, "manual");

      const result = await db.collection("leads").insertOne(lead);
      console.log("Lead added: " + lead.businessName + " (" + lead.phone + ")");

      res.status(201).json({
        success: true,
        message: lead.businessName + " added",
        leadId: result.insertedId,
      });
    } catch (err) {
      console.error("Add lead error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── EDIT LEAD ─────────────────────────────────────────────
  // PUT /admin/sales/leads/:id
  // Body: any of { email, ownerName, website, city, state,
  //                doNotCall, note, callbackHours }
  app.put("/admin/sales/leads/:id", requireAdminAuth, async (req, res) => {
    try {
      let leadId;
      try {
        leadId = new ObjectId(req.params.id);
      } catch (e) {
        return res.status(400).json({ error: "Invalid lead id" });
      }

      const lead = await db.collection("leads").findOne({ _id: leadId });
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const updates = {};
      if (req.body.email !== undefined) {
        const email = String(req.body.email).trim();
        if (email && !email.includes("@")) {
          return res.status(400).json({ error: "Validation failed", message: "email must be a valid email address" });
        }
        updates.email = email || null;
      }
      if (req.body.ownerName !== undefined) updates.ownerName = String(req.body.ownerName).trim() || null;
      if (req.body.website   !== undefined) updates.website   = String(req.body.website).trim()   || null;
      if (req.body.city      !== undefined) updates.city      = String(req.body.city).trim()      || null;
      if (req.body.state     !== undefined) {
        const state = String(req.body.state).trim().toUpperCase();
        updates.state = state || null;
        updates.timezone = timezoneForState(state);
      }
      if (req.body.doNotCall !== undefined) updates.doNotCall = req.body.doNotCall === true;
      if (req.body.callbackHours !== undefined) {
        const hours = Number(req.body.callbackHours);
        if (isNaN(hours) || hours < 0) {
          return res.status(400).json({ error: "Validation failed", message: "callbackHours must be a number >= 0" });
        }
        updates.callbackAt = hours === 0 ? null : new Date(Date.now() + hours * 60 * 60 * 1000);
      }

      const ops = {};
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        ops.$set = updates;
      }
      if (req.body.note && String(req.body.note).trim()) {
        ops.$push = { notes: { at: new Date(), text: String(req.body.note).trim() } };
        if (!ops.$set) ops.$set = { updatedAt: new Date() };
      }

      if (!ops.$set && !ops.$push) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      await db.collection("leads").updateOne({ _id: leadId }, ops);
      console.log("Lead updated: " + lead.businessName);

      res.json({ success: true, message: lead.businessName + " updated" });
    } catch (err) {
      console.error("Edit lead error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerSalesRoutes };

// ─────────────────────────────────────────────────────────────
// INTEGRATION INSTRUCTIONS
// ─────────────────────────────────────────────────────────────
//
// No server.js changes needed if Steps 1-2 are already wired in:
//   const { registerSalesRoutes } = require("./sales");
//   registerSalesRoutes(app, db);   // inside the MongoDB .then()
//
// REQUIRES: email2.js in the same folder, Node 18+ (Railway
// default - needed for the built-in fetch used by the OSM import).
//
// TEST CHECKLIST (Step 3):
// 1. Open "Import Leads" on /admin/sales - two import options appear
// 2. OSM: try a big city first (e.g. Austin, TX) - small towns often
//    have zero mapped plumbers. Expect "X found - Y imported";
//    don't be surprised if Y is small, OSM phone coverage is patchy
// 3. CSV: make a quick test file with headers
//      Business Name,Phone,Owner,Email,City,State
//      Test Plumbing,2145550001,Mike,test@example.com,Dallas,TX
//    upload it, confirm "1 leads imported", lead appears as NEW
// 4. Re-import the same CSV - confirm "0 imported, 1 already existed"
// 5. Imported leads flow straight into the Ready to Call queue
//    during their local calling window
//
// FREE CSV SOURCES TO TRY FIRST:
// - Texas TDLR licensed plumber roster (downloadable file)
// - Florida DBPR licensee search/export
// - Outscraper / Scrap.io free-trial exports
//
// ─────────────────────────────────────────────────────────────
