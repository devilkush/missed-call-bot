// ─────────────────────────────────────────────────────────────
// SALES DASHBOARD — STEP 1
// ZeroMissCall outbound sales machine
//
// HOW TO USE:
// 1. Save this file as sales.js in the same folder as server.js
// 2. Follow integration instructions at the bottom
//
// WHAT THIS DOES (Step 1):
//   GET  /admin/sales                 → sales dashboard HTML page
//   POST /admin/sales/leads           → add a lead manually
//   PUT  /admin/sales/leads/:id       → edit a lead (email, name, notes, do-not-call)
//
// Coming in later steps:
//   Step 2 → call logging buttons, call queue, full stats
//   Step 3 → Google Places API import
//   Step 4 → auto-match signups to leads (invite → trial tracking)
//
// All routes protected by ADMIN_SECRET (same as admin.js)
// Data lives in the "leads" collection in your existing MongoDB
// ─────────────────────────────────────────────────────────────

const { ObjectId } = require("mongodb");

// ── FAVICON (optional) ───────────────────────
// Paste the same base64 favicon string you used in admin.js
// between the quotes below. Leave as-is and the page just
// won't have a favicon - everything else works fine.
var SALES_FAVICON = "PASTE_YOUR_BASE64_FAVICON_STRING_HERE";

// ─────────────────────────────────────────────
// STATE → TIMEZONE MAP (v1: primary timezone per state)
// Used to show each lead's local time so you call in their window
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

var STAGES = ["new", "no_answer", "spoke", "interested", "invited", "trial", "customer", "lost"];

var STAGE_META = {
  new:            { label: "NEW",            color: "#6b84a0" },
  no_answer:      { label: "NO ANSWER",      color: "#96aec6" },
  spoke:          { label: "SPOKE",          color: "#4a9eda" },
  interested:     { label: "INTERESTED",     color: "#E8791A" },
  invited:        { label: "INVITED",        color: "#d4a017" },
  trial:          { label: "TRIAL",          color: "#3ecf8e" },
  customer:       { label: "CUSTOMER",       color: "#3ecf8e" },
  lost:           { label: "LOST",           color: "#f05252" },
};

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

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

