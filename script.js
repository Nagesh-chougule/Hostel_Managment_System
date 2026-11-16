/* =========================================================
       DATA LAYER
       ========================================================= */
    const STORE_KEY = "coep_hostel_v4";
    const VIEWS = [
      { id: "dashboard", label: "Dashboard", ico: "◆" },
      { id: "infra", label: "Hostel Infrastructure", ico: "▧" },
      { id: "admissions", label: "Admissions & Merit List", ico: "✎" },
      { id: "rooms", label: "Room Allotment", ico: "▦" },
      { id: "students", label: "Student Records", ico: "☰" },
      { id: "fees", label: "Fees & Billing", ico: "₹" },
      { id: "mess", label: "Mess Card", ico: "◧" },
      { id: "visitors", label: "Visitors", ico: "◔" },
      { id: "complaints", label: "Complaints & Messages", ico: "✉" },
      { id: "reports", label: "Reports", ico: "▤" },
    ];
    const VIEW_META = {
      dashboard: ["Dashboard", "Occupancy, applications and merit-list status at a glance."],
      infra: ["Hostel Infrastructure", "Register hostels, floors and rooms before allotment begins."],
      admissions: ["Admissions & Merit List", "Register applications, then approve branch-wise, CGPA-based merit lists."],
      rooms: ["Room Allotment", "Floor-wise, room-wise bed allocation."],
      students: ["Student Records", "Search residents and review personal, academic and hostel history."],
      fees: ["Fees & Billing", "Course-wise fee structure, invoices, payments and dues."],
      mess: ["Mess Card", "Issue and manage each resident's mess card."],
      visitors: ["Visitors", "Log and search visitors against each resident."],
      complaints: ["Complaints & Messages", "Residents' maintenance requests and queries to the hostel office."],
      reports: ["Reports", "Generate official reports with the university's letterhead."],
    };
    const BRANCHES = [
      { code: "COMP", name: "Computer Engineering" },
      { code: "IT", name: "Information Technology" },
      { code: "ENTC", name: "Electronics & Telecommunication" },
      { code: "ELEC", name: "Electrical Engineering" },
      { code: "MECH", name: "Mechanical Engineering" },
      { code: "CIVIL", name: "Civil Engineering" },
      { code: "PROD", name: "Production Engineering" },
      { code: "METAL", name: "Metallurgy & Materials Engineering" },
      { code: "ARCH", name: "B. Planning" },
    ];
    const CATEGORIES = ["OPEN", "SC", "ST", "VJ", "NT1", "NT2", "NT3", "OBC", "SBC", "EWS", "SEBC", "GoI", "J&K", "NRI", "GULF", "FN", "PIO"];

    function uid(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }
    function todayISO() { return new Date().toISOString().slice(0, 10); }
    function fmtDate(d) { if (!d) return "—"; const dt = new Date(d + "T00:00:00"); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
    function branchName(code) { const b = BRANCHES.find(x => x.code === code); return b ? b.name : code; }
    function yearShortCode(yearLabel) { return (yearLabel || "00–00").replace(/[^\d–-]/g, "").split(/[–-]/).map(x => x.slice(-2)).join("-"); }
    function computeAdmNo(store, yearLabel, branchCode) {
      if (!store.regCounters) store.regCounters = {};
      const key = yearLabel + "|" + branchCode;
      if (!store.regCounters[key]) store.regCounters[key] = 100;
      store.regCounters[key]++;
      return `${yearShortCode(yearLabel)}-${String(branchCode || "gen").toLowerCase()}-${store.regCounters[key]}`;
    }
    function makeAdmNo(branchCode) { return computeAdmNo(DB, currentYear().label, branchCode); }
    function fileToDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    function fmtBytes(n) { if (!n) return "—"; const k = 1024; const units = ["B", "KB", "MB"]; let i = 0; while (n >= k && i < units.length - 1) { n /= k; i++; } return n.toFixed(1) + " " + units[i]; }
    function initials(name) { return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
    function avatarHtml(s, size) {
      size = size || 36;
      if (s.photo) return `<img src="${s.photo}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:1px solid var(--line);flex:0 0 auto">`;
      const hue = Math.abs([...(s.name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
      return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:hsl(${hue} 30% 88%);color:hsl(${hue} 40% 30%);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.38)}px;font-weight:700;flex:0 0 auto;font-family:'Lora',serif">${esc(initials(s.name))}</div>`;
    }
    function countBacklogs(text) {
      if (!text) return 0;
      return text.split(",").map(s => s.trim()).filter(Boolean).length;
    }
    function eligibility(s) {
      if (s.misconduct) return { ok: false, label: "Not eligible — misconduct", tier: null };
      const bl = s.backlogCount || 0;
      if (bl > 3) return { ok: false, label: "Not eligible — more than 3 backlogs", tier: null };
      if (bl === 0) return { ok: true, label: "Tier 1 — no backlog", tier: 1 };
      return { ok: true, label: "Tier 2 — backlog (second choice)", tier: 2 };
    }
    // Default reservation-category priority used only as a ranking level —
    // reserved categories ranked ahead of OPEN, in the order the university lists them on its own form.
    const CATEGORY_PRIORITY = ["SC", "ST", "VJ", "NT1", "NT2", "NT3", "OBC", "SBC", "EWS", "SEBC", "GoI", "J&K", "NRI", "GULF", "FN", "PIO", "OPEN"];
    function categoryRank(cat) { const i = CATEGORY_PRIORITY.indexOf(cat); return i === -1 ? CATEGORY_PRIORITY.length : i; }

    // Every level available in the ranking chain. "core" levels (tier, cgpa) are mandated by the
    // admission notice itself and always run first, in that order, and cannot be removed or reordered.
    // Every other level is optional and the admin controls both whether it's used and where it sits.
    const CRITERIA_DEFS = {
      tier: { label: "Tier — no-backlog before backlog (second choice)", core: true, cmp: (a, b) => { const ea = eligibility(a), eb = eligibility(b); return (ea.tier || 9) - (eb.tier || 9); } },
      cgpa: { label: "CGPA — higher first", core: true, cmp: (a, b) => b.cgpa - a.cgpa },
      disability: { label: "Physically disabled applicants ranked first", core: false, cmp: (a, b) => { const da = a.physicalDisability === "Yes", db = b.physicalDisability === "Yes"; return da === db ? 0 : (da ? -1 : 1); } },
      category: { label: "Reserved category before OPEN (SC→ST→VJ→NT→OBC→SBC→EWS→SEBC→…→OPEN)", core: false, cmp: (a, b) => categoryRank(a.category) - categoryRank(b.category) },
      income: { label: "Lower parental income first", core: false, cmp: (a, b) => (a.parentAnnualIncome || 0) - (b.parentAnnualIncome || 0) },
      applicationDate: { label: "Earlier application date first", core: false, cmp: (a, b) => (a.appliedDate || "9999").localeCompare(b.appliedDate || "9999") },
      misNo: { label: "Lower MIS No. first (earlier admission cohort)", core: false, cmp: (a, b) => (a.misNo || "").localeCompare(b.misNo || "") },
      name: { label: "Alphabetical by name (A–Z)", core: false, cmp: (a, b) => a.name.localeCompare(b.name) },
    };
    const CORE_LEVELS = ["tier", "cgpa"];
    const DEFAULT_EXTRA_LEVELS = ["disability", "category", "applicationDate", "income", "name"];

    function activeLevels() {
      const extra = (DB.meritCriteria.levels || DEFAULT_EXTRA_LEVELS).filter(k => CRITERIA_DEFS[k] && !CRITERIA_DEFS[k].core);
      return [...CORE_LEVELS, ...extra];
    }
    function rankApplicants(list) {
      const levels = activeLevels();
      return [...list].sort((a, b) => {
        for (const key of levels) {
          const r = CRITERIA_DEFS[key].cmp(a, b);
          if (r !== 0) return r;
        }
        return 0;
      });
    }

    /* =========================================================
       SUPABASE INTEGRATION & SYNC ENGINE
       ========================================================= */
    const SUPABASE_URL = "https://qcfbnsskqicmvyofoslt.supabase.co";
    const SUPABASE_KEY = "sb_publishable_UiCAF1TtGqDyKxnr-RsN4w_CC4ZY0O2";
    let supabaseClient = null;
    let supabaseSyncing = false;
    let supabaseConnected = false;
    let supabaseLastSync = null;
    let supabaseStatusMsg = "Not connected";

    const _uuidMap = new Map();
    function toUUID(str) {
      if (!str) return "00000000-0000-0000-0000-000000000000";
      str = String(str);
      if (_uuidMap.has(str)) return _uuidMap.get(str);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(str)) {
        const res = str.toLowerCase();
        _uuidMap.set(str, res);
        return res;
      }

      // Deterministic mapping to RFC4122 v4 UUID
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      let hex = "";
      for (let i = 0; i < 32; i++) {
        h = Math.imul(h ^ (i * 31), 0x01000193);
        hex += ((h >>> 0) % 16).toString(16);
      }
      const res = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      _uuidMap.set(str, res);
      return res;
    }

    function updateSupabaseUI() {
      const dot = document.getElementById("sbDot");
      const sbText = document.getElementById("sbText");
      const topDot = document.getElementById("topbarSbDot");
      const topLabel = document.getElementById("topbarSbLabel");

      if (supabaseConnected) {
        if (dot) dot.style.background = "var(--good, #3b7a4f)";
        if (sbText) sbText.innerHTML = `<span id="sbDot" style="width:8px;height:8px;border-radius:50%;background:var(--good, #3b7a4f);display:inline-block"></span> Supabase DB: Connected`;
        if (topDot) topDot.style.background = "var(--good, #3b7a4f)";
        if (topLabel) topLabel.textContent = "Supabase DB: Connected";
      } else {
        if (dot) dot.style.background = "var(--bad, #a13c3c)";
        if (sbText) sbText.innerHTML = `<span id="sbDot" style="width:8px;height:8px;border-radius:50%;background:var(--bad, #a13c3c);display:inline-block"></span> Supabase DB: Not Connected`;
        if (topDot) topDot.style.background = "var(--bad, #a13c3c)";
        if (topLabel) topLabel.textContent = "Supabase DB: Not Connected";
      }
    }

    async function initSupabase(autoFetch = false) {
      if (!window.supabase || !window.supabase.createClient) {
        console.warn("Supabase client library not loaded yet.");
        supabaseConnected = false;
        supabaseStatusMsg = "Supabase library missing";
        updateSupabaseUI();
        return false;
      }

      try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        // Ping with lightweight query
        const { data, error } = await supabaseClient.from("organization").select("id, name").limit(1);
        if (error) {
          console.warn("Supabase ping error:", error);
          supabaseConnected = false;
          supabaseStatusMsg = error.message || "Connection failed";
          updateSupabaseUI();
          return false;
        }
        supabaseConnected = true;
        supabaseStatusMsg = "Connected to Supabase";
        supabaseLastSync = new Date().toISOString();
        updateSupabaseUI();

        if (autoFetch) {
          await fetchFromSupabase(true);
        }
        return true;
      } catch (e) {
        console.error("Supabase init error:", e);
        supabaseConnected = false;
        supabaseStatusMsg = e.message || "Network error";
        updateSupabaseUI();
        return false;
      }
    }

    async function fetchFromSupabase(silent = false) {
      if (!supabaseClient || !supabaseConnected) {
        if (!silent) toast("Supabase is not connected. Configure database first.");
        return false;
      }

      supabaseSyncing = true;
      updateSupabaseUI();

      try {
        const [
          resOrg, resYears, resMerit, resBranches, resHostels, resRooms, resBeds,
          resStudents, resDocs, resExams, resPrevHostel, resFeeStruct,
          resInvoices, resPayments, resMess, resVisitors, resComplaints, resEvents, resAudit
        ] = await Promise.all([
          supabaseClient.from("organization").select("*").limit(1),
          supabaseClient.from("academic_years").select("*"),
          supabaseClient.from("merit_criteria").select("*").limit(1),
          supabaseClient.from("branches").select("*"),
          supabaseClient.from("hostels").select("*"),
          supabaseClient.from("rooms").select("*"),
          supabaseClient.from("beds").select("*"),
          supabaseClient.from("students").select("*"),
          supabaseClient.from("student_documents").select("*"),
          supabaseClient.from("exam_records").select("*"),
          supabaseClient.from("previous_hostel_records").select("*"),
          supabaseClient.from("fee_structure").select("*"),
          supabaseClient.from("fee_invoices").select("*"),
          supabaseClient.from("fee_payments").select("*"),
          supabaseClient.from("mess_cards").select("*"),
          supabaseClient.from("visitors").select("*"),
          supabaseClient.from("complaints").select("*"),
          supabaseClient.from("student_events").select("*"),
          supabaseClient.from("audit_log").select("*").order("log_date", { ascending: false }).limit(50)
        ]);

        if (resOrg.error || resStudents.error || resRooms.error) {
          const err = resOrg.error || resStudents.error || resRooms.error;
          console.error("Error fetching Supabase tables:", err);
          if (!silent) toast("Error loading from Supabase: " + (err.message || "Unknown error"));
          supabaseSyncing = false;
          updateSupabaseUI();
          return false;
        }

        if (resStudents.data && resStudents.data.length > 0 || resRooms.data && resRooms.data.length > 0) {
          if (resOrg.data && resOrg.data[0]) {
            const o = resOrg.data[0];
            DB.org = {
              name: o.name || DB.org.name,
              subtitle: o.subtitle || "",
              dept: o.department || "",
              address: o.address || "",
              phone: o.phone || "",
              fax: o.fax || "",
              email: o.email || ""
            };
          }

          if (resYears.data && resYears.data.length) {
            DB.academicYears = resYears.data.map(y => ({
              id: y.id,
              label: y.label,
              start: y.start_date,
              end: y.end_date,
              status: y.status,
              admissionStart: y.admission_start || "",
              admissionEnd: y.admission_end || ""
            }));
            const activeY = DB.academicYears.find(y => y.status === "Active") || DB.academicYears[0];
            if (activeY) DB.currentYearId = activeY.id;
          }

          if (resMerit.data && resMerit.data[0] && resMerit.data[0].levels) {
            DB.meritCriteria = { levels: resMerit.data[0].levels };
          }

          if (resHostels.data && resHostels.data.length) {
            DB.hostels = resHostels.data.map(h => ({
              id: h.id,
              name: h.name,
              code: h.code,
              address: h.address || "",
              type: h.type || "Boys",
              condition: h.condition || "Good",
              validated: !!h.validated
            }));
          }

          const allBeds = resBeds.data || [];
          // Fast lookup map for room beds
          const bedsByRoom = new Map();
          for (let i = 0; i < allBeds.length; i++) {
            const b = allBeds[i];
            let list = bedsByRoom.get(b.room_id);
            if (!list) { list = []; bedsByRoom.set(b.room_id, list); }
            list.push(b);
          }

          if (resRooms.data && resRooms.data.length) {
            DB.rooms = resRooms.data.map(r => {
              const roomBedsList = (bedsByRoom.get(r.id) || []).sort((a, b) => a.bed_no - b.bed_no);
              const roomBeds = roomBedsList.map(b => ({
                no: b.bed_no,
                status: b.status || "vacant",
                studentId: b.student_id || null,
                note: b.note || ""
              }));
              return {
                id: r.id,
                hostelId: r.hostel_id,
                floorLabel: r.floor_label,
                roomNumber: r.room_number,
                roomType: r.room_type || "Triple-sharing",
                capacitySanctioned: r.capacity_sanctioned || roomBeds.length || 3,
                capacityOperational: r.capacity_operational || r.capacity_sanctioned || 3,
                condition: r.condition || "Good",
                facilities: r.facilities || ["Attached/common toilet", "Ceiling fans", "Ventilation"],
                accessible: !!r.accessible,
                active: true,
                beds: roomBeds.length ? roomBeds : [
                  { no: 1, status: "vacant", studentId: null, note: "" },
                  { no: 2, status: "vacant", studentId: null, note: "" },
                  { no: 3, status: "vacant", studentId: null, note: "" }
                ],
                furniture: [
                  { id: uid("FUR"), name: "Cots", qty: r.capacity_sanctioned || 3, condition: "Good" },
                  { id: uid("FUR"), name: "Study tables", qty: r.capacity_sanctioned || 3, condition: "Good" },
                  { id: uid("FUR"), name: "Chairs", qty: r.capacity_sanctioned || 3, condition: "Good" },
                  { id: uid("FUR"), name: "Cupboards", qty: r.capacity_sanctioned || 3, condition: "Good" }
                ]
              };
            });
          }

          const allInvoices = resInvoices.data || [];
          const allPayments = resPayments.data || [];
          const allMess = resMess.data || [];
          const allExams = resExams.data || [];
          const allPrev = resPrevHostel.data || [];
          const allEvents = resEvents.data || [];
          const allDocs = resDocs.data || [];

          // Fast O(1) multi-map lookups for student relational sub-records
          const invoicesByStudent = new Map();
          for (let i = 0; i < allInvoices.length; i++) {
            const inv = allInvoices[i];
            let list = invoicesByStudent.get(inv.student_id);
            if (!list) { list = []; invoicesByStudent.set(inv.student_id, list); }
            list.push(inv);
          }
          const paymentsByStudent = new Map();
          for (let i = 0; i < allPayments.length; i++) {
            const pmt = allPayments[i];
            let list = paymentsByStudent.get(pmt.student_id);
            if (!list) { list = []; paymentsByStudent.set(pmt.student_id, list); }
            list.push(pmt);
          }
          const messByStudent = new Map();
          for (let i = 0; i < allMess.length; i++) {
            messByStudent.set(allMess[i].student_id, allMess[i]);
          }
          const examsByStudent = new Map();
          for (let i = 0; i < allExams.length; i++) {
            const ex = allExams[i];
            let list = examsByStudent.get(ex.student_id);
            if (!list) { list = []; examsByStudent.set(ex.student_id, list); }
            list.push(ex);
          }
          const prevByStudent = new Map();
          for (let i = 0; i < allPrev.length; i++) {
            const pr = allPrev[i];
            let list = prevByStudent.get(pr.student_id);
            if (!list) { list = []; prevByStudent.set(pr.student_id, list); }
            list.push(pr);
          }
          const eventsByStudent = new Map();
          for (let i = 0; i < allEvents.length; i++) {
            const ev = allEvents[i];
            let list = eventsByStudent.get(ev.student_id);
            if (!list) { list = []; eventsByStudent.set(ev.student_id, list); }
            list.push(ev);
          }
          const docsByStudent = new Map();
          for (let i = 0; i < allDocs.length; i++) {
            const doc = allDocs[i];
            let list = docsByStudent.get(doc.student_id);
            if (!list) { list = []; docsByStudent.set(doc.student_id, list); }
            list.push(doc);
          }

          if (resStudents.data && resStudents.data.length) {
            DB.students = resStudents.data.map(s => {
              const sInvoices = (invoicesByStudent.get(s.id) || []).map(i => ({ id: i.id, type: i.fee_type, invoiceDate: i.invoice_date, cost: parseFloat(i.cost || 0) }));
              const sPayments = (paymentsByStudent.get(s.id) || []).map(p => ({ id: p.id, type: p.payment_type || "Online", date: p.payment_date, amount: parseFloat(p.amount || 0) }));
              const sMess = messByStudent.get(s.id);
              const sExams = (examsByStudent.get(s.id) || []).map(e => ({ examName: e.exam_name, yearOfPassing: e.year_of_passing, cgpa: parseFloat(e.cgpa || 0) }));
              const sPrev = (prevByStudent.get(s.id) || []).map(p => ({ academicYear: p.academic_year, class: p.class, branch: p.branch, blockRoom: p.block_room, messName: p.mess_name, messDuesPending: p.mess_dues_pending ? "Yes" : "No" }));
              const sHistory = (eventsByStudent.get(s.id) || []).map(e => ({ date: e.event_date, event: e.event, note: e.note || "" }));
              const sDocs = (docsByStudent.get(s.id) || []).map(d => ({ name: d.name, type: d.doc_type, url: d.url, size: d.size_bytes }));

              return {
                id: s.id,
                admNo: s.reg_no || null,
                misNo: s.mis_no || "",
                name: s.name || "",
                gender: s.gender || "Male",
                yearOfStudy: s.year_of_study || "Second Year B.Tech.",
                branch: s.branch_code || "COMP",
                category: s.category || "OPEN",
                physicalDisability: s.physical_disability ? "Yes" : "No",
                sbc: s.sbc ? "Yes" : "No",
                correspondenceAddress: s.correspondence_address || "",
                personalEmail: s.personal_email || "",
                universityEmail: s.university_email || "",
                contactNo: s.contact_no || "",
                localGuardianName: s.local_guardian_name || "",
                localGuardianAddress: s.local_guardian_address || "",
                localGuardianContact: s.local_guardian_contact || "",
                parentName: s.parent_name || "",
                parentOccupation: s.parent_occupation || "",
                parentAnnualIncome: parseFloat(s.parent_annual_income || 0),
                clearedAllCourses: s.cleared_all_courses ? "Yes" : "No",
                backlogCourses: s.backlog_courses || "",
                cgpa: parseFloat(s.cgpa || 0),
                backlogCount: parseInt(s.backlog_count || 0),
                misconduct: !!s.misconduct,
                appliedDate: s.applied_date || todayISO(),
                admissionDate: s.admission_date || null,
                status: s.status || "Applied",
                roomId: s.current_room_id || null,
                bedNo: s.current_bed_no || null,
                photo: s.photo_url || null,
                documents: sDocs,
                feeInvoices: sInvoices,
                feePayments: sPayments,
                messCard: sMess ? { type: sMess.card_type || "Permanent", startDate: sMess.start_date || "", endDate: sMess.end_date || "", foodType: sMess.food_type || "Vegetarian", beverageType: sMess.beverage_type || "Tea & Coffee", status: sMess.status || "Active" } : null,
                history: sHistory.length ? sHistory : [{ date: s.applied_date || todayISO(), event: "Record synced from cloud", note: "Student record loaded from Supabase" }],
                previousHostelRecords: sPrev,
                examRecords: sExams
              };
            });
          }

          if (resFeeStruct.data && resFeeStruct.data.length) {
            DB.feeStructure = resFeeStruct.data.map(f => ({
              id: f.id,
              branch: f.branch_code,
              feeType: f.fee_type,
              cost: parseFloat(f.cost || 0)
            }));
          }

          if (resVisitors.data) {
            DB.visitors = resVisitors.data.map(v => ({
              id: v.id,
              studentId: v.student_id,
              name: v.name,
              type: v.visit_type || "Other",
              contactNo: v.contact_no || "",
              comments: v.comments || "",
              date: v.visit_date
            }));
          }

          if (resComplaints.data) {
            DB.complaints = resComplaints.data.map(c => ({
              id: c.id,
              studentId: c.student_id,
              subject: c.subject,
              message: c.message,
              date: c.log_date,
              status: c.status || "Open",
              response: c.response || ""
            }));
          }

          if (resAudit.data && resAudit.data.length) {
            DB.auditLog = resAudit.data.map(a => ({
              id: a.id,
              date: a.log_date,
              module: a.module,
              action: a.action,
              detail: a.detail || "",
              studentId: a.student_id || null
            }));
          }

          localStorage.setItem(STORE_KEY, JSON.stringify(DB));
          if (!silent) toast("Database loaded successfully from Supabase!");
          render(currentView);
        } else {
          if (!silent) toast("Connected to Supabase. Cloud database has no records yet.");
        }

        supabaseLastSync = new Date().toISOString();
        supabaseSyncing = false;
        updateSupabaseUI();
        return true;
      } catch (e) {
        console.error("fetchFromSupabase error:", e);
        if (!silent) toast("Supabase Sync Failed: " + e.message);
        supabaseSyncing = false;
        updateSupabaseUI();
        return false;
      }
    }

    async function pushAllToSupabase() {
      if (!supabaseClient || !supabaseConnected) {
        toast("Supabase is not connected. Configure database first.");
        return false;
      }

      supabaseSyncing = true;
      updateSupabaseUI();

      try {
        toast("Pushing local data to Supabase...");

        // === PHASE 1: Base Entities (Parallel) ===
        const phase1 = [];

        // 1. Organization
        phase1.push(supabaseClient.from("organization").upsert({
          id: toUUID("ORG-COEP"),
          name: DB.org.name,
          subtitle: DB.org.subtitle || "",
          department: DB.org.dept || "",
          address: DB.org.address || "",
          phone: DB.org.phone || "",
          fax: DB.org.fax || "",
          email: DB.org.email || ""
        }));

        // 2. Branches
        const branchRows = BRANCHES.map(b => ({ code: b.code, name: b.name }));
        phase1.push(supabaseClient.from("branches").upsert(branchRows, { onConflict: "code" }));

        // 3. Academic Years
        if (DB.academicYears && DB.academicYears.length) {
          const yearRows = DB.academicYears.map(y => ({
            id: toUUID(y.id),
            label: y.label,
            start_date: y.start,
            end_date: y.end,
            status: y.status,
            admission_start: y.admissionStart || null,
            admission_end: y.admissionEnd || null
          }));
          phase1.push(supabaseClient.from("academic_years").upsert(yearRows, { onConflict: "id" }));
        }

        // 4. Merit Criteria
        if (DB.meritCriteria && DB.meritCriteria.levels) {
          phase1.push(supabaseClient.from("merit_criteria").upsert({ id: 1, levels: DB.meritCriteria.levels }));
        }

        // 5. Hostels
        if (DB.hostels && DB.hostels.length) {
          const hostelRows = DB.hostels.map(h => ({
            id: toUUID(h.id),
            name: h.name,
            code: h.code || h.id.replace("HST-", "").slice(0, 1),
            address: h.address || "",
            type: h.type || "Boys",
            condition: h.condition || "Good",
            validated: !!h.validated
          }));
          phase1.push(supabaseClient.from("hostels").upsert(hostelRows, { onConflict: "id" }));
        }

        await Promise.all(phase1);

        // === PHASE 2: Infrastructure & Pricing (Parallel) ===
        const phase2 = [];

        // 6. Rooms
        if (DB.rooms && DB.rooms.length) {
          const roomRows = DB.rooms.map(r => ({
            id: toUUID(r.id),
            hostel_id: toUUID(r.hostelId),
            floor_label: r.floorLabel,
            room_number: r.roomNumber,
            room_type: r.roomType || "Triple-sharing",
            capacity_sanctioned: r.capacitySanctioned || 3,
            capacity_operational: r.capacityOperational || r.capacitySanctioned || 3,
            condition: r.condition || "Good",
            facilities: r.facilities || [],
            accessible: !!r.accessible
          }));
          phase2.push(supabaseClient.from("rooms").upsert(roomRows, { onConflict: "id" }));
        }

        // 8. Fee Structure
        if (DB.feeStructure && DB.feeStructure.length) {
          const feeRows = DB.feeStructure.map(f => ({
            id: toUUID(f.id),
            branch_code: f.branch,
            fee_type: f.feeType,
            cost: f.cost
          }));
          phase2.push(supabaseClient.from("fee_structure").upsert(feeRows, { onConflict: "id" }));
        }

        if (phase2.length) await Promise.all(phase2);

        // === PHASE 3: Beds & Student Primary Records (Parallel) ===
        const phase3 = [];

        // Beds
        const bedRows = [];
        if (DB.rooms && DB.rooms.length) {
          DB.rooms.forEach(r => {
            (r.beds || []).forEach(b => {
              bedRows.push({
                id: toUUID(`${r.id}-BED-${b.no}`),
                room_id: toUUID(r.id),
                bed_no: b.no,
                status: b.status || "vacant",
                student_id: b.studentId ? toUUID(b.studentId) : null,
                note: b.note || ""
              });
            });
          });
          if (bedRows.length) {
            phase3.push(supabaseClient.from("beds").upsert(bedRows, { onConflict: "id" }));
          }
        }

        // 7. Students Primary Records
        if (DB.students && DB.students.length) {
          const studentRows = DB.students.map(s => ({
            id: toUUID(s.id),
            reg_no: s.admNo || null,
            mis_no: s.misNo || null,
            name: s.name,
            gender: s.gender || "Male",
            year_of_study: s.yearOfStudy || "Second Year B.Tech.",
            branch_code: s.branch || "COMP",
            category: s.category || "OPEN",
            physical_disability: s.physicalDisability === "Yes",
            sbc: s.sbc === "Yes",
            correspondence_address: s.correspondenceAddress || "",
            personal_email: s.personalEmail || "",
            university_email: s.universityEmail || "",
            contact_no: s.contactNo || "",
            local_guardian_name: s.localGuardianName || "",
            local_guardian_address: s.localGuardianAddress || "",
            local_guardian_contact: s.localGuardianContact || "",
            parent_name: s.parentName || "",
            parent_occupation: s.parentOccupation || "",
            parent_annual_income: s.parentAnnualIncome || 0,
            cleared_all_courses: s.clearedAllCourses === "Yes",
            backlog_courses: s.backlogCourses || "",
            cgpa: s.cgpa || 0,
            backlog_count: s.backlogCount || 0,
            misconduct: !!s.misconduct,
            applied_date: s.appliedDate || todayISO(),
            admission_date: s.admissionDate || null,
            status: s.status || "Applied",
            academic_year_id: DB.currentYearId ? toUUID(DB.currentYearId) : null,
            current_room_id: s.roomId ? toUUID(s.roomId) : null,
            current_bed_no: s.bedNo || null,
            photo_url: s.photo || null
          }));
          phase3.push(supabaseClient.from("students").upsert(studentRows, { onConflict: "id" }));
        }

        if (phase3.length) await Promise.all(phase3);

        // === PHASE 4: Relational Details & Activity Logs (Parallel) ===
        const phase4 = [];

        if (DB.students && DB.students.length) {
          const invoiceRows = [];
          const paymentRows = [];
          const messRows = [];
          const eventRows = [];
          const examRows = [];
          const prevRows = [];

          DB.students.forEach(s => {
            const sUUID = toUUID(s.id);
            (s.feeInvoices || []).forEach(inv => {
              invoiceRows.push({ id: toUUID(inv.id || `${s.id}-${inv.type}`), student_id: sUUID, fee_type: inv.type, invoice_date: inv.invoiceDate || todayISO(), cost: inv.cost });
            });
            (s.feePayments || []).forEach(pmt => {
              paymentRows.push({ id: toUUID(pmt.id || `${s.id}-PMT-${pmt.date}`), student_id: sUUID, payment_type: pmt.type || "Online", payment_date: pmt.date || todayISO(), amount: pmt.amount });
            });
            if (s.messCard) {
              messRows.push({ id: toUUID(`${s.id}-MESS`), student_id: sUUID, card_type: s.messCard.type || "Permanent", status: s.messCard.status || "Active", start_date: s.messCard.startDate || null, end_date: s.messCard.endDate || null, food_type: s.messCard.foodType || "Vegetarian", beverage_type: s.messCard.beverageType || "Tea & Coffee" });
            }
            (s.history || []).forEach((ev, idx) => {
              eventRows.push({ id: toUUID(`${s.id}-EVT-${idx}`), student_id: sUUID, event_date: ev.date || todayISO(), event: ev.event, note: ev.note || "" });
            });
            (s.examRecords || []).forEach((ex, idx) => {
              examRows.push({ id: toUUID(`${s.id}-EXAM-${idx}`), student_id: sUUID, exam_name: ex.examName, year_of_passing: ex.yearOfPassing, cgpa: ex.cgpa });
            });
            (s.previousHostelRecords || []).forEach((pr, idx) => {
              prevRows.push({ id: toUUID(`${s.id}-PREV-${idx}`), student_id: sUUID, academic_year: pr.academicYear, class: pr.class, branch: pr.branch, block_room: pr.blockRoom, mess_name: pr.messName, mess_dues_pending: pr.messDuesPending === "Yes" });
            });
          });

          if (invoiceRows.length) phase4.push(supabaseClient.from("fee_invoices").upsert(invoiceRows, { onConflict: "id" }));
          if (paymentRows.length) phase4.push(supabaseClient.from("fee_payments").upsert(paymentRows, { onConflict: "id" }));
          if (messRows.length) phase4.push(supabaseClient.from("mess_cards").upsert(messRows, { onConflict: "id" }));
          if (eventRows.length) phase4.push(supabaseClient.from("student_events").upsert(eventRows, { onConflict: "id" }));
          if (examRows.length) phase4.push(supabaseClient.from("exam_records").upsert(examRows, { onConflict: "id" }));
          if (prevRows.length) phase4.push(supabaseClient.from("previous_hostel_records").upsert(prevRows, { onConflict: "id" }));
        }

        // 9. Visitors
        if (DB.visitors && DB.visitors.length) {
          const visitorRows = DB.visitors.map(v => ({
            id: toUUID(v.id),
            student_id: toUUID(v.studentId),
            name: v.name,
            visit_type: v.type || "Other",
            contact_no: v.contactNo || "",
            comments: v.comments || "",
            visit_date: v.date || todayISO()
          }));
          phase4.push(supabaseClient.from("visitors").upsert(visitorRows, { onConflict: "id" }));
        }

        // 10. Complaints
        if (DB.complaints && DB.complaints.length) {
          const complaintRows = DB.complaints.map(c => ({
            id: toUUID(c.id),
            student_id: toUUID(c.studentId),
            subject: c.subject,
            message: c.message,
            log_date: c.date || todayISO(),
            status: c.status || "Open",
            response: c.response || ""
          }));
          phase4.push(supabaseClient.from("complaints").upsert(complaintRows, { onConflict: "id" }));
        }

        // 11. Audit Log
        if (DB.auditLog && DB.auditLog.length) {
          const auditRows = DB.auditLog.slice(0, 50).map(a => ({
            id: toUUID(a.id),
            log_date: a.date || todayISO(),
            module: a.module,
            action: a.action,
            detail: a.detail || "",
            student_id: a.studentId ? toUUID(a.studentId) : null
          }));
          phase4.push(supabaseClient.from("audit_log").upsert(auditRows, { onConflict: "id" }));
        }

        if (phase4.length) await Promise.all(phase4);

        supabaseLastSync = new Date().toISOString();
        supabaseSyncing = false;
        updateSupabaseUI();
        toast("Full state successfully synced to Supabase!");
        return true;
      } catch (e) {
        console.error("pushAllToSupabase error:", e);
        toast("Sync to Supabase failed: " + e.message);
        supabaseSyncing = false;
        updateSupabaseUI();
        return false;
      }
    }

    let __syncTimeout = null;
    function syncToSupabaseDebounced() {
      if (!supabaseClient || !supabaseConnected) return;
      clearTimeout(__syncTimeout);
      __syncTimeout = setTimeout(() => {
        pushAllToSupabase();
      }, 1200);
    }

    function loadDB() {
      try { const raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); }
      catch (e) { console.error("load failed", e); }
      return seedDB();
    }
    function saveDB() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
      catch (e) { console.error("save failed", e); toast("Could not save — storage may be full."); }
      syncToSupabaseDebounced();
    }
    function addAudit(module, action, detail, studentId) {
      DB.auditLog.unshift({ id: uid("LOG"), date: todayISO(), module, action, detail, studentId: studentId || null });
    }
    function currentYear() { return DB.academicYears.find(y => y.id === DB.currentYearId); }
    function findBed(roomId, bedNo) { const room = DB.rooms.find(r => r.id === roomId); return room ? room.beds.find(b => b.no === bedNo) : null; }
    function studentName(id) { const s = DB.students.find(x => x.id === id); return s ? s.name : "—"; }
    function anyHostelValidated() { return DB.hostels.some(h => h.validated); }

    function seedDB() {
      const db = { org: {}, regCounters: {}, meritCriteria: { levels: [...DEFAULT_EXTRA_LEVELS] }, academicYears: [], currentYearId: null, hostels: [], rooms: [], students: [], feeStructure: [], visitors: [], complaints: [], auditLog: [] };

      db.org = {
        name: "COEP Technological University",
        subtitle: "(A Unitary Public University of Government of Maharashtra)",
        dept: "Hostel Department",
        address: "Shivajinagar, Pune 411 005.",
        phone: "020-25507660", fax: "020-25507299", email: "hostel@coeptech.ac.in",
      };

      db.academicYears = [
        { id: "AY-2425", label: "2024–25", start: "2024-06-01", end: "2025-05-31", status: "Closed" },
        { id: "AY-2526", label: "2025–26", start: "2025-06-01", end: "2026-05-31", status: "Active", admissionStart: "2025-06-26", admissionEnd: "2025-06-29" },
        { id: "AY-2627", label: "2026–27", start: "2026-06-01", end: "2027-05-31", status: "Upcoming" },
      ];
      db.currentYearId = "AY-2526";

      db.hostels = [
        { id: "HST-BOYS", name: "Boys' Hostel", code: "B", address: "COEP Technological University Campus, Shivajinagar, Pune 411005", type: "Boys", condition: "Good", validated: true },
        { id: "HST-GIRLS", name: "Girls' Hostel", code: "G", address: "COEP Technological University Campus, Shivajinagar, Pune 411005", type: "Girls", condition: "Good", validated: true },
      ];

      const roomDefs = [
        { hostelId: "HST-BOYS", floorLabel: "Ground Floor", roomNumber: "G-01", cap: 3 },
        { hostelId: "HST-BOYS", floorLabel: "Ground Floor", roomNumber: "G-02", cap: 3 },
        { hostelId: "HST-BOYS", floorLabel: "First Floor", roomNumber: "1-01", cap: 3 },
        { hostelId: "HST-BOYS", floorLabel: "First Floor", roomNumber: "1-02", cap: 3 },
        { hostelId: "HST-BOYS", floorLabel: "Second Floor", roomNumber: "2-01", cap: 3 },
        { hostelId: "HST-GIRLS", floorLabel: "Ground Floor", roomNumber: "G-01", cap: 3 },
        { hostelId: "HST-GIRLS", floorLabel: "Ground Floor", roomNumber: "G-02", cap: 3 },
        { hostelId: "HST-GIRLS", floorLabel: "First Floor", roomNumber: "1-01", cap: 3 },
      ];
      roomDefs.forEach(rd => {
        const id = `${rd.hostelId === "HST-BOYS" ? "B" : "G"}/${rd.roomNumber}`;
        const beds = []; for (let n = 1; n <= rd.cap; n++) beds.push({ no: n, status: "vacant", studentId: null, note: "" });
        db.rooms.push({
          id, hostelId: rd.hostelId, floorLabel: rd.floorLabel, roomNumber: rd.roomNumber, roomType: "Triple-sharing",
          capacitySanctioned: rd.cap, capacityOperational: rd.cap, condition: "Good",
          facilities: ["Attached/common toilet", "Ceiling fans", "Ventilation"], accessible: false, active: true,
          beds, furniture: [
            { id: uid("FUR"), name: "Cots", qty: rd.cap, condition: "Good" },
            { id: uid("FUR"), name: "Study tables", qty: rd.cap, condition: "Good" },
            { id: uid("FUR"), name: "Chairs", qty: rd.cap, condition: "Good" },
            { id: uid("FUR"), name: "Cupboards", qty: rd.cap, condition: "Good" },
          ]
        });
      });

      // ---- Active residents (continuing SY B.Tech students, admitted last year) ----
      const active = [
        { name: "Rutuja Kolhe", gender: "Female", branch: "COMP", category: "OPEN", cgpa: 9.12, backlogs: "", disability: "No", sbc: "No", mis: "MIS2024CO0142" },
        { name: "Aniket Shelar", gender: "Male", branch: "MECH", category: "OBC", cgpa: 8.44, backlogs: "", disability: "No", sbc: "No", mis: "MIS2024ME0087" },
        { name: "Sanika Deshpande", gender: "Female", branch: "ENTC", category: "OPEN", cgpa: 8.91, backlogs: "", disability: "No", sbc: "No", mis: "MIS2024EX0055" },
        { name: "Yash Kulkarni", gender: "Male", branch: "CIVIL", category: "EWS", cgpa: 7.65, backlogs: "Engineering Mechanics", disability: "No", sbc: "No", mis: "MIS2024CV0119" },
      ];
      active.forEach((a, i) => {
        const id = uid("STU");
        const backlogCount = countBacklogs(a.backlogs);
        const admissionDate = "2024-07-" + String(10 + i).padStart(2, "0");
        const admNo = computeAdmNo(db, "2024–25", a.branch);
        const student = {
          id, admNo, misNo: a.mis, name: a.name, gender: a.gender, yearOfStudy: "Third Year B.Tech.", branch: a.branch, category: a.category,
          physicalDisability: a.disability, sbc: a.sbc,
          correspondenceAddress: "Room details on file", personalEmail: a.name.split(" ")[0].toLowerCase() + "@gmail.com", contactNo: "98" + String(20000000 + i * 1111),
          universityEmail: a.mis.toLowerCase() + "@coeptech.ac.in",
          localGuardianName: "—", localGuardianAddress: "—", localGuardianContact: "—",
          parentName: "Parent/Guardian on file", parentOccupation: "Service", parentAnnualIncome: 180000 + i * 20000,
          previousHostelRecords: [{ academicYear: "2023–24", class: "Second Year", branch: branchName(a.branch), blockRoom: "—", messName: "Central Mess", messDuesPending: "No" }],
          clearedAllCourses: backlogCount === 0 ? "Yes" : "No", backlogCourses: a.backlogs, examRecords: [{ examName: "SY B.Tech Sem III", yearOfPassing: "2024", cgpa: a.cgpa }],
          cgpa: a.cgpa, backlogCount, misconduct: false,
          admissionDate, status: "Active", roomId: null, bedNo: null, photo: null, documents: [],
          feeInvoices: [], feePayments: [], messCard: null,
          history: [{ date: admissionDate, event: "Admission approved", note: `Admitted to hostel for ${branchName(a.branch)}, Third Year B.Tech.` }],
        };
        db.students.push(student);
      });
      const allocPlan = [["B/G-01", 1], ["B/G-01", 2], ["B/1-01", 1], ["G/G-01", 1]];
      allocPlan.forEach(([rid, bedNo], idx) => {
        const student = db.students[idx]; const room = db.rooms.find(r => r.id === rid); const bed = room.beds.find(b => b.no === bedNo);
        bed.status = "occupied"; bed.studentId = student.id; student.roomId = rid; student.bedNo = bedNo;
        student.history.push({ date: student.admissionDate, event: "Room allotted", note: `Allotted Room ${rid}, Bed ${bedNo}.` });
      });

      // ---- fee structure (course/branch-wise, per the notice's fee & mess table charges) ----
      BRANCHES.forEach(b => {
        db.feeStructure.push({ id: uid("FST"), branch: b.code, feeType: "Hostel Fee", cost: 28000 });
        db.feeStructure.push({ id: uid("FST"), branch: b.code, feeType: "Caution Deposit (refundable)", cost: 5000 });
        db.feeStructure.push({ id: uid("FST"), branch: b.code, feeType: "Mess Table Charges (per semester)", cost: 16000 });
      });
      // seed a couple of invoices/payments for admitted residents
      db.students.filter(s => s.status === "Active").forEach((s, i) => {
        const items = db.feeStructure.filter(f => f.branch === s.branch);
        items.forEach(f => s.feeInvoices.push({ id: uid("INV"), type: f.feeType, invoiceDate: s.admissionDate, cost: f.cost }));
        const total = items.reduce((a, f) => a + f.cost, 0);
        const paid = i % 2 === 0 ? total : Math.round(total * 0.6);
        s.feePayments.push({ id: uid("PMT"), type: "Online", date: s.admissionDate, amount: paid });
        s.messCard = { type: "Permanent", startDate: s.admissionDate, endDate: "", foodType: "Vegetarian", beverageType: "Tea & Coffee", status: "Active" };
      });

      // ---- pending applications for 2025–26 (Second Year B.Tech, matching the uploaded notice) ----
      const applicants = [
        { name: "Omkar Jagtap", gender: "Male", branch: "COMP", category: "OPEN", cgpa: 9.34, backlogs: "", disability: "No", sbc: "No", mis: "MIS2025CO0211" },
        { name: "Prachi Nikam", gender: "Female", branch: "COMP", category: "OBC", cgpa: 8.78, backlogs: "", disability: "No", sbc: "No", mis: "MIS2025CO0245" },
        { name: "Siddharth Rane", gender: "Male", branch: "COMP", category: "OPEN", cgpa: 8.20, backlogs: "Data Structures", disability: "No", sbc: "No", mis: "MIS2025CO0198" },
        { name: "Neha Bansode", gender: "Female", branch: "MECH", category: "SC", cgpa: 8.05, backlogs: "", disability: "No", sbc: "No", mis: "MIS2025ME0102" },
        { name: "Rohit Pardeshi", gender: "Male", branch: "MECH", category: "OPEN", cgpa: 7.40, backlogs: "Thermodynamics, Fluid Mechanics", disability: "No", sbc: "No", mis: "MIS2025ME0134" },
        { name: "Ishwari Kale", gender: "Female", branch: "ENTC", category: "OPEN", cgpa: 9.02, backlogs: "", disability: "No", sbc: "No", mis: "MIS2025EX0067" },
        { name: "Tanmay Bhagat", gender: "Male", branch: "ENTC", category: "NT2", cgpa: 6.85, backlogs: "Signals & Systems, Network Theory, Digital Electronics, EM Waves", disability: "No", sbc: "No", mis: "MIS2025EX0089" },
        { name: "Ankita Salunkhe", gender: "Female", branch: "CIVIL", category: "SEBC", cgpa: 7.88, backlogs: "", disability: "No", sbc: "Yes", mis: "MIS2025CV0141" },
        { name: "Devendra More", gender: "Male", branch: "ELEC", category: "J&K", cgpa: 8.15, backlogs: "", disability: "Yes", sbc: "No", mis: "MIS2025EE0056" },
      ];
      applicants.forEach(a => {
        const id = uid("STU");
        const backlogCount = countBacklogs(a.backlogs);
        const appliedDate = daysAgo(Math.floor(Math.random() * 3) + 1);
        db.students.push({
          id, admNo: null, misNo: a.mis, name: a.name, gender: a.gender, yearOfStudy: "Second Year B.Tech.", branch: a.branch, category: a.category,
          physicalDisability: a.disability, sbc: a.sbc,
          correspondenceAddress: "", personalEmail: "", contactNo: "",
          universityEmail: a.mis.toLowerCase() + "@coeptech.ac.in",
          localGuardianName: "", localGuardianAddress: "", localGuardianContact: "",
          parentName: "", parentOccupation: "", parentAnnualIncome: 0,
          previousHostelRecords: [{ academicYear: "2024–25", class: "First Year", branch: branchName(a.branch), blockRoom: "—", messName: "—", messDuesPending: "No" }],
          clearedAllCourses: backlogCount === 0 ? "Yes" : "No", backlogCourses: a.backlogs, examRecords: [{ examName: "FY B.Tech", yearOfPassing: "2025", cgpa: a.cgpa }],
          cgpa: a.cgpa, backlogCount, misconduct: false,
          admissionDate: null, appliedDate, status: "Applied", roomId: null, bedNo: null, photo: null, documents: [],
          feeInvoices: [], feePayments: [], messCard: null,
          history: [{ date: appliedDate, event: "Application received", note: `Applied for hostel admission, A.Y. 2025–26, ${branchName(a.branch)}. Awaiting branch-wise merit list review.` }],
        });
      });

      // ---- sample visitor log ----
      const activeForVisitors = db.students.filter(s => s.status === "Active");
      if (activeForVisitors.length) {
        db.visitors.push({ id: uid("VIS"), studentId: activeForVisitors[0].id, name: "Suresh " + activeForVisitors[0].name.split(" ").pop(), type: "Parent", contactNo: "9822099001", comments: "Visited to drop essentials.", date: daysAgo(4) });
        db.visitors.push({ id: uid("VIS"), studentId: activeForVisitors[1] ? activeForVisitors[1].id : activeForVisitors[0].id, name: "Friend from college", type: "Friend", contactNo: "9922088002", comments: "Study group visit.", date: daysAgo(1) });
      }

      // ---- sample complaints / messages to the hostel office ----
      if (activeForVisitors.length) {
        db.complaints.push({ id: uid("MSG"), studentId: activeForVisitors[0].id, subject: "Bulb fused", message: "Sir, this morning the tube light in my room got fused. Kindly please fix it.", date: daysAgo(3), status: "Open", response: "" });
        db.complaints.push({ id: uid("MSG"), studentId: activeForVisitors[Math.min(1, activeForVisitors.length - 1)].id, subject: "Fan not working", message: "Sir, from last Sunday itself the fan in my room is not working properly. Please fix it.", date: daysAgo(6), status: "Resolved", response: "Electrician visited and replaced the capacitor on " + daysAgo(4) + "." });
      }

      db.auditLog.push({ id: uid("LOG"), date: todayISO(), module: "System", action: "Initialized", detail: "Sample dataset loaded for demonstration.", studentId: null });
      return db;
    }

    let DB = loadDB();

    /* =========================================================
       NAV / SHELL
       ========================================================= */
    let currentView = "dashboard";
    function buildNav() {
      document.getElementById("navlist").innerHTML = VIEWS.map(v => `
    <button class="navbtn ${v.id === currentView ? 'active' : ''}" onclick="goto('${v.id}')">
      <span class="ico">${v.ico}</span><span>${v.label}</span>
    </button>`).join("");
    }
    function goto(view) {
      currentView = view;
      document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
      document.getElementById("view-" + view).classList.add("active");
      const [title, desc] = VIEW_META[view];
      document.getElementById("viewTitle").innerHTML = `${title} <span class="yr-pill" id="yrPill"></span>`;
      document.getElementById("viewDesc").textContent = desc;
      document.getElementById("yrPill").textContent = "A.Y. " + currentYear().label;
      buildNav(); render(view); window.scrollTo(0, 0);
    }
    function render(view) {
      if (view === "dashboard") renderDashboard();
      if (view === "infra") renderInfra();
      if (view === "admissions") renderAdmissions();
      if (view === "rooms") renderRooms();
      if (view === "students") renderStudents();
      if (view === "fees") renderFees();
      if (view === "mess") renderMess();
      if (view === "visitors") renderVisitors();
      if (view === "complaints") renderComplaints();
      if (view === "reports") renderReports();
    }
    function toast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg; t.classList.add("show");
      clearTimeout(window.__toastT); window.__toastT = setTimeout(() => t.classList.remove("show"), 2800);
    }
    function openModal(html) { document.getElementById("modalBody").innerHTML = html; document.getElementById("overlay").classList.add("open"); }
    function closeModal() { document.getElementById("overlay").classList.remove("open"); }
    document.getElementById("overlay").addEventListener("click", e => { if (e.target.id === "overlay") closeModal(); });

    function statusBadge(status) {
      const map = { Active: "good", Applied: "neutral", "Waiting List": "warn", Rejected: "bad", Alumni: "neutral" };
      return `<span class="badge ${map[status] || 'neutral'}">${status}</span>`;
    }

    /* =========================================================
       DASHBOARD
       ========================================================= */
    function renderDashboard() {
      const totalBeds = DB.rooms.reduce((a, r) => a + r.capacitySanctioned, 0);
      const occupied = DB.rooms.reduce((a, r) => a + r.beds.filter(b => b.status === "occupied").length, 0);
      const maint = DB.rooms.reduce((a, r) => a + r.beds.filter(b => b.status === "maintenance").length, 0);
      const vacant = totalBeds - occupied - maint;
      const active = DB.students.filter(s => s.status === "Active").length;
      const applied = DB.students.filter(s => s.status === "Applied").length;
      const ineligible = DB.students.filter(s => s.status === "Applied" && !eligibility(s).ok).length;
      const recent = DB.auditLog.slice(0, 8);
      const branchCounts = {};
      DB.students.filter(s => s.status === "Applied").forEach(s => { branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1; });

      document.getElementById("view-dashboard").innerHTML = `
    <div class="stat-row">
      <div class="stat"><div class="n">${DB.rooms.length}</div><div class="l">Rooms</div><div class="sub">Across ${DB.hostels.length} hostels</div></div>
      <div class="stat"><div class="n">${totalBeds}</div><div class="l">Sanctioned beds</div></div>
      <div class="stat"><div class="n">${occupied}</div><div class="l">Occupied</div><div class="sub">${totalBeds ? Math.round(occupied / totalBeds * 100) : 0}% occupancy</div></div>
      <div class="stat"><div class="n">${vacant}</div><div class="l">Available for allotment</div></div>
      <div class="stat"><div class="n">${applied}</div><div class="l">Pending applications</div><div class="sub">${ineligible} not eligible</div></div>
      <div class="stat"><div class="n">${active}</div><div class="l">Active residents</div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-title"><h2>Pending applications by branch</h2></div>
        ${BRANCHES.filter(b => branchCounts[b.code]).map(b => {
        const n = branchCounts[b.code]; const pct = applied ? Math.round(n / applied * 100) : 0;
        return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>${esc(b.name)}</span><span>${n} applicant${n === 1 ? '' : 's'}</span></div>
            <div style="height:7px;background:var(--cream-dim);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--maroon)"></div></div>
          </div>`;
      }).join("") || `<div class="empty">No pending applications.</div>`}
      </div>
      <div class="panel">
        <div class="panel-title"><h2>Recent activity</h2></div>
        <div class="timeline">
          ${recent.map(l => `<div class="tl-item"><div class="tl-date">${fmtDate(l.date)} · ${esc(l.module)}</div><div class="tl-text">${esc(l.action)}${l.studentId ? ` — ${esc(studentName(l.studentId))}` : ''}${l.detail ? `<br><span style="color:var(--ink-soft)">${esc(l.detail)}</span>` : ''}</div></div>`).join("") || `<div class="empty">No activity recorded yet.</div>`}
        </div>
      </div>
    </div>
  `;
    }

    /* =========================================================
       INFRASTRUCTURE
       ========================================================= */
    let infraSelectedHostel = null;
    function renderInfra() {
      if (!infraSelectedHostel && DB.hostels.length) infraSelectedHostel = DB.hostels[0].id;
      const hostel = DB.hostels.find(h => h.id === infraSelectedHostel);
      const rooms = hostel ? DB.rooms.filter(r => r.hostelId === hostel.id) : [];
      const floors = [...new Set(rooms.map(r => r.floorLabel))];
      document.getElementById("view-infra").innerHTML = `
    <div class="panel">
      <div class="panel-title"><h2>Hostel Department</h2><span class="hint">Appears as the letterhead on every generated report.</span></div>
      <form onsubmit="submitOrg(event)">
        <div class="field-row">
          <div class="field"><label>University *</label><input required name="name" value="${esc(DB.org.name)}"></div>
          <div class="field"><label>Sub-title</label><input name="subtitle" value="${esc(DB.org.subtitle)}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Department</label><input name="dept" value="${esc(DB.org.dept)}"></div>
          <div class="field"><label>Address</label><input name="address" value="${esc(DB.org.address)}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Phone</label><input name="phone" value="${esc(DB.org.phone)}"></div>
          <div class="field"><label>Fax</label><input name="fax" value="${esc(DB.org.fax)}"></div>
          <div class="field"><label>Email</label><input name="email" value="${esc(DB.org.email)}"></div>
        </div>
        <button class="btn ghost sm" type="submit">Save department details</button>
      </form>
    </div>

    <div class="panel">
      <div class="panel-title"><h2>Hostel master</h2></div>
      <table>
        <thead><tr><th>Hostel</th><th>Type</th><th>Rooms</th><th>Sanctioned beds</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${DB.hostels.map(h => {
        const hRooms = DB.rooms.filter(r => r.hostelId === h.id);
        const beds = hRooms.reduce((a, r) => a + r.capacitySanctioned, 0);
        return `<tr class="rowlink" onclick="infraSelectedHostel='${h.id}'; renderInfra()">
              <td><strong>${esc(h.name)}</strong><div style="font-size:11px;color:var(--ink-soft)">${esc(h.address)}</div></td>
              <td>${esc(h.type)}</td><td>${hRooms.length}</td><td>${beds}</td>
              <td>${h.validated ? `<span class="badge good">Validated</span>` : `<span class="badge warn">Pending validation</span>`}</td>
              <td style="text-align:right">
                ${h.validated ? `<button class="btn ghost sm" onclick="event.stopPropagation(); toggleValidate('${h.id}')">Unvalidate</button>`
            : `<button class="btn maroon sm" onclick="event.stopPropagation(); toggleValidate('${h.id}')" ${hRooms.length ? "" : "disabled"}>Validate</button>`}
              </td>
            </tr>`;
      }).join("")}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <div class="panel-title"><h2>Register a new hostel</h2></div>
      <form onsubmit="submitHostel(event)">
        <div class="field-row">
          <div class="field"><label>Hostel name *</label><input required name="name" placeholder="e.g. New Boys' Hostel"></div>
          <div class="field"><label>Type *</label><select required name="type"><option>Boys</option><option>Girls</option><option>Co-ed</option></select></div>
        </div>
        <div class="field"><label>Address *</label><input required name="address" placeholder="Building, campus, city, PIN"></div>
        <button class="btn maroon" type="submit">Add hostel</button>
      </form>
    </div>

    ${hostel ? `
    <div class="panel">
      <div class="panel-title"><h2>Room master — ${esc(hostel.name)}</h2><span class="hint">${rooms.length} rooms · ${rooms.reduce((a, r) => a + r.capacitySanctioned, 0)} sanctioned beds</span></div>
      ${floors.length ? floors.map(fl => `
        <div class="block-title">${esc(fl)}</div>
        <table>
          <thead><tr><th>Room</th><th>Type</th><th>Capacity</th><th>Occupied</th><th>Vacant</th><th>Condition</th></tr></thead>
          <tbody>
            ${rooms.filter(r => r.floorLabel === fl).map(r => {
        const occ = r.beds.filter(b => b.status === "occupied").length;
        const vac = r.beds.filter(b => b.status === "vacant").length;
        return `<tr><td class="mono">${r.roomNumber}</td><td>${esc(r.roomType)}</td><td>${r.capacitySanctioned}</td><td>${occ}</td><td>${vac}</td><td>${esc(r.condition)}</td></tr>`;
      }).join("")}
          </tbody>
        </table>`).join("") : `<div class="empty">No rooms registered for this hostel yet.</div>`}
      <div class="panel-title" style="margin-top:20px"><h2>Add a room</h2></div>
      <form onsubmit="submitRoom(event,'${hostel.id}')">
        <div class="field-row">
          <div class="field"><label>Floor *</label><input required name="floorLabel" placeholder="e.g. Second Floor" list="floorList">
            <datalist id="floorList">${floors.map(f => `<option value="${esc(f)}">`).join("")}</datalist></div>
          <div class="field"><label>Room number *</label><input required name="roomNumber" placeholder="e.g. 2-01"></div>
          <div class="field"><label>Sanctioned beds *</label><input required type="number" min="1" name="capacity" value="3"></div>
        </div>
        <button class="btn maroon" type="submit">Add room</button>
      </form>
    </div>` : ""}
  `;
    }
    function submitOrg(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      DB.org = { name: fd.get("name"), subtitle: fd.get("subtitle") || "", dept: fd.get("dept") || "", address: fd.get("address") || "", phone: fd.get("phone") || "", fax: fd.get("fax") || "", email: fd.get("email") || "" };
      addAudit("Infrastructure", "Department details updated", DB.org.name);
      saveDB(); toast("Department details saved.");
    }
    function submitHostel(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const id = uid("HST"); const code = String.fromCharCode(65 + DB.hostels.length);
      DB.hostels.push({ id, name: fd.get("name"), code, address: fd.get("address"), type: fd.get("type"), condition: "Good", validated: false });
      addAudit("Infrastructure", "Hostel registered", fd.get("name"));
      saveDB(); toast("Hostel registered. Add rooms, then validate."); infraSelectedHostel = id; renderInfra();
    }
    function submitRoom(e, hostelId) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const hostel = DB.hostels.find(h => h.id === hostelId);
      const cap = Number(fd.get("capacity"));
      const id = `${hostel.code}/${fd.get("roomNumber")}`;
      if (DB.rooms.some(r => r.id === id)) { toast("A room with this number already exists in this hostel."); return; }
      const beds = []; for (let n = 1; n <= cap; n++) beds.push({ no: n, status: "vacant", studentId: null, note: "" });
      DB.rooms.push({ id, hostelId, floorLabel: fd.get("floorLabel"), roomNumber: fd.get("roomNumber"), roomType: "Shared", capacitySanctioned: cap, capacityOperational: cap, condition: "Good", facilities: [], accessible: false, active: true, beds, furniture: [] });
      addAudit("Infrastructure", "Room added", `${id} (${cap} beds) added to ${hostel.name}.`);
      saveDB(); toast(`Room ${id} added.`); renderInfra();
    }
    function toggleValidate(hostelId) {
      const h = DB.hostels.find(x => x.id === hostelId);
      const rooms = DB.rooms.filter(r => r.hostelId === hostelId);
      if (!h.validated && rooms.length === 0) { toast("Add at least one room before validating."); return; }
      h.validated = !h.validated;
      addAudit("Infrastructure", h.validated ? "Hostel validated" : "Hostel validation removed", h.name);
      saveDB(); toast(h.validated ? `${h.name} validated.` : `${h.name} validation removed.`); renderInfra();
    }

    /* =========================================================
       ADMISSIONS & MERIT LIST
       ========================================================= */
    let admissionsTab = "apply";
    function renderAdmissions() {
      const applied = DB.students.filter(s => s.status === "Applied").length;
      document.getElementById("view-admissions").innerHTML = `
    <div class="pill-toggle" style="margin-bottom:16px">
      <button class="${admissionsTab === 'apply' ? 'on' : ''}" onclick="admissionsTab='apply'; renderAdmissions()">New application</button>
      <button class="${admissionsTab === 'merit' ? 'on' : ''}" onclick="admissionsTab='merit'; renderAdmissions()">Merit list ${applied ? `(${applied} pending)` : ''}</button>
      <button class="${admissionsTab === 'roster' ? 'on' : ''}" onclick="admissionsTab='roster'; renderAdmissions()">Admitted / waiting list</button>
    </div>
    <div id="admissionsTabBody"></div>
  `;
      const body = document.getElementById("admissionsTabBody");
      if (admissionsTab === "apply") body.innerHTML = admissionApplyForm();
      else if (admissionsTab === "merit") body.innerHTML = admissionMeritLists();
      else body.innerHTML = admissionRoster();
    }
    function admissionApplyForm() {
      const yr = currentYear();
      return `
    <div class="panel">
      <div class="panel-title"><h2>Application for Hostel Admission — A.Y. ${esc(yr.label)}</h2>
        <span class="hint">Fields follow the COEP Technological University hostel admission form.</span></div>
      <div class="banner" style="border-color:var(--navy-700);background:color-mix(in srgb, var(--navy-700) 8%, transparent);color:var(--navy-800)">
        <span>Admission is branch-wise and on merit (CGPA) basis. Students with no backlog get first priority; those with backlog courses (up to three) get second choice. More than three backlogs are not considered.</span>
      </div>
      <form id="admissionForm" onsubmit="submitAdmission(event)">
        <fieldset>
          <legend>Student &amp; academic details</legend>
          <div class="field-row">
            <div class="field"><label>Year of study *</label><select required name="yearOfStudy"><option>Second Year B.Tech.</option><option>Third Year B.Tech.</option><option>Final Year B.Tech.</option><option>B. Planning</option></select></div>
            <div class="field"><label>Name of student *</label><input required name="name" placeholder="In block letters"></div>
            <div class="field"><label>Gender *</label><select required name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
          </div>
          <div class="field-row">
            <div class="field"><label>MIS No. *</label><input required name="misNo" placeholder="University MIS number"></div>
            <div class="field"><label>Branch *</label><select required name="branch"><option value="">Select</option>${BRANCHES.map(b => `<option value="${b.code}">${b.name}</option>`).join("")}</select></div>
            <div class="field"><label>Category *</label><select required name="category">${CATEGORIES.map(c => `<option>${c}</option>`).join("")}</select></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Physically disabled?</label><select name="physicalDisability"><option>No</option><option>Yes</option></select></div>
            <div class="field"><label>SBC?</label><select name="sbc"><option>No</option><option>Yes</option></select></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Contact details</legend>
          <div class="field"><label>Address for correspondence with contact no. *</label><textarea required name="correspondenceAddress" rows="2"></textarea></div>
          <div class="field-row">
            <div class="field"><label>Personal e-mail ID *</label><input required type="email" name="personalEmail"></div>
            <div class="field"><label>University e-mail ID *</label><input required type="email" name="universityEmail"></div>
            <div class="field"><label>Contact phone no. *</label><input required name="contactNo" placeholder="10-digit mobile"></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Local guardian &amp; family</legend>
          <div class="field-row">
            <div class="field"><label>Name of local guardian</label><input name="localGuardianName"></div>
            <div class="field"><label>Local guardian contact no.</label><input name="localGuardianContact"></div>
          </div>
          <div class="field"><label>Address of local guardian</label><input name="localGuardianAddress"></div>
          <div class="field-row">
            <div class="field"><label>Name of Father / Mother / Guardian *</label><input required name="parentName"></div>
            <div class="field"><label>Occupation of parent</label><input name="parentOccupation"></div>
            <div class="field"><label>Annual income of parent (₹)</label><input type="number" min="0" name="parentAnnualIncome"></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Previous hostel record at COEP (if any)</legend>
          <div class="field-row">
            <div class="field"><label>Academic year</label><input name="prevYear" placeholder="e.g. 2024–2025"></div>
            <div class="field"><label>Class</label><input name="prevClass" placeholder="e.g. First Year"></div>
            <div class="field"><label>Block &amp; Room No.</label><input name="prevRoom"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Mess name</label><input name="prevMess"></div>
            <div class="field"><label>Mess dues pending?</label><select name="prevMessDues"><option>No</option><option>Yes</option></select></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Academic record</legend>
          <div class="field-row">
            <div class="field"><label>Have you cleared all courses?</label><select name="clearedAllCourses" onchange="document.getElementById('backlogWrap').style.display=this.value==='No'?'block':'none'"><option>Yes</option><option>No</option></select></div>
            <div class="field"><label>Latest CGPA *</label><input required type="number" min="0" max="10" step="0.01" name="cgpa" placeholder="e.g. 8.50"></div>
          </div>
          <div class="field" id="backlogWrap" style="display:none">
            <label>Backlog courses (comma-separated)</label>
            <input name="backlogCourses" placeholder="e.g. Data Structures, Thermodynamics">
          </div>
        </fieldset>

        <fieldset>
          <legend>Photograph &amp; documents</legend>
          <div class="field-row">
            <div class="field"><label>I-card size photograph</label><input type="file" name="photo" accept="image/*"></div>
            <div class="field"><label>Supporting documents</label><input type="file" name="documents" accept="image/*,.pdf" multiple></div>
          </div>
          <div class="hint" style="display:block;margin:-6px 0 4px">Signed application form, Hostel No Dues Certificate, Mess No Dues Certificate, etc. Keep each file under ~3 MB.</div>
        </fieldset>

        <fieldset>
          <legend>Undertaking</legend>
          <div class="field checkrow"><input required type="checkbox" id="undertakingChk"><label for="undertakingChk" style="margin:0">I declare that the statements made in this application are true and complete, and I agree to abide by the hostel rules and regulations, including the anti-ragging undertaking, mandatory mess membership, and production of original documents at the time of room allotment.</label></div>
        </fieldset>

        <div class="form-actions" style="border-top:none;padding-top:0;justify-content:flex-start">
          <button type="submit" class="btn maroon">Submit application</button>
          <button type="reset" class="btn ghost">Clear form</button>
        </div>
      </form>
    </div>`;
    }
    function admissionMeritLists() {
      const levels = activeLevels();
      const extraLevels = levels.filter(k => !CRITERIA_DEFS[k].core);
      return `
    <div class="panel">
      <div class="panel-title"><h2>Merit list ranking criteria</h2><span class="hint">Applied top to bottom, in order, to every branch's list. The first level that isn't a tie decides the rank.</span></div>
      <ol style="margin:0 0 14px;padding-left:20px;font-size:13px;line-height:1.9">
        <li><strong>Eligibility filter</strong> — applicants with more than three backlogs, or a misconduct record, are excluded from allotment entirely (shown separately below).</li>
        ${levels.map((key, i) => `<li><strong>${esc(CRITERIA_DEFS[key].label)}</strong>${CRITERIA_DEFS[key].core ? ' <span class="badge neutral">fixed — from the admission notice</span>' : ''}</li>`).join("")}
      </ol>
      <form onsubmit="saveMeritCriteria(event)" style="border-top:1px solid var(--line);padding-top:12px">
        <div class="hint" style="display:block;margin-bottom:10px">Tier and CGPA always apply first, exactly as the notice requires. Add, drop or reorder the levels below to control how any remaining tie is broken — give each active level a priority number (1 = applied first).</div>
        <table style="margin-bottom:12px">
          <thead><tr><th style="width:70px">Use</th><th style="width:90px">Priority</th><th>Level</th></tr></thead>
          <tbody>
            ${Object.entries(CRITERIA_DEFS).filter(([k, v]) => !v.core).map(([k, v]) => {
        const idx = extraLevels.indexOf(k);
        const on = idx !== -1;
        return `<tr>
                <td><input type="checkbox" name="use_${k}" ${on ? 'checked' : ''}></td>
                <td><input type="number" min="1" max="20" name="ord_${k}" value="${on ? idx + 1 : extraLevels.length + 1}" style="width:100%;padding:5px 6px;border:1px solid var(--line);border-radius:3px;background:var(--cream)"></td>
                <td style="font-size:12.5px">${esc(v.label)}</td>
              </tr>`;
      }).join("")}
          </tbody>
        </table>
        <button class="btn ghost sm" type="submit">Save ranking criteria</button>
      </form>
    </div>

    <div class="panel">
      <div class="panel-title"><h2>Branch-wise merit list — pending applications</h2>
        <span class="hint">Ranked using the criteria above.</span></div>
      ${BRANCHES.map(b => {
        const list = DB.students.filter(s => s.status === "Applied" && s.branch === b.code);
        if (!list.length) return "";
        const elig = rankApplicants(list.filter(s => eligibility(s).ok));
        const inelig = list.filter(s => !eligibility(s).ok);
        return `
        <div class="block-title">${esc(b.name)} — ${list.length} applicant${list.length === 1 ? '' : 's'}</div>
        <table>
          <thead><tr><th></th><th>Rank</th><th>Name</th><th>MIS No.</th><th>Category</th><th>CGPA</th><th>Tier</th><th></th></tr></thead>
          <tbody>
            ${elig.map((s, i) => {
          const el = eligibility(s);
          return `<tr>
                <td>${avatarHtml(s, 26)}</td><td class="mono">${i + 1}</td><td>${esc(s.name)}</td><td class="mono">${esc(s.misNo)}</td><td>${esc(s.category)}</td>
                <td class="mono">${s.cgpa.toFixed(2)}</td><td><span class="badge tier${el.tier}">Tier ${el.tier}</span></td>
                <td style="text-align:right">
                  <button class="btn maroon sm" onclick="approveApplicant('${s.id}')">Approve admission</button>
                  <button class="btn ghost sm" onclick="waitlistApplicant('${s.id}')">Waiting list</button>
                  <button class="btn danger sm" onclick="rejectApplicant('${s.id}')">Reject</button>
                </td>
              </tr>`;
        }).join("")}
          </tbody>
        </table>
        ${inelig.length ? `
        <div style="font-size:11.5px;color:var(--bad);font-weight:600;margin:10px 0 4px">Not eligible for allotment (${inelig.length})</div>
        <table>
          <thead><tr><th>Name</th><th>MIS No.</th><th>CGPA</th><th>Backlogs</th><th>Reason</th></tr></thead>
          <tbody>${inelig.map(s => `<tr><td>${esc(s.name)}</td><td class="mono">${esc(s.misNo)}</td><td>${s.cgpa.toFixed(2)}</td><td>${s.backlogCount}</td><td>${esc(eligibility(s).label)}</td></tr>`).join("")}</tbody>
        </table>` : ""}
        `;
      }).join("") || `<div class="empty">No pending applications.</div>`}
    </div>`;
    }
    function admissionRoster() {
      const waiting = DB.students.filter(s => s.status === "Waiting List");
      const recentAdmits = [...DB.students].filter(s => s.status === "Active").sort((a, b) => (b.admissionDate || "").localeCompare(a.admissionDate || "")).slice(0, 10);
      return `
    <div class="two-col">
      <div class="panel">
        <div class="panel-title"><h2>Admitted (merit-approved)</h2></div>
        <table>
          <thead><tr><th></th><th>Adm. No.</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Room</th></tr></thead>
          <tbody>
            ${recentAdmits.map(s => `
              <tr class="rowlink" onclick="goto('students');setTimeout(()=>openStudent('${s.id}'),0)">
                <td>${avatarHtml(s, 26)}</td><td class="mono">${esc(s.admNo || '—')}</td><td>${esc(s.name)}</td><td>${branchName(s.branch)}</td>
                <td class="mono">${s.cgpa.toFixed(2)}</td><td>${s.roomId ? `${s.roomId} / bed ${s.bedNo}` : '<span class="badge warn">Unassigned</span>'}</td>
              </tr>`).join("") || `<tr><td colspan="6" class="empty">No students admitted yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-title"><h2>Waiting list</h2></div>
        ${waiting.length ? `<table><tbody>${waiting.map(s => `<tr><td>${avatarHtml(s, 24)}</td><td>${esc(s.name)}</td><td>${branchName(s.branch)}</td><td style="text-align:right"><button class="btn ghost sm" onclick="approveApplicant('${s.id}')">Approve</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No applicants currently on the waiting list.</div>`}
      </div>
    </div>`;
    }
    function saveMeritCriteria(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const picked = Object.keys(CRITERIA_DEFS).filter(k => !CRITERIA_DEFS[k].core && fd.get("use_" + k) === "on")
        .map(k => ({ k, ord: Number(fd.get("ord_" + k)) || 99 }))
        .sort((a, b) => a.ord - b.ord)
        .map(x => x.k);
      DB.meritCriteria = { levels: picked };
      addAudit("Admissions", "Merit ranking criteria updated", `Levels after Tier/CGPA: ${picked.map(k => CRITERIA_DEFS[k].label).join(" → ") || "(none)"}.`);
      saveDB(); toast("Ranking criteria saved."); renderAdmissions();
    }
    async function submitAdmission(e) {
      e.preventDefault();
      const f = e.target;
      const fd = new FormData(f);
      const s = Object.fromEntries(fd.entries());
      const id = uid("STU");
      const appliedDate = todayISO();

      const photoFile = fd.get("photo"); let photo = null;
      if (photoFile && photoFile.size > 0) {
        if (photoFile.size > 3 * 1024 * 1024) { toast("Photograph is too large — please use a file under 3 MB."); return; }
        photo = await fileToDataURL(photoFile);
      }
      const docFiles = fd.getAll("documents").filter(x => x && x.size > 0);
      const documents = [];
      for (const file of docFiles) {
        if (file.size > 3 * 1024 * 1024) { toast(`"${file.name}" is over 3 MB and was skipped.`); continue; }
        documents.push({ id: uid("DOC"), name: file.name, type: file.type || "file", size: file.size, dataUrl: await fileToDataURL(file), uploadedDate: appliedDate });
      }
      const backlogCourses = s.clearedAllCourses === "No" ? (s.backlogCourses || "") : "";
      const backlogCount = countBacklogs(backlogCourses);

      const student = {
        id, admNo: null, misNo: s.misNo, name: s.name.trim(), gender: s.gender, yearOfStudy: s.yearOfStudy, branch: s.branch, category: s.category,
        physicalDisability: s.physicalDisability, sbc: s.sbc,
        correspondenceAddress: s.correspondenceAddress, personalEmail: s.personalEmail, contactNo: s.contactNo, universityEmail: s.universityEmail,
        localGuardianName: s.localGuardianName || "", localGuardianAddress: s.localGuardianAddress || "", localGuardianContact: s.localGuardianContact || "",
        parentName: s.parentName, parentOccupation: s.parentOccupation || "", parentAnnualIncome: Number(s.parentAnnualIncome) || 0,
        previousHostelRecords: s.prevYear ? [{ academicYear: s.prevYear, class: s.prevClass || "", branch: branchName(s.branch), blockRoom: s.prevRoom || "—", messName: s.prevMess || "—", messDuesPending: s.prevMessDues || "No" }] : [],
        clearedAllCourses: s.clearedAllCourses, backlogCourses, examRecords: [{ examName: s.yearOfStudy, yearOfPassing: String(new Date().getFullYear()), cgpa: Number(s.cgpa) }],
        cgpa: Number(s.cgpa) || 0, backlogCount, misconduct: false,
        admissionDate: null, appliedDate, status: "Applied", roomId: null, bedNo: null, photo, documents,
        feeInvoices: [], feePayments: [], messCard: null,
        history: [{ date: appliedDate, event: "Application received", note: `Applied for hostel admission, A.Y. ${currentYear().label}, ${branchName(s.branch)}. Awaiting branch-wise merit list review.` }],
      };
      DB.students.push(student);
      addAudit("Admissions", "Application received", `${student.name} (${branchName(student.branch)}) applied.`, id);
      saveDB();
      toast(`${student.name} added to the ${branchName(student.branch)} merit list. A unique admission number will be assigned on approval.`);
      f.reset();
      admissionsTab = "merit";
      renderAdmissions();
    }
    function approveApplicant(id) {
      const s = DB.students.find(x => x.id === id);
      const el = eligibility(s);
      if (!el.ok) { toast(`Cannot approve — ${el.label}.`); return; }
      const wasWaiting = s.status === "Waiting List";
      s.status = "Active";
      s.admissionDate = s.admissionDate || todayISO();
      if (!s.admNo) s.admNo = makeAdmNo(s.branch);
      if (!s.feeInvoices || !s.feeInvoices.length) {
        s.feeInvoices = DB.feeStructure.filter(f => f.branch === s.branch).map(f => ({ id: uid("INV"), type: f.feeType, invoiceDate: s.admissionDate, cost: f.cost }));
      }
      s.history.push({ date: todayISO(), event: "Admission approved", note: `${wasWaiting ? "Approved from waiting list." : "Approved via branch-wise merit list."} Assigned admission no. ${s.admNo}. Fee invoices generated.` });
      addAudit("Admissions", "Admission approved", `${s.name} (${branchName(s.branch)}) approved. Adm. No: ${s.admNo}.`, id);
      saveDB();
      toast(`${s.name} admitted — Adm. No. ${s.admNo}. ${anyHostelValidated() ? "Proceed to Room Allotment to assign a bed." : "Room allotment is disabled until a hostel is validated."}`);
      renderAdmissions();
    }
    function waitlistApplicant(id) {
      const s = DB.students.find(x => x.id === id);
      s.status = "Waiting List";
      s.history.push({ date: todayISO(), event: "Placed on waiting list", note: "Below current admission cut-off in the branch-wise merit list." });
      addAudit("Admissions", "Waiting list", s.name, id);
      saveDB(); toast(`${s.name} moved to the waiting list.`); renderAdmissions();
    }
    function rejectApplicant(id) {
      const s = DB.students.find(x => x.id === id);
      s.status = "Rejected";
      s.history.push({ date: todayISO(), event: "Application rejected", note: "Did not meet admission eligibility or merit cut-off." });
      addAudit("Admissions", "Application rejected", s.name, id);
      saveDB(); toast(`${s.name}'s application marked rejected.`); renderAdmissions();
    }

    /* =========================================================
       ROOM ALLOTMENT
       ========================================================= */
    function renderRooms() {
      if (!anyHostelValidated()) {
        document.getElementById("view-rooms").innerHTML = `<div class="banner"><span>Room allotment is disabled: no hostel has a validated room and bed master yet.</span><button class="btn ghost sm" onclick="goto('infra')">Go to Infrastructure</button></div>`;
        return;
      }
      const blocks = DB.hostels.filter(h => h.validated);
      document.getElementById("view-rooms").innerHTML = `
    <div class="panel">
      <div class="room-legend"><span><span class="dot vacant"></span> Vacant</span><span><span class="dot occupied"></span> Occupied</span><span><span class="dot maint"></span> Maintenance</span></div>
      ${blocks.map(h => `
        <div class="block-title">${esc(h.name)}</div>
        <div class="room-grid">
          ${DB.rooms.filter(r => r.hostelId === h.id).map(r => {
        const occ = r.beds.filter(x => x.status === "occupied").length;
        return `<div class="room-card">
              <div class="rid">${r.id}</div><div class="occ">${r.floorLabel} · ${occ}/${r.capacitySanctioned} occupied</div>
              <div class="bed-list">
                ${r.beds.map(bd => `<div class="bed ${bd.status}">
                  <span>Bed ${bd.no}${bd.status === 'occupied' ? ` — ${esc(studentName(bd.studentId))}` : ''}${bd.status === 'maintenance' ? ' — maintenance' : ''}</span>
                  <span>
                  ${bd.status === "vacant" ? `<button onclick="openAssignBed('${r.id}',${bd.no})">Assign</button>` : ""}
                  ${bd.status === "occupied" ? `<button onclick="vacateBed('${r.id}',${bd.no})">Vacate</button>` : ""}
                  </span>
                </div>`).join("")}
              </div>
            </div>`;
      }).join("")}
      `).join("")}
    </div>
  `;
    }
    function openAssignBed(roomId, bedNo) {
      const unassigned = DB.students.filter(s => s.status === "Active" && !s.roomId);
      openModal(`
    <div class="modal-head"><h2>Assign Bed ${bedNo} — Room ${roomId}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    ${unassigned.length ? `
      <div class="field"><label>Select student</label>
        <select id="assignSelect">${unassigned.map(s => `<option value="${s.id}">${esc(s.name)} — ${branchName(s.branch)} (${esc(s.admNo)})</option>`).join("")}</select>
      </div>
      <div class="form-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn maroon" onclick="confirmAssign('${roomId}',${bedNo})">Confirm allotment</button></div>
    ` : `<div class="empty">No admitted students are currently awaiting a room.</div><div class="form-actions"><button class="btn ghost" onclick="closeModal()">Close</button></div>`}
  `);
    }
    function confirmAssign(roomId, bedNo) {
      const studentId = document.getElementById("assignSelect").value;
      const bed = findBed(roomId, bedNo);
      const student = DB.students.find(s => s.id === studentId);
      if (student.roomId) { toast("Student already has a bed."); return; }
      bed.status = "occupied"; bed.studentId = studentId;
      student.roomId = roomId; student.bedNo = bedNo;
      student.history.push({ date: todayISO(), event: "Room allotted", note: `Allotted Room ${roomId}, Bed ${bedNo}.` });
      addAudit("Room Allotment", "Bed assigned", `Room ${roomId}, Bed ${bedNo} assigned.`, studentId);
      saveDB(); closeModal(); toast(`${student.name} allotted Room ${roomId}, Bed ${bedNo}.`); renderRooms();
    }
    function vacateBed(roomId, bedNo) {
      const bed = findBed(roomId, bedNo);
      const student = DB.students.find(s => s.id === bed.studentId);
      if (student) {
        student.history.push({ date: todayISO(), event: "Room vacated", note: `Vacated Room ${roomId}, Bed ${bedNo}.` });
        student.roomId = null; student.bedNo = null;
        addAudit("Room Allotment", "Bed vacated", `Room ${roomId}, Bed ${bedNo} vacated.`, student.id);
      }
      bed.status = "vacant"; bed.studentId = null;
      saveDB(); toast("Bed marked vacant."); renderRooms();
    }

    /* =========================================================
       STUDENT RECORDS
       ========================================================= */
    let studentFilter = { q: "", branch: "All", status: "All" };
    function renderStudents() {
      const list = DB.students.filter(s => {
        if (studentFilter.branch !== "All" && s.branch !== studentFilter.branch) return false;
        if (studentFilter.status !== "All" && s.status !== studentFilter.status) return false;
        if (studentFilter.q && !(s.name.toLowerCase().includes(studentFilter.q.toLowerCase()) || (s.misNo || "").toLowerCase().includes(studentFilter.q.toLowerCase()))) return false;
        return true;
      });
      document.getElementById("view-students").innerHTML = `
    <div class="panel">
      <div class="searchbar">
        <input placeholder="Search by name or MIS No.…" value="${esc(studentFilter.q)}" oninput="studentFilter.q=this.value; renderStudents()">
        <select onchange="studentFilter.branch=this.value; renderStudents()">
          <option>All</option>${BRANCHES.map(b => `<option ${studentFilter.branch === b.code ? 'selected' : ''} value="${b.code}">${b.name}</option>`).join("")}
        </select>
        <select onchange="studentFilter.status=this.value; renderStudents()">
          ${["All", "Active", "Applied", "Waiting List", "Alumni", "Rejected"].map(c => `<option ${studentFilter.status === c ? 'selected' : ''}>${c}</option>`).join("")}
        </select>
      </div>
      <table>
        <thead><tr><th></th><th>Adm. No.</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Room</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${list.map(s => `
            <tr class="rowlink" onclick="openStudent('${s.id}')">
              <td>${avatarHtml(s, 28)}</td><td class="mono" style="font-size:11px">${esc(s.admNo || '—')}</td>
              <td>${esc(s.name)}</td><td>${branchName(s.branch)}</td><td class="mono">${s.cgpa.toFixed(2)}</td>
              <td>${s.roomId ? esc(s.roomId) : '—'}</td><td>${statusBadge(s.status)}</td>
              <td style="text-align:right"><button class="btn ghost sm">View</button></td>
            </tr>`).join("") || `<tr><td colspan="8" class="empty">No students match this filter.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
    }
    function openStudent(id) {
      const s = DB.students.find(x => x.id === id);
      if (!s) return;
      const el = eligibility(s);
      openModal(`
    <div class="modal-head"><h2>Student record</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="profile-head">
      <div style="display:flex;gap:14px;align-items:flex-start">
        ${avatarHtml(s, 64)}
        <div>
          <div class="profile-name">${esc(s.name)}</div>
          <div class="tag-row">${statusBadge(s.status)}<span class="badge neutral">${branchName(s.branch)}</span><span class="badge neutral">${esc(s.category)}</span></div>
          <input type="file" accept="image/*" id="studentPhotoInput" style="display:none" onchange="uploadStudentPhoto('${s.id}', this)">
          <button class="btn ghost sm" style="margin-top:6px" onclick="document.getElementById('studentPhotoInput').click()">${s.photo ? 'Replace photo' : 'Upload photo'}</button>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--ink-soft)">Admission No.</div>
        <div class="mono" style="font-size:14px;font-weight:700;color:var(--navy-800)">${esc(s.admNo || '—')}</div>
        <div style="font-size:10.5px;color:var(--ink-soft);margin-top:4px">MIS No.: ${esc(s.misNo || '—')}</div>
      </div>
    </div>
    <div class="meta-grid">
      <div><div class="k">Year of study</div><div class="v">${esc(s.yearOfStudy)}</div></div>
      <div><div class="k">Gender</div><div class="v">${esc(s.gender)}</div></div>
      <div><div class="k">Room / Bed</div><div class="v">${s.roomId ? `${s.roomId} — Bed ${s.bedNo}` : 'Unassigned'}</div></div>
      <div><div class="k">Admitted</div><div class="v">${fmtDate(s.admissionDate)}</div></div>
    </div>
    ${s.status === "Active" ? `
    <fieldset>
      <legend>Fees &amp; mess card</legend>
      <div class="meta-grid" style="margin:4px 0">
        <div><div class="k">Fee dues</div><div class="v">${(() => { const t = studentFeeTotals(s); return t.remaining > 0 ? `<span class="badge bad">₹${t.remaining.toLocaleString('en-IN')} due</span>` : `<span class="badge good">Paid in full</span>`; })()}</div></div>
        <div><div class="k">Mess card</div><div class="v">${s.messCard ? `${esc(s.messCard.type)} — ${s.messCard.status === 'Active' ? `<span class="badge good">Active</span>` : `<span class="badge neutral">${esc(s.messCard.status)}</span>`}` : `<span class="badge warn">Not issued</span>`}</div></div>
      </div>
      <div class="tag-row">
        <button class="btn ghost sm" onclick="closeModal(); goto('fees'); setTimeout(()=>openFeeDetail('${s.id}'),0)">Manage fees</button>
        <button class="btn ghost sm" onclick="closeModal(); goto('mess'); setTimeout(()=>openMessCard('${s.id}'),0)">Manage mess card</button>
        <button class="btn ghost sm" onclick="closeModal(); goto('complaints')">Log a complaint</button>
      </div>
    </fieldset>` : ""}
    <fieldset>
      <legend>Contact</legend>
      <div class="meta-grid" style="margin:4px 0">
        <div><div class="k">Personal e-mail</div><div class="v">${esc(s.personalEmail || '—')}</div></div>
        <div><div class="k">University e-mail</div><div class="v">${esc(s.universityEmail || '—')}</div></div>
        <div><div class="k">Contact no.</div><div class="v">${esc(s.contactNo || '—')}</div></div>
        <div><div class="k">Correspondence address</div><div class="v">${esc(s.correspondenceAddress || '—')}</div></div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Family &amp; local guardian</legend>
      <div class="meta-grid" style="margin:4px 0">
        <div><div class="k">Parent / Guardian</div><div class="v">${esc(s.parentName || '—')}</div></div>
        <div><div class="k">Occupation</div><div class="v">${esc(s.parentOccupation || '—')}</div></div>
        <div><div class="k">Annual income</div><div class="v">₹${Number(s.parentAnnualIncome || 0).toLocaleString('en-IN')}</div></div>
        <div><div class="k">Local guardian</div><div class="v">${esc(s.localGuardianName || '—')} ${s.localGuardianContact ? `(${esc(s.localGuardianContact)})` : ''}</div></div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Academic record &amp; merit eligibility</legend>
      <div class="meta-grid" style="margin:4px 0">
        <div><div class="k">Latest CGPA</div><div class="v mono">${s.cgpa.toFixed(2)}</div></div>
        <div><div class="k">Cleared all courses</div><div class="v">${esc(s.clearedAllCourses || '—')}</div></div>
        <div><div class="k">Backlog courses</div><div class="v">${esc(s.backlogCourses || 'None')}</div></div>
        <div><div class="k">Merit eligibility</div><div class="v">${el.tier ? `<span class="badge tier${el.tier}">Tier ${el.tier}</span>` : `<span class="badge bad">${esc(el.label)}</span>`}</div></div>
      </div>
    </fieldset>
    <fieldset>
      <legend>Previous hostel record</legend>
      ${(s.previousHostelRecords || []).length ? `
      <table><thead><tr><th>Academic year</th><th>Class</th><th>Branch</th><th>Block &amp; Room</th><th>Mess</th><th>Dues pending</th></tr></thead>
      <tbody>${s.previousHostelRecords.map(p => `<tr><td>${esc(p.academicYear)}</td><td>${esc(p.class)}</td><td>${esc(p.branch)}</td><td>${esc(p.blockRoom)}</td><td>${esc(p.messName)}</td><td>${p.messDuesPending === "Yes" ? `<span class="badge bad">Yes</span>` : `<span class="badge good">No</span>`}</td></tr>`).join("")}</tbody></table>
      ` : `<div class="empty">No previous COEP hostel record on file.</div>`}
    </fieldset>
    <fieldset>
      <legend>Documents (${(s.documents || []).length})</legend>
      ${(s.documents || []).length ? `
      <table><thead><tr><th>Document</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
      <tbody>${s.documents.map(d => `<tr><td>${esc(d.name)}</td><td>${fmtBytes(d.size)}</td><td>${fmtDate(d.uploadedDate)}</td>
      <td style="text-align:right"><a href="${d.dataUrl}" download="${esc(d.name)}" class="btn ghost sm" style="text-decoration:none;display:inline-block">Download</a> <button class="btn danger sm" onclick="removeDocument('${s.id}','${d.id}')">Remove</button></td></tr>`).join("")}</tbody></table>
      ` : `<div class="empty">No documents uploaded yet.</div>`}
      <form onsubmit="addDocuments(event,'${s.id}')" style="margin-top:10px">
        <div class="field"><label>Upload additional document(s)</label><input type="file" name="documents" accept="image/*,.pdf" multiple></div>
        <button class="btn ghost sm" type="submit">Upload</button>
      </form>
    </fieldset>
    <fieldset>
      <legend>Event history</legend>
      <div class="timeline" style="margin-top:6px">
        ${[...s.history].reverse().map(h => `<div class="tl-item"><div class="tl-date">${fmtDate(h.date)}</div><div class="tl-text"><strong>${esc(h.event)}</strong>${h.note ? `<br><span style="color:var(--ink-soft)">${esc(h.note)}</span>` : ''}</div></div>`).join("")}
      </div>
    </fieldset>
    <div class="form-actions">
      ${s.status === "Active" ? `<button class="btn danger" onclick="markAlumni('${s.id}')">Mark as Alumni</button>` : ""}
      <button class="btn ghost" onclick="closeModal()">Close</button>
    </div>
  `);
    }
    async function uploadStudentPhoto(studentId, input) {
      const file = input.files[0]; if (!file) return;
      if (file.size > 3 * 1024 * 1024) { toast("Please choose an image under 3 MB."); return; }
      const s = DB.students.find(x => x.id === studentId);
      s.photo = await fileToDataURL(file);
      s.history.push({ date: todayISO(), event: "Photograph updated", note: "" });
      addAudit("Student Records", "Photograph updated", s.name, studentId);
      saveDB(); toast("Photograph saved."); openStudent(studentId); renderStudents();
    }
    async function addDocuments(e, studentId) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const files = fd.getAll("documents").filter(x => x && x.size > 0);
      if (!files.length) { toast("Choose at least one file to upload."); return; }
      const s = DB.students.find(x => x.id === studentId);
      if (!s.documents) s.documents = [];
      for (const file of files) {
        if (file.size > 3 * 1024 * 1024) { toast(`"${file.name}" is over 3 MB and was skipped.`); continue; }
        s.documents.push({ id: uid("DOC"), name: file.name, type: file.type || "file", size: file.size, dataUrl: await fileToDataURL(file), uploadedDate: todayISO() });
      }
      s.history.push({ date: todayISO(), event: "Document(s) uploaded", note: files.map(f => f.name).join(", ") });
      addAudit("Student Records", "Document uploaded", `${files.length} file(s) — ${s.name}`, studentId);
      saveDB(); toast("Document(s) uploaded."); openStudent(studentId);
    }
    function removeDocument(studentId, docId) {
      const s = DB.students.find(x => x.id === studentId);
      const doc = s.documents.find(d => d.id === docId);
      s.documents = s.documents.filter(d => d.id !== docId);
      addAudit("Student Records", "Document removed", `${doc ? doc.name : docId} — ${s.name}`, studentId);
      saveDB(); toast("Document removed."); openStudent(studentId);
    }
    function markAlumni(id) {
      const s = DB.students.find(x => x.id === id);
      if (s.roomId) { vacateBed(s.roomId, s.bedNo); }
      s.status = "Alumni";
      s.history.push({ date: todayISO(), event: "Status changed to Alumni", note: "Record retained for historical reference." });
      addAudit("Student Records", "Marked Alumni", `${s.name} moved to alumni status.`, id);
      saveDB(); closeModal(); toast(`${s.name} marked as Alumni.`); renderStudents();
    }

    /* =========================================================
       FEES & BILLING
       ========================================================= */
    function studentFeeTotals(s) {
      const total = (s.feeInvoices || []).reduce((a, i) => a + i.cost, 0);
      const paid = (s.feePayments || []).reduce((a, p) => a + p.amount, 0);
      return { total, paid, remaining: total - paid };
    }
    function renderFees() {
      const active = DB.students.filter(s => s.status === "Active");
      document.getElementById("view-fees").innerHTML = `
    <div class="panel">
      <div class="panel-title"><h2>Fee structure — branch-wise</h2><span class="hint">Applied automatically when a student is admitted.</span></div>
      <table>
        <thead><tr><th>Branch</th><th>Fee type</th><th>Cost</th><th></th></tr></thead>
        <tbody>
          ${DB.feeStructure.map(f => `<tr><td>${branchName(f.branch)}</td><td>${esc(f.feeType)}</td><td class="mono">₹${f.cost.toLocaleString('en-IN')}</td>
          <td style="text-align:right"><button class="btn danger sm" onclick="removeFeeItem('${f.id}')">Remove</button></td></tr>`).join("") || `<tr><td colspan="4" class="empty">No fee structure defined yet.</td></tr>`}
        </tbody>
      </table>
      <div class="panel-title" style="margin-top:18px"><h2>Add a fee item</h2></div>
      <form onsubmit="addFeeItem(event)">
        <div class="field-row">
          <div class="field"><label>Branch *</label><select required name="branch">${BRANCHES.map(b => `<option value="${b.code}">${b.name}</option>`).join("")}</select></div>
          <div class="field"><label>Fee type *</label><input required name="feeType" placeholder="e.g. Hostel Fee, Mess Table Charges"></div>
          <div class="field"><label>Cost (₹) *</label><input required type="number" min="0" name="cost"></div>
        </div>
        <button class="btn maroon sm" type="submit">Add fee item</button>
      </form>
    </div>

    <div class="panel">
      <div class="panel-title"><h2>Resident fee report</h2><span class="hint">${active.length} active residents</span></div>
      <table>
        <thead><tr><th>Adm. No.</th><th>Name</th><th>Branch</th><th>Total fees</th><th>Paid</th><th>Remaining</th><th></th></tr></thead>
        <tbody>
          ${active.map(s => {
        const t = studentFeeTotals(s);
        return `<tr>
              <td class="mono">${esc(s.admNo || '—')}</td><td>${esc(s.name)}</td><td>${branchName(s.branch)}</td>
              <td class="mono">₹${t.total.toLocaleString('en-IN')}</td><td class="mono">₹${t.paid.toLocaleString('en-IN')}</td>
              <td class="mono">${t.remaining > 0 ? `<span class="badge bad">₹${t.remaining.toLocaleString('en-IN')}</span>` : `<span class="badge good">₹0</span>`}</td>
              <td style="text-align:right"><button class="btn ghost sm" onclick="openFeeDetail('${s.id}')">Manage</button></td>
            </tr>`;
      }).join("") || `<tr><td colspan="7" class="empty">No active residents.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
    }
    function addFeeItem(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      DB.feeStructure.push({ id: uid("FST"), branch: fd.get("branch"), feeType: fd.get("feeType"), cost: Number(fd.get("cost")) || 0 });
      addAudit("Fees", "Fee item added", `${fd.get("feeType")} — ${branchName(fd.get("branch"))}: ₹${fd.get("cost")}`);
      saveDB(); toast("Fee item added."); renderFees();
    }
    function removeFeeItem(id) {
      const f = DB.feeStructure.find(x => x.id === id);
      DB.feeStructure = DB.feeStructure.filter(x => x.id !== id);
      addAudit("Fees", "Fee item removed", f ? `${f.feeType} — ${branchName(f.branch)}` : id);
      saveDB(); toast("Fee item removed."); renderFees();
    }
    function openFeeDetail(studentId) {
      const s = DB.students.find(x => x.id === studentId);
      const t = studentFeeTotals(s);
      openModal(`
    <div class="modal-head"><h2>Fee report — ${esc(s.name)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="meta-grid" style="margin-top:0">
      <div><div class="k">Total fees</div><div class="v mono">₹${t.total.toLocaleString('en-IN')}</div></div>
      <div><div class="k">Total paid</div><div class="v mono">₹${t.paid.toLocaleString('en-IN')}</div></div>
      <div><div class="k">Remaining</div><div class="v mono">₹${t.remaining.toLocaleString('en-IN')}</div></div>
    </div>
    <fieldset>
      <legend>Invoice details</legend>
      <table><thead><tr><th>Particulars</th><th>Invoice date</th><th>Cost</th></tr></thead>
      <tbody>${(s.feeInvoices || []).map(i => `<tr><td>${esc(i.type)}</td><td>${fmtDate(i.invoiceDate)}</td><td>₹${i.cost.toLocaleString('en-IN')}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">No invoices yet — generated automatically on admission.</td></tr>`}</tbody></table>
    </fieldset>
    <fieldset>
      <legend>Payment history</legend>
      <table><thead><tr><th>Type</th><th>Date</th><th>Paid amount</th></tr></thead>
      <tbody>${(s.feePayments || []).map(p => `<tr><td>${esc(p.type)}</td><td>${fmtDate(p.date)}</td><td>₹${p.amount.toLocaleString('en-IN')}</td></tr>`).join("") || `<tr><td colspan="3" class="empty">No payments recorded yet.</td></tr>`}</tbody></table>
      <form onsubmit="recordPayment(event,'${s.id}')" style="margin-top:10px">
        <div class="field-row">
          <div class="field"><label>Payment type</label><select name="type"><option>Cash</option><option>Online</option><option>DD</option><option>Cheque</option></select></div>
          <div class="field"><label>Paid amount (₹)</label><input required type="number" min="0" name="amount"></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${todayISO()}"></div>
        </div>
        <button class="btn maroon sm" type="submit">Make payment</button>
      </form>
    </fieldset>
    <div class="form-actions"><button class="btn ghost" onclick="closeModal()">Close</button></div>
  `);
    }
    function recordPayment(e, studentId) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const s = DB.students.find(x => x.id === studentId);
      const amount = Number(fd.get("amount")) || 0;
      if (amount <= 0) { toast("Enter a valid paid amount."); return; }
      s.feePayments.push({ id: uid("PMT"), type: fd.get("type"), date: fd.get("date") || todayISO(), amount });
      s.history.push({ date: fd.get("date") || todayISO(), event: "Fee payment recorded", note: `${fd.get("type")}: ₹${amount.toLocaleString('en-IN')}` });
      addAudit("Fees", "Payment recorded", `${s.name}: ₹${amount.toLocaleString('en-IN')} (${fd.get("type")})`, studentId);
      saveDB(); toast("Payment recorded."); openFeeDetail(studentId); renderFees();
    }

    /* =========================================================
       MESS CARD
       ========================================================= */
    function renderMess() {
      const active = DB.students.filter(s => s.status === "Active");
      document.getElementById("view-mess").innerHTML = `
    <div class="panel">
      <div class="panel-title"><h2>Mess cards</h2><span class="hint">${active.filter(s => s.messCard).length} of ${active.length} residents have an active card</span></div>
      <table>
        <thead><tr><th>Adm. No.</th><th>Name</th><th>Card type</th><th>Food type</th><th>Beverage</th><th>Start</th><th>End</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${active.map(s => {
        const m = s.messCard;
        return `<tr>
              <td class="mono">${esc(s.admNo || '—')}</td><td>${esc(s.name)}</td>
              <td>${m ? esc(m.type) : '—'}</td><td>${m ? esc(m.foodType) : '—'}</td><td>${m ? esc(m.beverageType) : '—'}</td>
              <td>${m ? fmtDate(m.startDate) : '—'}</td><td>${m && m.endDate ? fmtDate(m.endDate) : '—'}</td>
              <td>${m ? (m.status === "Active" ? `<span class="badge good">Active</span>` : `<span class="badge neutral">${esc(m.status)}</span>`) : `<span class="badge warn">No card</span>`}</td>
              <td style="text-align:right"><button class="btn ghost sm" onclick="openMessCard('${s.id}')">${m ? 'Manage' : 'Issue card'}</button></td>
            </tr>`;
      }).join("") || `<tr><td colspan="9" class="empty">No active residents.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
    }
    function openMessCard(studentId) {
      const s = DB.students.find(x => x.id === studentId);
      const m = s.messCard || { type: "Temporary", startDate: todayISO(), endDate: "", foodType: "Vegetarian", beverageType: "Tea & Coffee", status: "Active" };
      openModal(`
    <div class="modal-head"><h2>Mess card — ${esc(s.name)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form onsubmit="saveMessCard(event,'${s.id}')">
      <div class="field-row">
        <div class="field"><label>Mess card type</label><select name="type"><option ${m.type === 'Temporary' ? 'selected' : ''}>Temporary</option><option ${m.type === 'Permanent' ? 'selected' : ''}>Permanent</option></select></div>
        <div class="field"><label>Status</label><select name="status"><option ${m.status === 'Active' ? 'selected' : ''}>Active</option><option ${m.status === 'Suspended' ? 'selected' : ''}>Suspended</option><option ${m.status === 'Closed' ? 'selected' : ''}>Closed</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input type="date" name="startDate" value="${esc(m.startDate || '')}"></div>
        <div class="field"><label>End date</label><input type="date" name="endDate" value="${esc(m.endDate || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Food type</label><select name="foodType"><option ${m.foodType === 'Vegetarian' ? 'selected' : ''}>Vegetarian</option><option ${m.foodType === 'Non-Vegetarian' ? 'selected' : ''}>Non-Vegetarian</option></select></div>
        <div class="field"><label>Beverage type</label><input name="beverageType" value="${esc(m.beverageType || '')}" placeholder="e.g. Tea & Coffee"></div>
      </div>
      <div class="form-actions">
        <button class="btn ghost" type="button" onclick="closeModal()">Cancel</button>
        <button class="btn maroon" type="submit">Save mess card</button>
      </div>
    </form>
  `);
    }
    function saveMessCard(e, studentId) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const s = DB.students.find(x => x.id === studentId);
      const isNew = !s.messCard;
      s.messCard = { type: fd.get("type"), status: fd.get("status"), startDate: fd.get("startDate") || todayISO(), endDate: fd.get("endDate") || "", foodType: fd.get("foodType"), beverageType: fd.get("beverageType") || "" };
      s.history.push({ date: todayISO(), event: isNew ? "Mess card issued" : "Mess card updated", note: `${s.messCard.type}, ${s.messCard.foodType}.` });
      addAudit("Mess Card", isNew ? "Card issued" : "Card updated", s.name, studentId);
      saveDB(); closeModal(); toast(isNew ? "Mess card issued." : "Mess card updated."); renderMess();
    }

    /* =========================================================
       VISITORS
       ========================================================= */
    let visitorFilter = "";
    function renderVisitors() {
      const active = DB.students.filter(s => s.status === "Active");
      const list = [...DB.visitors].sort((a, b) => b.date.localeCompare(a.date)).filter(v => {
        if (!visitorFilter) return true;
        const s = DB.students.find(x => x.id === v.studentId);
        return v.name.toLowerCase().includes(visitorFilter.toLowerCase()) || (s && s.name.toLowerCase().includes(visitorFilter.toLowerCase()));
      });
      document.getElementById("view-visitors").innerHTML = `
    <div class="two-col">
      <div class="panel">
        <div class="panel-title"><h2>Visitor log</h2></div>
        <div class="searchbar"><input placeholder="Search by visitor or resident name…" value="${esc(visitorFilter)}" oninput="visitorFilter=this.value; renderVisitors()"></div>
        <table>
          <thead><tr><th>Date</th><th>Visitor</th><th>Type</th><th>Visiting</th><th>Contact</th><th>Comments</th></tr></thead>
          <tbody>
            ${list.map(v => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.name)}</td><td>${esc(v.type)}</td><td>${esc(studentName(v.studentId))}</td><td>${esc(v.contactNo || '—')}</td><td>${esc(v.comments || '—')}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No visitors logged yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-title"><h2>Log a visitor</h2></div>
        <form onsubmit="submitVisitor(event)">
          <div class="field"><label>Visiting which resident? *</label>
            <select required name="studentId">${active.map(s => `<option value="${s.id}">${esc(s.name)} — ${esc(s.admNo || '')}</option>`).join("")}</select>
          </div>
          <div class="field-row">
            <div class="field"><label>Visitor name *</label><input required name="name"></div>
            <div class="field"><label>Relation / type</label><select name="type"><option>Parent</option><option>Guardian</option><option>Friend</option><option>Relative</option><option>Other</option></select></div>
          </div>
          <div class="field"><label>Contact no.</label><input name="contactNo" placeholder="10-digit mobile"></div>
          <div class="field"><label>Comments</label><textarea name="comments" rows="2" placeholder="Purpose of visit"></textarea></div>
          <button class="btn maroon" type="submit">Log visitor</button>
        </form>
      </div>
    </div>
  `;
    }
    function submitVisitor(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const entry = { id: uid("VIS"), studentId: fd.get("studentId"), name: fd.get("name"), type: fd.get("type"), contactNo: fd.get("contactNo") || "", comments: fd.get("comments") || "", date: todayISO() };
      DB.visitors.push(entry);
      addAudit("Visitors", "Visitor logged", `${entry.name} (${entry.type}) visiting ${studentName(entry.studentId)}`, entry.studentId);
      saveDB(); toast("Visitor logged."); renderVisitors();
    }

    /* =========================================================
       COMPLAINTS & MESSAGES
       ========================================================= */
    let complaintFilter = "Open";
    function renderComplaints() {
      const active = DB.students.filter(s => s.status === "Active");
      const list = [...DB.complaints].sort((a, b) => b.date.localeCompare(a.date))
        .filter(c => complaintFilter === "All" ? true : c.status === complaintFilter);
      const openCount = DB.complaints.filter(c => c.status === "Open").length;
      document.getElementById("view-complaints").innerHTML = `
    <div class="two-col">
      <div class="panel">
        <div class="panel-title"><h2>Complaints &amp; messages</h2><span class="hint">${openCount} open</span></div>
        <div class="pill-toggle" style="margin-bottom:14px">
          ${["Open", "Resolved", "All"].map(s => `<button class="${complaintFilter === s ? 'on' : ''}" onclick="complaintFilter='${s}'; renderComplaints()">${s}</button>`).join("")}
        </div>
        <table>
          <thead><tr><th>Date</th><th>From</th><th>Subject</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${list.map(c => `<tr class="rowlink" onclick="openComplaint('${c.id}')">
              <td>${fmtDate(c.date)}</td><td>${esc(studentName(c.studentId))}</td><td>${esc(c.subject)}</td>
              <td>${c.status === "Open" ? `<span class="badge warn">Open</span>` : `<span class="badge good">Resolved</span>`}</td>
              <td style="text-align:right"><button class="btn ghost sm">View</button></td>
            </tr>`).join("") || `<tr><td colspan="5" class="empty">Nothing here.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-title"><h2>Log a complaint / message</h2><span class="hint">On behalf of a resident, e.g. from a phone call or written note.</span></div>
        <form onsubmit="submitComplaint(event)">
          <div class="field"><label>From which resident? *</label>
            <select required name="studentId">${active.map(s => `<option value="${s.id}">${esc(s.name)} — ${esc(s.admNo || '')}${s.roomId ? ` (${esc(s.roomId)})` : ''}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Subject *</label><input required name="subject" placeholder="e.g. Fan not working"></div>
          <div class="field"><label>Message *</label><textarea required name="message" rows="3" placeholder="Describe the issue or query"></textarea></div>
          <button class="btn maroon" type="submit">Log message</button>
        </form>
      </div>
    </div>
  `;
    }
    function openComplaint(id) {
      const c = DB.complaints.find(x => x.id === id);
      openModal(`
    <div class="modal-head"><h2>${esc(c.subject)}</h2><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="meta-grid" style="margin-top:0">
      <div><div class="k">From</div><div class="v">${esc(studentName(c.studentId))}</div></div>
      <div><div class="k">Date</div><div class="v">${fmtDate(c.date)}</div></div>
      <div><div class="k">Status</div><div class="v">${c.status === "Open" ? `<span class="badge warn">Open</span>` : `<span class="badge good">Resolved</span>`}</div></div>
    </div>
    <fieldset><legend>Message</legend><div style="font-size:13px;white-space:pre-wrap">${esc(c.message)}</div></fieldset>
    <fieldset>
      <legend>Response / resolution</legend>
      <form onsubmit="resolveComplaint(event,'${c.id}')">
        <div class="field"><label>Response notes</label><textarea name="response" rows="3" placeholder="What was done to resolve this">${esc(c.response || '')}</textarea></div>
        <div class="form-actions" style="border-top:none;padding-top:0;justify-content:flex-start">
          ${c.status === "Open" ? `<button class="btn maroon" type="submit">Mark resolved</button>` : `<button class="btn ghost" type="submit">Save response</button>`}
        </div>
      </form>
    </fieldset>
    <div class="form-actions"><button class="btn ghost" onclick="closeModal()">Close</button></div>
  `);
    }
    function submitComplaint(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const entry = { id: uid("MSG"), studentId: fd.get("studentId"), subject: fd.get("subject"), message: fd.get("message"), date: todayISO(), status: "Open", response: "" };
      DB.complaints.push(entry);
      const s = DB.students.find(x => x.id === entry.studentId);
      if (s) s.history.push({ date: todayISO(), event: "Complaint logged", note: entry.subject });
      addAudit("Complaints", "Message logged", `${entry.subject} — ${studentName(entry.studentId)}`, entry.studentId);
      saveDB(); toast("Message logged."); renderComplaints();
    }
    function resolveComplaint(e, id) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const c = DB.complaints.find(x => x.id === id);
      c.response = fd.get("response") || "";
      if (c.status === "Open") c.status = "Resolved";
      const s = DB.students.find(x => x.id === c.studentId);
      if (s) s.history.push({ date: todayISO(), event: "Complaint resolved", note: c.subject });
      addAudit("Complaints", c.status === "Resolved" ? "Marked resolved" : "Response updated", `${c.subject} — ${studentName(c.studentId)}`, c.studentId);
      saveDB(); closeModal(); toast("Saved."); renderComplaints();
    }

    /* =========================================================
       REPORTS
       ========================================================= */
    const REPORT_TYPES = [
      { id: "hostel-directory", label: "Hostel Directory & Occupancy" },
      { id: "merit-list", label: "Branch-wise Merit List" },
      { id: "room-allotment", label: "Room & Bed Allotment Status" },
      { id: "student-roster", label: "Admitted Student Roster" },
      { id: "fee-dues", label: "Fee Collection & Dues" },
      { id: "visitor-log", label: "Visitor Log" },
      { id: "complaint-log", label: "Complaints & Messages Log" },
    ];
    let reportState = { type: null, hostelId: "all" };
    function renderReports() {
      document.getElementById("view-reports").innerHTML = `
    <div class="panel no-print">
      <div class="panel-title"><h2>Generate a report</h2><span class="hint">Every report is headed with the university's letterhead.</span></div>
      <div class="field-row">
        <div class="field"><label>Report</label>
          <select id="repType"><option value="">Select a report…</option>${REPORT_TYPES.map(r => `<option value="${r.id}" ${reportState.type === r.id ? 'selected' : ''}>${r.label}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Hostel scope</label>
          <select id="repHostel"><option value="all" ${reportState.hostelId === "all" ? 'selected' : ''}>All hostels</option>${DB.hostels.map(h => `<option value="${h.id}" ${reportState.hostelId === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join("")}</select>
        </div>
      </div>
      <button class="btn maroon" onclick="generateReport()">Generate report</button>
    </div>
    <div id="reportOutput"></div>
  `;
      if (reportState.type) generateReport(true);
    }
    function generateReport(silent) {
      const typeSel = document.getElementById("repType"); const hostelSel = document.getElementById("repHostel");
      if (!silent) { reportState.type = typeSel.value; reportState.hostelId = hostelSel.value; }
      if (!reportState.type) { toast("Select a report to generate."); return; }
      const meta = REPORT_TYPES.find(r => r.id === reportState.type);
      const hostel = reportState.hostelId !== "all" ? DB.hostels.find(h => h.id === reportState.hostelId) : null;
      const body = reportBody(reportState.type, hostel);
      document.getElementById("reportOutput").innerHTML = `
    <div class="letterhead">
      <div class="dept">${esc(DB.org.name)}</div>
      <div class="sub2">${esc(DB.org.subtitle)}</div>
      <div class="office">${esc(DB.org.dept)}</div>
      <div class="addr">${esc(DB.org.address)} · Tel: ${esc(DB.org.phone)}${DB.org.fax ? ` · Fax: ${esc(DB.org.fax)}` : ""} · ${esc(DB.org.email)}</div>
      <div class="scope">
        <div><div class="rtitle">${esc(meta.label)}</div>${hostel ? `<div>${esc(hostel.name)} — ${esc(hostel.address)}</div>` : `<div>All hostels</div>`}</div>
        <div style="text-align:right"><div>Academic Year: <strong>${esc(currentYear().label)}</strong></div><div>Generated: ${fmtDate(todayISO())}</div></div>
      </div>
    </div>
    <div class="report-doc">${body}</div>
    <div class="no-print" style="margin-bottom:24px"><button class="btn maroon" onclick="printReport()">Print / Save as PDF</button></div>
  `;
    }
    function printReport() {
      const el = document.getElementById("view-reports");
      el.classList.add("printing"); window.print();
      setTimeout(() => el.classList.remove("printing"), 300);
    }
    window.addEventListener("afterprint", () => { const el = document.getElementById("view-reports"); if (el) el.classList.remove("printing"); });
    function scopedHostels(hostel) { return hostel ? [hostel] : DB.hostels; }
    function reportBody(type, hostel) {
      if (type === "hostel-directory") return reportHostelDirectory(hostel);
      if (type === "merit-list") return reportMeritList();
      if (type === "room-allotment") return reportRoomAllotment(hostel);
      if (type === "student-roster") return reportStudentRoster(hostel);
      if (type === "fee-dues") return reportFeeDues();
      if (type === "visitor-log") return reportVisitorLog();
      if (type === "complaint-log") return reportComplaintLog();
      return `<div class="empty">Report not available.</div>`;
    }
    function reportComplaintLog() {
      const list = [...DB.complaints].sort((a, b) => b.date.localeCompare(a.date));
      const open = list.filter(c => c.status === "Open").length;
      return `
    <table><thead><tr><th>Open</th><th>Resolved</th><th>Total</th></tr></thead>
    <tbody><tr><td>${open}</td><td>${list.length - open}</td><td>${list.length}</td></tr></tbody></table>
    <table style="margin-top:14px"><thead><tr><th>Date</th><th>Resident</th><th>Subject</th><th>Status</th></tr></thead>
    <tbody>${list.map(c => `<tr><td>${fmtDate(c.date)}</td><td>${esc(studentName(c.studentId))}</td><td>${esc(c.subject)}</td><td>${esc(c.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No complaints logged.</td></tr>`}</tbody></table>`;
    }
    function reportFeeDues() {
      const active = DB.students.filter(s => s.status === "Active");
      const totals = active.reduce((a, s) => { const t = studentFeeTotals(s); a.total += t.total; a.paid += t.paid; a.due += t.remaining; return a; }, { total: 0, paid: 0, due: 0 });
      return `
    <table><thead><tr><th>Total invoiced</th><th>Total collected</th><th>Total outstanding</th></tr></thead>
    <tbody><tr><td>₹${totals.total.toLocaleString('en-IN')}</td><td>₹${totals.paid.toLocaleString('en-IN')}</td><td>₹${totals.due.toLocaleString('en-IN')}</td></tr></tbody></table>
    <table style="margin-top:14px"><thead><tr><th>Adm. No.</th><th>Name</th><th>Branch</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
    <tbody>${active.map(s => { const t = studentFeeTotals(s); return `<tr><td>${esc(s.admNo || '—')}</td><td>${esc(s.name)}</td><td>${branchName(s.branch)}</td><td>₹${t.total.toLocaleString('en-IN')}</td><td>₹${t.paid.toLocaleString('en-IN')}</td><td>₹${t.remaining.toLocaleString('en-IN')}</td></tr>`; }).join("") || `<tr><td colspan="6" class="empty">No active residents.</td></tr>`}</tbody></table>`;
    }
    function reportVisitorLog() {
      const list = [...DB.visitors].sort((a, b) => b.date.localeCompare(a.date));
      return `<table><thead><tr><th>Date</th><th>Visitor</th><th>Type</th><th>Visiting</th><th>Contact</th></tr></thead>
  <tbody>${list.map(v => `<tr><td>${fmtDate(v.date)}</td><td>${esc(v.name)}</td><td>${esc(v.type)}</td><td>${esc(studentName(v.studentId))}</td><td>${esc(v.contactNo || '—')}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No visitors logged.</td></tr>`}</tbody></table>`;
    }
    function reportHostelDirectory(hostel) {
      const list = scopedHostels(hostel);
      return list.map(h => {
        const rooms = DB.rooms.filter(r => r.hostelId === h.id);
        const beds = rooms.reduce((a, r) => a + r.capacitySanctioned, 0);
        const occ = rooms.reduce((a, r) => a + r.beds.filter(b => b.status === "occupied").length, 0);
        return `<div class="block-title">${esc(h.name)}</div>
      <div class="meta-grid" style="margin-top:0">
        <div><div class="k">Address</div><div class="v">${esc(h.address)}</div></div>
        <div><div class="k">Type</div><div class="v">${esc(h.type)}</div></div>
      </div>
      <table><thead><tr><th>Rooms</th><th>Sanctioned beds</th><th>Occupied</th><th>Vacant</th></tr></thead>
      <tbody><tr><td>${rooms.length}</td><td>${beds}</td><td>${occ}</td><td>${beds - occ}</td></tr></tbody></table>`;
      }).join("<div style='height:14px'></div>");
    }
    function reportMeritList() {
      const levels = activeLevels();
      const criteria = `<div style="font-size:12px;color:var(--ink-soft);margin-bottom:16px">
    Ranking order: eligibility (≤3 backlogs, no misconduct) → ${levels.map(k => esc(CRITERIA_DEFS[k].label)).join(" → ")}.
  </div>`;
      const body = BRANCHES.map(b => {
        const list = DB.students.filter(s => s.branch === b.code && (s.status === "Applied" || s.status === "Active" || s.status === "Waiting List"));
        if (!list.length) return "";
        const sorted = rankApplicants(list);
        return `<div class="block-title">${esc(b.name)}</div>
    <table><thead><tr><th>Rank</th><th>Name</th><th>MIS No.</th><th>CGPA</th><th>Tier</th><th>Backlogs</th><th>Status</th></tr></thead>
    <tbody>${sorted.map((s, i) => { const el = eligibility(s); return `<tr><td>${el.ok ? i + 1 : '—'}</td><td>${esc(s.name)}</td><td>${esc(s.misNo)}</td><td>${s.cgpa.toFixed(2)}</td><td>${el.tier ? 'Tier ' + el.tier : esc(el.label)}</td><td>${s.backlogCount}</td><td>${esc(s.status)}</td></tr>`; }).join("")}</tbody></table>`;
      }).join("") || `<div class="empty">No applications recorded.</div>`;
      return criteria + body;
    }
    function reportRoomAllotment(hostel) {
      const list = scopedHostels(hostel);
      return list.map(h => `<div class="block-title">${esc(h.name)}</div>
    <table><thead><tr><th>Room</th><th>Floor</th><th>Capacity</th><th>Occupied</th><th>Vacant</th></tr></thead>
    <tbody>${DB.rooms.filter(r => r.hostelId === h.id).map(r => {
        const occ = r.beds.filter(b => b.status === "occupied").length; const vac = r.beds.filter(b => b.status === "vacant").length;
        return `<tr><td>${r.roomNumber}</td><td>${esc(r.floorLabel)}</td><td>${r.capacitySanctioned}</td><td>${occ}</td><td>${vac}</td></tr>`;
      }).join("")}</tbody></table>`).join("");
    }
    function reportStudentRoster(hostel) {
      const rows = DB.students.filter(s => s.status === "Active").filter(s => {
        if (!hostel) return true;
        const room = DB.rooms.find(r => r.id === s.roomId);
        return room && room.hostelId === hostel.id;
      });
      return `<table><thead><tr><th>Adm. No.</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Room</th></tr></thead>
  <tbody>${rows.map(s => `<tr><td>${esc(s.admNo || '—')}</td><td>${esc(s.name)}</td><td>${branchName(s.branch)}</td><td>${s.cgpa.toFixed(2)}</td><td>${s.roomId ? esc(s.roomId) : '—'}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No active residents.</td></tr>`}</tbody></table>`;
    }

    /* =========================================================
       INIT
       ========================================================= */
    buildNav();
    goto("dashboard");
    updateSupabaseUI();
    initSupabase(true);