// ─────────────────────────────────────────────
// SALES DASHBOARD HTML
// ─────────────────────────────────────────────
function buildSalesDashboardHtml(leads) {
  var now = new Date();

  // ── Stat cards ──
  var total      = leads.length;
  var fresh      = leads.filter(function(l) { return l.stage === "new"; }).length;
  var interested = leads.filter(function(l) { return l.stage === "interested" || l.stage === "invited"; }).length;
  var won        = leads.filter(function(l) { return l.stage === "trial" || l.stage === "customer"; }).length;
  var dnc        = leads.filter(function(l) { return l.doNotCall; }).length;

  var statCards = [
    { n: total,      label: "Total Leads",         color: "#fff"     },
    { n: fresh,      label: "New (Not Called)",    color: "#6b84a0"  },
    { n: interested, label: "Interested / Invited", color: "#E8791A" },
    { n: won,        label: "Trial / Customer",    color: "#3ecf8e"  },
    { n: dnc,        label: "Do Not Call",         color: "#f05252"  },
  ].map(function(s) {
    return "<div style='background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;text-align:center;'>" +
      "<div style='font-family:Nunito,sans-serif;font-size:28px;font-weight:900;color:" + s.color + ";letter-spacing:-1px;'>" + s.n + "</div>" +
      "<div style='font-size:11px;color:#6b84a0;margin-top:4px;'>" + s.label + "</div>" +
      "</div>";
  }).join("");

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
    var added = l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-";
    var dncStyle = l.doNotCall ? "opacity:0.45;" : "";
    var websiteLink = l.website
      ? " <a href='" + escapeHtml(l.website) + "' target='_blank' style='color:#6b84a0;font-size:11px;text-decoration:none;'>site &#8599;</a>"
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
        (l.doNotCall ? "<div style='font-size:10px;color:#f05252;font-weight:800;margin-top:2px;'>DNC</div>" : "") +
      "</td>" +
      "<td class='hide-mobile' style='padding:12px 16px;font-size:12px;color:#96aec6;max-width:200px;'>" + escapeHtml(lastNote) + "</td>" +
      "<td class='hide-mobile' style='padding:12px 16px;font-size:12px;color:#6b84a0;text-align:center;'>" + added + "</td>" +
      "<td style='padding:12px 16px;text-align:center;white-space:nowrap;'>" +
        "<button onclick='editLead(\"" + l._id + "\")' style='background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#96aec6;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px;'>Edit</button>" +
        "<button onclick='toggleDnc(\"" + l._id + "\"," + (l.doNotCall ? "false" : "true") + ")' style='background:rgba(240,82,82,0.1);border:1px solid rgba(240,82,82,0.25);color:#f05252;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;'>" + (l.doNotCall ? "Un-DNC" : "DNC") + "</button>" +
      "</td>" +
      "</tr>";
  }).join("");

  // ── Add Lead form ──
  var stateOptions = Object.keys(STATE_TZ).sort().map(function(s) {
    return "<option value='" + s + "'>" + s + "</option>";
  }).join("");

  var inputStyle = "background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;font-family:DM Sans,sans-serif;outline:none;width:100%;";

  var addLeadForm =
    "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;margin:24px 0 12px;'>Add Lead</h2>" +
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
    "</div>";

  // ── Page JS ──
  var script =
    "<script>" +
    "function getSecret(){return new URLSearchParams(window.location.search).get('secret');}" +

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
    "<style>:root{--navy:#0b1928;--orange:#E8791A;--green:#3ecf8e;--border:rgba(255,255,255,0.07);}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#0b1928;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased;}.wrap{max-width:1100px;margin:0 auto;padding:0 20px 60px;}table{width:100%;border-collapse:collapse;}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b84a0;font-weight:600;padding:10px 16px;}tr:hover td{background:rgba(255,255,255,0.02);}input::placeholder{color:#5a7390;}select option{background:#0b1928;color:#fff;}@media(max-width:900px){.hide-mobile{display:none;}}</style>" +
    "</head><body>" +
    "<div style='position:sticky;top:0;z-index:100;background:rgba(11,25,40,0.95);backdrop-filter:blur(24px);border-bottom:1px solid var(--border);padding:0 20px;'>" +
    "<div style='max-width:1100px;margin:0 auto;height:60px;display:flex;align-items:center;justify-content:space-between;'>" +
    "<span style='font-family:Nunito,sans-serif;font-weight:900;font-size:18px;'><span style='color:#E8791A;'>zero</span><span style='color:#fff;'>miss</span><span style='color:#E8791A;'>call</span> <span style='color:#6b84a0;font-size:13px;font-weight:600;'>Sales</span></span>" +
    "<span style='font-size:12px;color:#6b84a0;'>" + dateStr + "</span>" +
    "</div></div>" +
    "<div class='wrap' style='padding-top:28px;'>" +
    "<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px;'>" + statCards + "</div>" +
    addLeadForm +
    "<div style='display:flex;align-items:center;justify-content:space-between;margin:24px 0 12px;'>" +
    "<h2 style='font-family:Nunito,sans-serif;font-size:16px;font-weight:900;'>All Leads (" + total + ")</h2>" +
    "<select id='stage-filter' onchange='filterStage()' style='background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;font-size:13px;color:#fff;font-family:DM Sans,sans-serif;outline:none;'>" + stageOptions + "</select>" +
    "</div>" +
    "<div style='background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:14px;overflow:hidden;'>" +
    "<table><thead><tr style='border-bottom:1px solid var(--border);'>" +
    "<th>Business</th><th>Phone / Email</th><th>Location / Local Time</th><th style='text-align:center;'>Stage</th><th class='hide-mobile'>Last Note</th><th class='hide-mobile' style='text-align:center;'>Added</th><th style='text-align:center;'>Actions</th>" +
    "</tr></thead><tbody>" +
    (rows || "<tr><td colspan='7' style='padding:40px;text-align:center;color:#6b84a0;'>No leads yet - add your first one above</td></tr>") +
    "</tbody></table></div>" +
    "<p style='font-size:12px;color:#6b84a0;margin-top:16px;text-align:center;'>Green local time = inside calling window (8am-6pm their time) &mdash; Red = outside window</p>" +
    "</div>" +
    script +
    "</body></html>";
}

// ─────────────────────────────────────────────
// REGISTER SALES ROUTES
// Call this from server.js after app is created
// ─────────────────────────────────────────────
function registerSalesRoutes(app, db) {

  // Indexes (safe to call on every boot)
  db.collection("leads").createIndex({ phone: 1 }).catch(function(e) {
    console.error("leads phone index error:", e.message);
  });
  db.collection("leads").createIndex({ stage: 1 }).catch(function(e) {
    console.error("leads stage index error:", e.message);
  });

  // ── SALES DASHBOARD PAGE ──────────────────────────────────
  // GET /admin/sales?secret=...
  app.get("/admin/sales", async (req, res) => {
    if (req.query.secret !== process.env.ADMIN_SECRET) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const leads = await db.collection("leads")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache");
      res.send(buildSalesDashboardHtml(leads));
    } catch (err) {
      res.status(500).send("Error: " + err.message);
    }
  });

  // ── ADD LEAD (manual) ─────────────────────────────────────
  // POST /admin/sales/leads
  // Body: { businessName*, phone*, ownerName, email, website,
  //         city, state, note }
  app.post("/admin/sales/leads", requireAdminAuth, async (req, res) => {
    try {
      const check = validateLeadData(req.body);
      if (check.errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: check.errors });
      }

      // Dedupe by normalized phone
      const existing = await db.collection("leads").findOne({ phone: check.phone });
      if (existing) {
        return res.status(409).json({
          error: "Duplicate",
          message: check.phone + " is already in your leads (" + existing.businessName + ", stage: " + existing.stage + ")",
        });
      }

      const now = new Date();
      const state = req.body.state ? String(req.body.state).trim().toUpperCase() : "";
      const lead = {
        businessName: String(req.body.businessName).trim(),
        phone:        check.phone,
        email:        req.body.email ? String(req.body.email).trim() : null,
        ownerName:    req.body.ownerName ? String(req.body.ownerName).trim() : null,
        website:      req.body.website ? String(req.body.website).trim() : null,
        city:         req.body.city ? String(req.body.city).trim() : null,
        state:        state || null,
        zip:          req.body.zip ? String(req.body.zip).trim() : null,
        timezone:     timezoneForState(state),
        source:       "manual",
        stage:        "new",
        doNotCall:    false,
        notes:        [],
        callbackAt:   null,
        callAttempts: [],
        createdAt:    now,
        updatedAt:    now,
      };

      if (req.body.note && String(req.body.note).trim()) {
        lead.notes.push({ at: now, text: String(req.body.note).trim() });
      }

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
  //                doNotCall, note }
  // (stage changes happen via call logging in Step 2)
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
// STEP 1 — Add require at top of server.js (next to the admin require):
//   const { registerSalesRoutes } = require("./sales");
//
// STEP 2 — Register routes after MongoDB connects.
// In your MongoDB .then() block, right after registerAdminRoutes, add:
//   registerSalesRoutes(app, db);
//
// STEP 3 — Open the dashboard:
//   https://missed-call-bot-production.up.railway.app/admin/sales?secret=zeromisscall123
//
// STEP 4 — Add a test lead with the form, check it appears in the
// table with the correct local time for its state, then test the
// Edit and DNC buttons.
//
// ─────────────────────────────────────────────────────────────
