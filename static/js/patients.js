/* ==========================================================================
   EPICONSULT e-CLINIC — NEW PATIENT REGISTRATION ENGINE
   patients.html ONLY
   Supabase Write • Wizard • Right Panel Review/Confirm • Services Integration
   ✅ LIVE AUTO PREVIEW (no button) + Smart Dynamic UX Enhancements
============================================================================ */

(() => {
  "use strict";

  /* ======================================================================
     0. SAFE HELPERS
  ====================================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeText = (v, fallback = "—") => {
    const s = (v ?? "").toString().trim();
    return s ? s : fallback;
  };

  const formatNaira = (n) => {
    const num = Number(n || 0);
    try {
      return "₦" + num.toLocaleString("en-NG", { maximumFractionDigits: 0 });
    } catch {
      return `₦${num.toLocaleString()}`;
    }
  };

  const pad2 = (n) => String(n).padStart(2, "0");

  const nowLocalTimeHHMM = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const nowLocalDateYYYYMMDD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const setLive = (msg) => {
    const lr = $("#patientsLiveRegion");
    if (!lr) return;
    lr.textContent = msg;
  };

  const setLastAction = (msg) => {
    const el = $("#patientsLastActionTime");
    if (!el) return;
    const d = new Date();
    const stamp = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    el.textContent = `${msg} • ${stamp}`;
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  /* ======================================================================
     1. CORE SELECTORS
  ====================================================================== */
  const form = $("#patientRegistrationForm");
  if (!form) return;

  // Wizard
  const stepButtons = $$(".step-pill");
  const stepPanels = $$("[data-step-panel]");
  const btnNext = $("#btnNextStep");
  const btnPrev = $("#btnPrevStep");

  // Top actions
  const btnSaveDraft = $("#btnSaveDraft");
  const btnSaveDraftTop = $("#btnSaveDraftTop");
  const btnClearForm = $("#btnClearFormTop");
  const btnNewRegistration = $("#btnNewRegistration");

  // Confirm + print/export
  const btnConfirmSave = $("#btnConfirmSave");
  const btnPrintPreview = $("#btnPrintPreview");
  const btnExportPreview = $("#btnExportPreview");

  // Booking helpers
  const btnUseCurrentTime = $("#btnUseCurrentTime");
  const btnClearBookingMetaBtns = $$(`#btnClearBookingMeta`); // duplicate IDs in HTML

  // Quick actions / focus
  const btnJumpToServices = $("#btnJumpToServices");
  const btnScrollToTop = $("#btnScrollToTop");
  const btnFocusBooking = $("#btnFocusBooking");
  const btnFocusServices = $("#btnFocusServices");

  // Header pills
  const patientsConnectionPill = $("#patientsConnectionPill");
  const patientsConnText = $("#patientsConnText");
  const patientsAutosaveText = $("#patientsAutosaveText");

  // Identity preview (topbar)
  const avatarInitials = $("#patientAvatarInitials");
  const identityName = $("#patientIdentityName");
  const identitySub = $("#patientIdentitySub");
  const chipAgeVal = $("#chipAgeVal");
  const chipSexVal = $("#chipSexVal");

  // Mini summary
  const miniPatientName = $("#miniPatientName");
  const miniPatientPhone = $("#miniPatientPhone");
  const miniServicesCount = $("#miniServicesCount");
  const miniServicesTotal = $("#miniServicesTotal");
  const miniPriceType = $("#miniPriceType");
  const miniLastEdit = $("#miniLastEdit");

  // Right panel (review card)
  const previewContainer = $("#patientPreviewContent");
  const previewStatusBadge = $("#previewStatusBadge");
  const draftStatusBadge = $("#draftStatusBadge");
  const completionPct = $("#completionPct");
  const completionFill = $("#completionFill");
  const flagsBadge = $("#flagsBadge");
  const flagsList = $("#flagsList");

  // Booking snapshot fields (right panel)
  const snapBookingDate = $("#snapBookingDate");
  const snapBookingTime = $("#snapBookingTime");
  const snapServiceType = $("#snapServiceType");
  const snapRegistrationType = $("#snapRegistrationType");
  const snapDoctor = $("#snapDoctor");



  const snapEnrollee = $("#snapEnrollee"); // (will now show category/details)

  // STEP 3 — Patient Category controls
  const patientCategoryHidden = $("#patientCategory");
  const catInputs = $$(".cat-pill input[type='checkbox'][data-cat]");
  const catPanels = $$(".cat-panel[data-panel]");
  const categoryStatus = $("#categoryStatus");

  // Group + NHIS fields
  const groupName = $("#groupName");
  const btnClearGroup = $("#btnClearGroup");

  const enrolleeType = $("#enrolleeType");
  const enrolleeMinistry = $("#enrolleeMinistry");
  const enrolleeNo = $("#enrolleeNo");
  const btnClearNhis = $("#btnClearNhis");


  

  // Checklist dots
  const checklistDots = $$("#patientsChecklist .dot");

  /* ======================================================================
     2. STATE
  ====================================================================== */
  let currentStep = 1;
  const TOTAL_STEPS = 4;

  let isDraftSaved = false;
  let lastEditTs = 0;

  // ✅ Smart: Only show preview after meaningful input
  let hasMeaningfulInput = false;

  // ✅ Smart: live preview timing
  let previewTimer = null;
  let lastPreviewHash = ""; // avoid DOM rewrite if unchanged

  // ✅ Smart: basic unsaved-change guard
  let dirtySinceLastSave = false;

  /* ======================================================================
     3. UTILITIES
  ====================================================================== */
  function calculateAge(dob) {
    if (!dob) return "";
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : "";
  }

  function collectFormData() {
    const fd = new FormData(form);
    const data = {};
    fd.forEach((v, k) => (data[k] = v));
    return data;
  }

  // ✅ Smart: normalize + auto-fill for phone
  function normalizePhone(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    let p = raw.replace(/\s+/g, "");
    // convert "234xxxxxxxxxx" to "+234xxxxxxxxxx"
    if (/^234\d{9,}$/.test(p)) p = "+" + p;
    // keep + and digits only
    p = p.replace(/[^\d+]/g, "");
    return p;
  }

  // services_register.js cart bridge (supports multiple implementations)
  function getSelectedServices() {
    // 1) If services_register.js exposes a cart globally
    const direct =
      (Array.isArray(window.CART) && window.CART) ||
      (Array.isArray(window.servicesCart) && window.servicesCart) ||
      (Array.isArray(window.SELECTED_SERVICES) && window.SELECTED_SERVICES) ||
      (Array.isArray(window.__CART__) && window.__CART__) ||
      null;

    if (direct && direct.length) return direct;

    // 2) Fallback: build cart from DOM (#servicesCartList) so it ALWAYS works
    const rows = Array.from(document.querySelectorAll("#servicesCartList tr")).filter(
      (tr) => !tr.classList.contains("svc-placeholder")
    );

    if (!rows.length) return [];

    return rows.map((tr) => {
      const ds = tr.dataset || {};

      const name = ds.name || tr.querySelector("td")?.textContent?.trim() || "Service";

      const amountText =
        ds.amount || tr.querySelector("td:nth-child(2)")?.textContent?.trim() || "0";

      const amountNumber = Number(String(amountText).replace(/[^\d.]/g, "")) || 0;

      const type = ds.type || tr.querySelector("td:nth-child(3)")?.textContent?.trim() || "";

      return {
        name,
        type,
        amountLabel: amountText,
        amountNumber,
      };
    });
  }

  function computeServicesTotal(services) {
    return (services || []).reduce((sum, s) => {
      const n =
        Number(s?.amountNumber) ||
        Number(s?.amount) ||
        Number(s?.price) ||
        Number(s?.selectedPrice) ||
        0;
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  function getPriceTypeLabel() {
    const v = form.querySelector("input[name='priceType']:checked")?.value || "walkin";
    if (v === "hospital") return "Hospital";
    if (v === "outsourced") return "Outsourced";
    return "Walk In";
  }

  function markEdited() {
    lastEditTs = Date.now();
    dirtySinceLastSave = true;

    if (miniLastEdit) {
      const d = new Date(lastEditTs);
      miniLastEdit.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    setLastAction("Edited");
  }

  function setConnectionUI() {
    const online = navigator.onLine;
    if (patientsConnText) patientsConnText.textContent = online ? "Online" : "Offline";
    if (patientsConnectionPill) {
      patientsConnectionPill.classList.toggle("meta-ok", online);
      patientsConnectionPill.classList.toggle("meta-bad", !online);
      patientsConnectionPill.title = online ? "Realtime connectivity status" : "No internet connection";
    }
  }

  function setAutosaveUI(text, isSaved = false) {
    if (patientsAutosaveText) patientsAutosaveText.textContent = text;
    if (draftStatusBadge) {
      draftStatusBadge.textContent = isSaved ? "Saved" : "Draft";
      draftStatusBadge.classList.toggle("badge-ok", isSaved);
      draftStatusBadge.classList.toggle("badge-muted", !isSaved);
    }
  }

  function setPreviewBadge(mode) {
    // mode: "hidden" | "live" | "ready"
    if (!previewStatusBadge) return;

    if (mode === "hidden") {
      previewStatusBadge.textContent = "No Preview";
      previewStatusBadge.classList.remove("badge-ok");
      previewStatusBadge.classList.add("badge-muted");
      return;
    }

    if (mode === "live") {
      previewStatusBadge.textContent = "Live Preview";
      previewStatusBadge.classList.add("badge-ok");
      previewStatusBadge.classList.remove("badge-muted");
      return;
    }

    previewStatusBadge.textContent = "Preview Ready";
    previewStatusBadge.classList.add("badge-ok");
    previewStatusBadge.classList.remove("badge-muted");
  }

  function setChecklistDot(key, ok) {
    const dot = checklistDots.find((d) => d.dataset.check === key);
    if (!dot) return;
    dot.classList.toggle("is-ok", !!ok);
    dot.classList.toggle("is-bad", !ok);
  }

// ✅ Smart: determine “meaningful input” (v2 — category-aware)
// ✅ Smart: determine “meaningful input” (v3 — category-aware + case-safe)
function detectMeaningfulInput(data) {
  // Basic identity
  const hasName = !!((data.first_name || "").trim() || (data.last_name || "").trim());
  const hasPhone = !!((data.phone || "").trim());
  const hasDob = !!((data.date_of_birth || "").trim());
  const hasSex = !!((data.sex || "").trim());

  // Booking intent
  const hasBooking = !!((data.booking_date || "").trim() || (data.booking_time || "").trim());
  const hasServiceMeta = !!((data.service_type || "").trim() || (data.doctor || "").trim());

  // ✅ Normalize category casing once
  const cat = (data.patient_category || "").trim().toLowerCase();
  const hasCategory = !!cat;

  const hasGroupInfo = (cat === "group") && !!((data.group_name || "").trim());

  const hasNhisInfo = (cat === "nhis") && !!(
    (data.enrollee_type || "").trim() ||
    (data.enrollee_no || "").trim() ||
    (data.enrollee_ministry || "").trim()
  );

  // Services cart
  const hasServices = getSelectedServices().length > 0;

  return (
    hasName ||
    hasPhone ||
    hasDob ||
    hasSex ||
    hasBooking ||
    hasServiceMeta ||
    hasCategory ||
    hasGroupInfo ||
    hasNhisInfo ||
    hasServices
  );
}



  // ✅ Smart: prevent needless rerender if html content unchanged
function hashPreview(data, services, total) {
  return JSON.stringify({
    f: {
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      sex: data.sex || "",
      age: data.age || "",
      phone: data.phone || "",
      referred_by: data.referred_by || "",

      booking_date: data.booking_date || "",
      booking_time: data.booking_time || "",
      service_type: data.service_type || "",
      registration_type: data.registration_type || "",
      doctor: data.doctor || "",

      // ✅ NEW — Patient Category System
      patient_category: data.patient_category || "",   // private | group | nhis
      group_name: data.group_name || "",               // only when group selected

      // ✅ NHIS/Others fields (still stored even if hidden)
      enrollee_type: data.enrollee_type || "",         // Child | Spouse | Principal | Others
      enrollee_ministry: data.enrollee_ministry || "", // ministry text
      enrollee_no: data.enrollee_no || "",             // enrollee number

      price_type: getPriceTypeLabel(),
    },

    s: (services || []).map((x) => ({
      n: x?.name || "",
      t: x?.type || "",
      a: x?.amountNumber || x?.amount || x?.price || 0,
      l: x?.amountLabel || "",
    })),

    total: total || 0,
  });
}




  /* ======================================================================
     3B. STEP 3 — PATIENT CATEGORY ENGINE (Private / Group / NHIS)
  ====================================================================== */

  function setPanelVisible(cat) {
    if (!catPanels?.length) return;
    catPanels.forEach((p) => {
      const isMatch = p.dataset.panel === cat;
      p.hidden = !isMatch;
    });
  }

  function lockOtherCategories(activeCat) {
    if (!catInputs?.length) return;

    catInputs.forEach((inp) => {
      const pill = inp.closest(".cat-pill");
      if (!pill) return;

      if (!activeCat) {
        inp.disabled = false;
        pill.classList.remove("is-locked");
        return;
      }

      if (inp.dataset.cat !== activeCat) {
        inp.disabled = true;
        pill.classList.add("is-locked");
      } else {
        inp.disabled = false;
        pill.classList.remove("is-locked");
      }
    });
  }

  function enableGroupFields(on) {
    if (!groupName) return;
    groupName.disabled = !on;
    groupName.required = !!on;
    if (btnClearGroup) btnClearGroup.disabled = !on;
    if (!on) groupName.value = "";
  }

  function enableNhisFields(on) {
    if (!enrolleeType || !enrolleeMinistry || !enrolleeNo) return;
    enrolleeType.disabled = !on;
    enrolleeMinistry.disabled = !on;
    enrolleeNo.disabled = !on;

    // Required when NHIS is selected
    enrolleeType.required = !!on;
    enrolleeNo.required = !!on;

    if (btnClearNhis) btnClearNhis.disabled = !on;

    if (!on) {
      enrolleeType.value = "";
      enrolleeMinistry.value = "";
      enrolleeNo.value = "";
    }
  }

  function setCategoryStatus(cat) {
    if (!categoryStatus) return;

    if (!cat) {
      categoryStatus.innerHTML = `<span class="cat-inline-dot is-idle"></span> No category selected`;
      return;
    }

    const label =
      cat === "private" ? "Private active" :
      cat === "group" ? "Group active" :
      "NHIS / Others active";

    categoryStatus.innerHTML = `<span class="cat-inline-dot is-ok"></span> ${label}`;
  }

  function applyCategory(cat) {
    // persist for submit (hidden input)
    if (patientCategoryHidden) patientCategoryHidden.value = cat || "";

    // show panel
    if (!cat) {
      if (catPanels?.length) catPanels.forEach((p) => (p.hidden = true));
    } else {
      setPanelVisible(cat);
    }

    // enable sub-fields
    enableGroupFields(cat === "group");
    enableNhisFields(cat === "nhis");

    // lock other tickboxes
    lockOtherCategories(cat);

    // status label
    setCategoryStatus(cat);

    // trigger preview refresh (since booking snapshot uses it)
    updateIdentityPreview();
    scheduleLivePreview();
  }

  function clearCategorySelection() {
    if (!catInputs?.length) return;
    catInputs.forEach((i) => {
      i.checked = false;
      i.disabled = false;
      i.closest(".cat-pill")?.classList.remove("is-locked");
    });
    applyCategory(null);
  }

  function wireCategoryEvents() {
    if (!catInputs?.length) return;

    catInputs.forEach((inp) => {
      inp.addEventListener("change", () => {
        const cat = inp.dataset.cat;

        if (inp.checked) {
          // behave like radio but still untick-able
          catInputs.forEach((i) => {
            if (i !== inp) i.checked = false;
          });
          applyCategory(cat);
        } else {
          applyCategory(null);
        }

        markEdited();
      });
    });

    btnClearGroup?.addEventListener("click", () => {
      if (groupName) groupName.value = "";
      groupName?.focus?.();
      markEdited();
      scheduleLivePreview();
    });

    btnClearNhis?.addEventListener("click", () => {
      if (enrolleeType) enrolleeType.value = "";
      if (enrolleeMinistry) enrolleeMinistry.value = "";
      if (enrolleeNo) enrolleeNo.value = "";
      enrolleeType?.focus?.();
      markEdited();
      scheduleLivePreview();
    });
  }

 function restoreCategoryUIFromHidden() {
  const cat = (patientCategoryHidden?.value || "").trim().toLowerCase();

  if (!cat || !catInputs?.length) {
    applyCategory(null);
    return;
  }

  const match = catInputs.find((i) => (i.dataset.cat || "").toLowerCase() === cat);
  if (match) match.checked = true;

  applyCategory(cat);
}



  /* ======================================================================
     4. WIZARD CONTROL
  ====================================================================== */
  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    currentStep = step;

    // NOTE: you have TWO panels with data-step-panel="3" (Booking & Services)
    stepPanels.forEach((p) => {
      p.classList.toggle("hidden", Number(p.dataset.stepPanel) !== step);
    });

    stepButtons.forEach((b) => {
      const s = Number(b.dataset.step);
      b.classList.toggle("is-active", s === step);
      b.setAttribute("aria-selected", s === step ? "true" : "false");
    });

    if (btnPrev) btnPrev.disabled = step === 1;
    if (btnNext) btnNext.disabled = step === TOTAL_STEPS;
  }

  btnNext?.addEventListener("click", () => goToStep(currentStep + 1));
  btnPrev?.addEventListener("click", () => goToStep(currentStep - 1));
  stepButtons.forEach((btn) => btn.addEventListener("click", () => goToStep(Number(btn.dataset.step))));


/* ======================================================================
   5. LIVE IDENTITY + RIGHT PANEL SNAPSHOTS
====================================================================== */
function updateIdentityPreview() {
  // Inputs by id (your UI uses ids), but form names are first_name/last_name
  const first = $("#patientFirstName")?.value || "";
  const last = $("#patientLastName")?.value || "";

  const sex = form.querySelector("input[name='sex']:checked")?.value || "—";
  const dob = $("#patientDob")?.value || "";

  const fullName = `${first} ${last}`.trim() || "New Patient";
  const age = calculateAge(dob);

  if (identityName) identityName.textContent = fullName;
  if (identitySub) identitySub.textContent = dob ? `DOB: ${dob}` : "Start typing to generate preview";

  if (miniPatientName) miniPatientName.textContent = fullName;

  // phone normalize + show
  const phoneEl = $("#patientPhone");
  const normalizedPhone = normalizePhone(phoneEl?.value || "");
  if (phoneEl && phoneEl.value !== normalizedPhone) phoneEl.value = normalizedPhone;
  if (miniPatientPhone) miniPatientPhone.textContent = normalizedPhone || "—";

  if (chipAgeVal) chipAgeVal.textContent = age || "—";
  if (chipSexVal) chipSexVal.textContent = sex;

  if (avatarInitials) {
    avatarInitials.textContent = (`${first[0] || ""}${last[0] || ""}`.toUpperCase() || "NP");
  }

  // keep age input synced if you have hidden/readonly age field
  const patientAgeInput = $("#patientAge");
  if (patientAgeInput) patientAgeInput.value = age || "";

  // Booking snapshot
  const data = collectFormData();
  if (snapBookingDate) snapBookingDate.textContent = safeText(data.booking_date);
  if (snapBookingTime) snapBookingTime.textContent = safeText(data.booking_time);
  if (snapServiceType) snapServiceType.textContent = safeText(data.service_type);
  if (snapRegistrationType) snapRegistrationType.textContent = safeText(data.registration_type);
  if (snapDoctor) snapDoctor.textContent = safeText(data.doctor);

  // ✅ Patient Category snapshot (replaces old enrollee_type/no display)
  if (snapEnrollee) {
    const cat = (data.patient_category || "").trim().toLowerCase();
 // private | group | nhis
    const catLabel =
      cat === "private" ? "Private" :
      cat === "group" ? "Group" :
      cat === "nhis" ? "NHIS/Others" :
      safeText(data.patient_category, "—");

    let detail = "";
    if (cat === "group") {
      detail = safeText(data.group_name, "");
    } else if (cat === "nhis") {
      // enrollee_type + number (ministry shown in main preview section)
      detail = [data.enrollee_type, data.enrollee_no].filter(Boolean).join(" • ");
    }

    const text = [catLabel, detail].filter(Boolean).join(" • ");
    snapEnrollee.textContent = safeText(text);
  }

  // Price type mini
  if (miniPriceType) miniPriceType.textContent = getPriceTypeLabel();

  // Completion + flags + checklist
  updateCompletionAndFlags();
}


  function refreshServicesSummary() {
    const services = getSelectedServices();
    const total = computeServicesTotal(services);

    if (miniServicesCount) miniServicesCount.textContent = String(services.length);
    if (miniServicesTotal) miniServicesTotal.textContent = formatNaira(total);
  }

  /* ======================================================================
     6. COMPLETION + FLAGS + CHECKLIST (RIGHT PANEL)
     ✅ Smart: auto-jump to first missing required section
  ====================================================================== */
  function isValidPhone(phone) {
    const p = (phone || "").replace(/\s+/g, "");
    const digits = p.replace(/[^\d]/g, "");
    return digits.length >= 10;
  }

  function getFirstMissingRequiredKey(checks) {
    const requiredOrder = ["name", "dob", "sex", "phone", "ref", "booking", "serviceType", "doctor"];
    return requiredOrder.find((k) => !checks[k]) || null;
  }

  function smartNavigateToMissing(checkKey) {
    // map required check -> step + focus target
    const map = {
      name: { step: 1, focus: "#patientFirstName" },
      dob: { step: 1, focus: "#patientDob" },
      sex: { step: 1, focus: "[name='sex']" },
      phone: { step: 1, focus: "#patientPhone" },
      ref: { step: 2, focus: "[name='referred_by'], #referredBy, #patientReferredBy" },
      booking: { step: 3, focus: "#bookingDate, [name='booking_date']" },
      serviceType: { step: 3, focus: "[name='service_type'], #serviceType" },
      doctor: { step: 3, focus: "[name='doctor'], #doctorSelect" },
    };

    const t = map[checkKey];
    if (!t) return;

    goToStep(t.step);

    const el = $(t.focus);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // some targets are radio groups; focus safely
      try { el.focus?.(); } catch {}
    }
  }

  function updateCompletionAndFlags() {
    const data = collectFormData();

    const checks = {
      name: !!(data.first_name && data.last_name),
      dob: !!data.date_of_birth,
      sex: !!data.sex,
      phone: isValidPhone(data.phone),
      ref: !!data.referred_by,
      booking: !!(data.booking_date && data.booking_time),
      serviceType: !!data.service_type,
      doctor: !!data.doctor,
      services: getSelectedServices().length > 0, // optional
      preview: true, // ✅ always true because we run live preview automatically
    };

    Object.entries(checks).forEach(([k, ok]) => setChecklistDot(k, ok));

    const requiredKeys = ["name", "dob", "sex", "phone", "ref", "booking", "serviceType", "doctor"];
    const done = requiredKeys.filter((k) => checks[k]).length;
    const pct = Math.round((done / requiredKeys.length) * 100);

    if (completionPct) completionPct.textContent = `${pct}%`;
    if (completionFill) completionFill.style.width = `${pct}%`;

    const pb = completionFill?.closest(".completion-bar");
    if (pb) pb.setAttribute("aria-valuenow", String(pct));

    // flags
    const flags = [];

    if (!checks.name) flags.push({ type: "warn", text: "Patient name is incomplete." });

    if (data.date_of_birth) {
      const dob = new Date(data.date_of_birth);
      if (dob > new Date()) flags.push({ type: "warn", text: "DOB cannot be in the future." });
    } else {
      flags.push({ type: "warn", text: "DOB is required." });
    }

    if (!checks.sex) flags.push({ type: "warn", text: "Sex is required." });

    if (!checks.phone) flags.push({ type: "warn", text: "Phone number looks invalid (too short)." });

    if (!checks.ref) flags.push({ type: "warn", text: "Referral is required." });

    if (!data.booking_date || !data.booking_time) {
      flags.push({ type: "warn", text: "Booking date & time are required." });
    } else {
      const dtStr = `${data.booking_date}T${data.booking_time}:00`;
      const dt = new Date(dtStr);
      if (!Number.isNaN(dt.getTime()) && dt.getTime() < Date.now() - 60_000) {
        flags.push({ type: "info", text: "Booking time is in the past. Confirm this is intentional." });
      }
    }

    if (!data.service_type) flags.push({ type: "warn", text: "Service Type is required." });
    if (!data.doctor) flags.push({ type: "warn", text: "Doctor is required." });

    if (!checks.services) flags.push({ type: "ok", text: "No services selected yet (optional)." });

    // render flags
    if (flagsList) {
      flagsList.innerHTML = flags
        .map((f) => {
          const icon =
            f.type === "warn" ? "fa-triangle-exclamation" :
            f.type === "info" ? "fa-circle-info" :
            "fa-circle-check";
          const cls =
            f.type === "warn" ? "is-warn" :
            f.type === "info" ? "is-info" :
            "is-ok";
          return `<li class="flag-item ${cls}"><i class="fa-solid ${icon}"></i> ${f.text}</li>`;
        })
        .join("");
    }

    const hasWarn = flags.some((f) => f.type === "warn");
    if (flagsBadge) {
      flagsBadge.textContent = hasWarn ? "Fix" : "OK";
      flagsBadge.classList.toggle("badge-ok", !hasWarn);
      flagsBadge.classList.toggle("badge-warn", hasWarn);
    }

    // ✅ confirm gate: ONLY required + HTML validity (no preview gate)
    if (btnConfirmSave) {
      const canConfirm = pct === 100 && form.checkValidity();
      btnConfirmSave.disabled = !canConfirm;

      if (!canConfirm) {
        const missing = getFirstMissingRequiredKey(checks);
        btnConfirmSave.title = missing
          ? `Complete: ${missing} (click will guide you)`
          : "Complete required fields";
      } else {
        btnConfirmSave.title = "Ready to save";
      }
    }
  }

  /* ======================================================================
     7. LIVE AUTO PREVIEW (SPACED + SMART)
     ✅ Smart features included:
     (1) Preview appears only after meaningful input
     (2) Debounced rendering (no lag while typing)
     (3) No-op diff: avoids DOM rewrite if unchanged
     (4) Auto-warning chips (age, phone, booking past)
     (5) Service total live + breakdown always correct
     (6) Optional: highlights missing fields in preview
  ====================================================================== */

  function renderPreviewPlaceholder() {
    if (!previewContainer) return;
    previewContainer.innerHTML = `
      <div class="review-placeholder">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>No preview yet</strong>
          <p>Start typing to generate a clean summary automatically.</p>
        </div>
      </div>
    `;
  }

function buildPreview() {
  if (!previewContainer) return;

  const data = collectFormData();

  // only show preview after meaningful input
  const meaningful = detectMeaningfulInput(data);
  if (!meaningful) {
    hasMeaningfulInput = false;
    lastPreviewHash = "";
    setPreviewBadge("hidden");
    renderPreviewPlaceholder();
    return;
  }

  hasMeaningfulInput = true;

  // cart + totals
  const services = getSelectedServices();
  const total = computeServicesTotal(services);

  refreshServicesSummary();
  if (miniPriceType) miniPriceType.textContent = getPriceTypeLabel();

  // ✅ Patient Category normalize
  const cat = (data.patient_category || "").trim().toLowerCase();
 // private|group|nhis
  const catLabel =
    cat === "private" ? "Private" :
    cat === "group" ? "Group" :
    cat === "nhis" ? "NHIS/Others" :
    safeText(data.patient_category, "—");

  // warnings (smart)
  const warns = [];
  const age = Number(data.age || 0);

  if (data.date_of_birth) {
    const dob = new Date(data.date_of_birth);
    if (dob > new Date()) warns.push("DOB is in the future");
  }
  if (Number.isFinite(age) && age > 120) warns.push("Age seems too high");
  if (data.phone && !isValidPhone(data.phone)) warns.push("Phone looks short");

  if (data.booking_date && data.booking_time) {
    const dtStr = `${data.booking_date}T${data.booking_time}:00`;
    const dt = new Date(dtStr);
    if (!Number.isNaN(dt.getTime()) && dt.getTime() < Date.now() - 60_000) {
      warns.push("Booking time is in the past");
    }
  }

  // ✅ category-specific warnings
  if (cat === "group" && !String(data.group_name || "").trim()) {
    warns.push("Group is selected but no Group Name chosen");
  }
  if (cat === "nhis") {
    if (!String(data.enrollee_type || "").trim()) warns.push("NHIS selected but Enrollee Type is missing");
    if (!String(data.enrollee_no || "").trim()) warns.push("NHIS selected but Enrollee Number is missing");
  }

  // services HTML
  const serviceListHTML = services.length
    ? `
      <ul class="pv-list">
        ${services.map((s) => {
          const nm = safeText(s?.name, "Service");
          const amt = safeText(s?.amountLabel, formatNaira(s?.amountNumber || s?.amount || s?.price || 0));
          const ty = safeText(s?.type, "");
          return `
            <li>
              <span class="pv-li-name">${nm}${ty ? ` <span class="pv-chip" style="margin-left:.45rem">${ty}</span>` : ""}</span>
              <span class="pv-li-amt">${amt}</span>
            </li>
          `;
        }).join("")}
      </ul>
    `
    : `<p class="pv-muted">No services selected.</p>`;

  // avoid DOM rewrite if unchanged
  const nextHash = hashPreview(data, services, total);
  if (nextHash === lastPreviewHash) {
    setPreviewBadge("live");
    return;
  }
  lastPreviewHash = nextHash;

  // helpful “missing” markers inside preview (smart)
  const missingClass = (v) => (String(v || "").trim() ? "" : `style="opacity:.7"`);
  const missingBadge = (v) => (String(v || "").trim() ? "" : `<span class="pv-chip" style="margin-left:.5rem">missing</span>`);
  const hasFullName = !!((data.first_name || "").trim() && (data.last_name || "").trim());



  const warnHTML = warns.length
    ? `
      <div class="pv-warn">
        <div class="pv-h pv-h--split">
          <span>Notes</span>
          <span class="pv-chip">${warns.length}</span>
        </div>
        <ul class="pv-list">
          ${warns.map((w) => `<li><span class="pv-li-name">${safeText(w)}</span></li>`).join("")}
        </ul>
      </div>
    `
    : "";

  // ✅ category details (shown only when relevant)
  const groupRowHTML = (cat === "group")
    ? `<div class="pv-row"><span class="pv-k">Group Name</span><span class="pv-v" ${missingClass(data.group_name)}>${safeText(data.group_name)}${missingBadge(data.group_name)}</span></div>`
    : "";

  const nhisRowsHTML = (cat === "nhis")
    ? `
      <div class="pv-row"><span class="pv-k">Enrollee Type</span><span class="pv-v" ${missingClass(data.enrollee_type)}>${safeText(data.enrollee_type)}${missingBadge(data.enrollee_type)}</span></div>
      <div class="pv-row"><span class="pv-k">Ministry</span><span class="pv-v" ${missingClass(data.enrollee_ministry)}>${safeText(data.enrollee_ministry)}${missingBadge(data.enrollee_ministry)}</span></div>
      <div class="pv-row"><span class="pv-k">Enrollee No</span><span class="pv-v" ${missingClass(data.enrollee_no)}>${safeText(data.enrollee_no)}${missingBadge(data.enrollee_no)}</span></div>
    `
    : "";

  previewContainer.innerHTML = `
    ${warnHTML}

    <section class="pv-section">
      <h4 class="pv-h">Patient</h4>
      <div class="pv-grid">
        <div class="pv-row"><span class="pv-k">Name</span><span class="pv-v"><strong>${safeText(`${data.first_name || ""} ${data.last_name || ""}`.trim(), "—")}</strong>${hasFullName ? "" : `<span class="pv-chip" style="margin-left:.5rem">missing</span>`}</span></div>
        <div class="pv-row"><span class="pv-k">Sex</span><span class="pv-v" ${missingClass(data.sex)}>${safeText(data.sex)}${missingBadge(data.sex)}</span></div>
        <div class="pv-row"><span class="pv-k">Age</span><span class="pv-v">${safeText(data.age)} yrs</span></div>
        <div class="pv-row"><span class="pv-k">Phone</span><span class="pv-v" ${missingClass(data.phone)}>${safeText(data.phone)}${missingBadge(data.phone)}</span></div>
        <div class="pv-row"><span class="pv-k">Referral</span><span class="pv-v" ${missingClass(data.referred_by)}>${safeText(data.referred_by)}${missingBadge(data.referred_by)}</span></div>
      </div>
    </section>

    <section class="pv-section">
      <h4 class="pv-h">Booking & Service</h4>
      <div class="pv-grid">
        <div class="pv-row"><span class="pv-k">Date</span><span class="pv-v" ${missingClass(data.booking_date)}>${safeText(data.booking_date)}${missingBadge(data.booking_date)}</span></div>
        <div class="pv-row"><span class="pv-k">Time</span><span class="pv-v" ${missingClass(data.booking_time)}>${safeText(data.booking_time)}${missingBadge(data.booking_time)}</span></div>
        <div class="pv-row"><span class="pv-k">Service Type</span><span class="pv-v" ${missingClass(data.service_type)}>${safeText(data.service_type)}${missingBadge(data.service_type)}</span></div>
        <div class="pv-row"><span class="pv-k">Registration Type</span><span class="pv-v">${safeText(data.registration_type)}</span></div>
        <div class="pv-row"><span class="pv-k">Doctor</span><span class="pv-v" ${missingClass(data.doctor)}>${safeText(data.doctor)}${missingBadge(data.doctor)}</span></div>

        <!-- ✅ Patient Category -->
        <div class="pv-row"><span class="pv-k">Patient Category</span><span class="pv-v" ${missingClass(data.patient_category)}>${safeText(catLabel)}${missingBadge(data.patient_category)}</span></div>

        ${groupRowHTML}
        ${nhisRowsHTML}

        <div class="pv-row"><span class="pv-k">Price Type</span><span class="pv-v">${safeText(getPriceTypeLabel())}</span></div>
      </div>
    </section>

    <section class="pv-section">
      <div class="pv-h pv-h--split">
        <span>Services</span>
        <span class="pv-chip">${services.length} item(s)</span>
      </div>
      ${serviceListHTML}
      <div class="pv-total">
        <span>Total</span>
        <strong>${formatNaira(total)}</strong>
      </div>
    </section>
  `;

  setPreviewBadge("live");
  setLive("Live preview updated.");
}


  function scheduleLivePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      buildPreview();
    }, 140);
  }

  /* ======================================================================
     5B. EVENTS — LIVE UPDATES + SERVICES SYNC
     ✅ Smart features:
     - auto preview on typing
     - auto preview when cart changes (clicks / remove / clear)
     - auto preview on priceType change
  ====================================================================== */
  form.addEventListener("input", () => {
    markEdited();
    updateIdentityPreview();
    refreshServicesSummary();

    // mark meaningful on first real interaction
    const data = collectFormData();
    if (!hasMeaningfulInput && detectMeaningfulInput(data)) {
      hasMeaningfulInput = true;
      setLive("Preview unlocked.");
    }

    scheduleLivePreview();
  });

  form.addEventListener("change", () => {
    markEdited();
    updateIdentityPreview();
    refreshServicesSummary();
    scheduleLivePreview();
  });

  // Specific DOB listener to ensure age is calculated immediately
  const dobInput = $("#patientDob");
  if (dobInput) {
    dobInput.addEventListener("change", () => {
      const dob = dobInput.value;
      const ageInput = $("#patientAge");
      if (ageInput && dob) {
        const age = calculateAge(dob);
        ageInput.value = age !== "" ? age : "";
      }
    });
  }

  // cart-related clicks (add/remove/toggle/clear) should refresh preview
  document.addEventListener("click", (e) => {
    if (e.target.closest("#servicesCartBtn") || e.target.closest("#servicesResults") || e.target.closest("#servicesCart")) {
      refreshServicesSummary();
      updateCompletionAndFlags();
      scheduleLivePreview();
    }
  });

  // ✅ Smart: if your services engine changes DOM without clicks, watch cart list
  const cartListEl = $("#servicesCartList");
  if (cartListEl && "MutationObserver" in window) {
    const mo = new MutationObserver(() => {
      refreshServicesSummary();
      updateCompletionAndFlags();
      scheduleLivePreview();
    });
    mo.observe(cartListEl, { childList: true, subtree: true });
  }

  // ✅ Smart: priceType toggles should update totals and preview
  $$('input[name="priceType"]').forEach((r) => {
    r.addEventListener("change", () => {
      markEdited();
      refreshServicesSummary();
      updateIdentityPreview();
      scheduleLivePreview();
    });
  });

  /* ======================================================================
     8. PRINT / EXPORT
  ====================================================================== */
  function printPreview() {
    if (!previewContainer) return;

    // ensure preview exists if user tries print early
    buildPreview();

    const html = previewContainer.innerHTML;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return alert("Popup blocked. Please allow popups to print.");

    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>Patient Preview</title>
          <meta charset="utf-8"/>
          <style>
            body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px;}
            h4{margin:18px 0 10px;}
            .pv-row{display:flex; gap:12px; padding:6px 0;}
            .pv-k{min-width:140px; opacity:.75}
            .pv-total{display:flex; justify-content:space-between; padding-top:12px; margin-top:12px; border-top:1px solid #ddd;}
            ul{padding-left:18px;}
            li{margin:6px 0;}
          </style>
        </head>
        <body>
          <h2>Registration Preview</h2>
          ${html}
          <script>window.print();<\/script>
        </body>
      </html>
    `);
    w.document.close();
  }

  function exportPreview() {
    buildPreview();

    const data = {
      form: collectFormData(),
      services: getSelectedServices(),
      total: computeServicesTotal(getSelectedServices()),
      price_type: getPriceTypeLabel(),
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    const name = `${(data.form.first_name || "patient")}_${(data.form.last_name || "export")}`.replace(/\s+/g, "_");
    a.download = `${name}_preview.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    setLastAction("Exported preview");
  }

  btnPrintPreview?.addEventListener("click", printPreview);
  btnExportPreview?.addEventListener("click", exportPreview);

  /* ======================================================================
     9. DRAFT (LOCAL STORAGE)
     ✅ Smart: lightweight auto-draft (every ~4s idle) when dirty
  ====================================================================== */
  function saveDraft() {
    const payload = {
      form: collectFormData(),
      services: getSelectedServices(),
      priceType: form.querySelector("input[name='priceType']:checked")?.value || "walkin",
      timestamp: Date.now(),
    };

    localStorage.setItem("patientsDraft", JSON.stringify(payload));
    isDraftSaved = true;
    dirtySinceLastSave = false;

    setAutosaveUI("Saved", true);
    setLastAction("Draft saved");
    setLive("Draft saved.");
  }

  function loadDraft() {
  const raw = localStorage.getItem("patientsDraft");
  if (!raw) return;

  try {
    const payload = JSON.parse(raw);
    const f = payload.form || {};

    // restore inputs by name
    Object.keys(f).forEach((name) => {
      const field = form.elements[name];
      if (!field) return;

      // Radio groups
      if (field instanceof RadioNodeList) {
        const target = form.querySelector(
          `[name="${CSS.escape(name)}"][value="${CSS.escape(f[name])}"]`
        );
        if (target) target.checked = true;
        return;
      }

      // Checkbox
      if (field.type === "checkbox") {
        field.checked = !!f[name];
        return;
      }

      // Normal inputs/selects/textareas
      field.value = f[name];
    });

    // restore services CART (best effort)
    if (Array.isArray(payload.services)) {
      window.CART = payload.services;
    }

    // restore priceType
    const pt = payload.priceType || "walkin";
    const pr = form.querySelector(`input[name="priceType"][value="${pt}"]`);
    if (pr) pr.checked = true;

    // ✅ Re-apply category UI (panels/required/locks) after values are restored
    restoreCategoryUIFromHidden();

    isDraftSaved = true;
    dirtySinceLastSave = false;

    setAutosaveUI("Loaded", true);
    setLastAction("Draft loaded");
    setLive("Draft loaded.");

    // ✅ refresh UI
    refreshServicesSummary();
    updateIdentityPreview();
    scheduleLivePreview();

  } catch (e) {
    console.warn("Failed to load draft:", e);
    localStorage.removeItem("patientsDraft");
    setAutosaveUI("Not saved", false);
  }
}


  btnSaveDraft?.addEventListener("click", saveDraft);
  btnSaveDraftTop?.addEventListener("click", saveDraft);

  // ✅ Smart: auto draft-save on idle (only when dirty)
  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (dirtySinceLastSave) saveDraft();
    }, 4000);
  }
  form.addEventListener("input", scheduleAutosave);
  form.addEventListener("change", scheduleAutosave);

  /* ======================================================================
     10. CLEAR FORM / CLEAR BOOKING META
  ====================================================================== */
function clearBookingMetaOnly() {
  const names = [
    "booking_date",
    "booking_time",
    "service_type",
    "registration_type",
    "doctor",

    // NHIS fields (these are booking-related)
    "enrollee_type",
    "enrollee_ministry",
    "enrollee_no",
  ];

  names.forEach((n) => {
    const el = form.elements[n];
    if (!el) return;

    if (el instanceof RadioNodeList) return;

    if (el.type === "checkbox") {
      el.checked = false;
      return;
    }

    el.value = "";
  });

  // ✅ clear category UI properly (also clears hidden input + group name)
  clearCategorySelection();

  setLastAction("Booking cleared");
  setLive("Booking fields cleared.");
  markEdited();
  updateIdentityPreview();
  scheduleLivePreview();
}


  btnClearBookingMetaBtns.forEach((b) => b.addEventListener("click", clearBookingMetaOnly));

   /* ======================================================================
      FULL RESET FORM 
  ====================================================================== */

  function resetForm() {
    form.reset();
    // ✅ Reset category UI cleanly
    clearCategorySelection();

    localStorage.removeItem("patientsDraft");

    currentStep = 1;
    isDraftSaved = false;
    dirtySinceLastSave = false;

    goToStep(1);

    // clear cart (best effort)
    if (Array.isArray(window.CART)) window.CART = [];

    // reset preview state
    hasMeaningfulInput = false;
    lastPreviewHash = "";
    setPreviewBadge("hidden");
    renderPreviewPlaceholder();

    refreshServicesSummary();
    updateIdentityPreview();
    updateCompletionAndFlags();

    setAutosaveUI("Not saved", false);
    setLastAction("Form cleared");
    setLive("Form cleared.");
  }

  btnClearForm?.addEventListener("click", resetForm);
  btnNewRegistration?.addEventListener("click", resetForm);

  /* ======================================================================
     11. QUICK NAV / FOCUS
  ====================================================================== */
  btnScrollToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  btnFocusBooking?.addEventListener("click", () => {
    goToStep(3);
    const bookingDate = $("#bookingDate") || $("[name='booking_date']");
    bookingDate?.scrollIntoView({ behavior: "smooth", block: "start" });
    try { bookingDate?.focus?.(); } catch {}
  });

  btnFocusServices?.addEventListener("click", () => {
    goToStep(3);
    const sec = $("#servicesSection");
    sec?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#servicesSearchInput")?.focus?.();
  });

  btnJumpToServices?.addEventListener("click", () => {
    goToStep(3);
    $("#servicesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#servicesSearchInput")?.focus?.();
  });

  btnUseCurrentTime?.addEventListener("click", () => {
    const t = $("#bookingTime") || $("[name='booking_time']");
    if (!t) return;
    t.value = nowLocalTimeHHMM();
    markEdited();
    updateIdentityPreview();
    scheduleLivePreview();
    setLive("Booking time set to now.");
  });

  /* ======================================================================
     12. CONFIRM & SAVE (SUPABASE)
     ✅ Smart: if missing required, auto guide user to missing field
  ====================================================================== */
  async function submitPatient() {
    // HTML5 validation
    if (!form.checkValidity()) {
      form.reportValidity();
      updateCompletionAndFlags();
      setLive("Fix required fields.");

      // smart jump to first missing required
      const data = collectFormData();
      const checks = {
        name: !!(data.first_name && data.last_name),
        dob: !!data.date_of_birth,
        sex: !!data.sex,
        phone: isValidPhone(data.phone),
        ref: !!data.referred_by,
        booking: !!(data.booking_date && data.booking_time),
        serviceType: !!data.service_type,
        doctor: !!data.doctor,
      };
      const missing = getFirstMissingRequiredKey(checks);
      if (missing) smartNavigateToMissing(missing);

      return;
    }

    // ensure preview is built once before submit (for clean save)
    buildPreview();

    const payload = {
      ...collectFormData(),
      services: getSelectedServices(),
      price_type: form.querySelector("input[name='priceType']:checked")?.value || "walkin",
    };

    const originalBtnHtml = btnConfirmSave?.innerHTML || "Confirm";
    if (btnConfirmSave) {
      btnConfirmSave.disabled = true;
      btnConfirmSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    }

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to save patient.");
      }

      const patient = result.patient || {};
      const fullName = `${patient.first_name || payload.first_name || ""} ${patient.last_name || payload.last_name || ""}`.trim();

      resetForm();

      alert(
        `✓ Patient "${fullName || "Patient"}" registered successfully!\n\nPatient ID: ${patient.patient_id || "—"}\nFile No: ${patient.file_no || "—"}`
      );

      setLastAction("Saved to Supabase");
      setLive("Patient saved to Supabase.");
      setAutosaveUI("Saved", true);

    } catch (err) {
      console.error("Register patient failed:", err);
      alert(err.message || "Failed to save patient.");
      setLastAction("Save failed");
      setLive("Save failed. Check connection / server logs.");
    } finally {
      if (btnConfirmSave) {
        btnConfirmSave.innerHTML = originalBtnHtml;
        btnConfirmSave.disabled = false;
      }
      updateCompletionAndFlags();
    }
  }

  btnConfirmSave?.addEventListener("click", submitPatient);

  /* ======================================================================
     13. KEYBOARD SHORTCUTS
     ✅ Smart: Ctrl+S save draft, Ctrl+Enter confirm if ready, Esc reset
  ====================================================================== */
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      saveDraft();
    }

    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      // if confirm button is enabled, submit; else guide user
      if (btnConfirmSave && !btnConfirmSave.disabled) {
        submitPatient();
      } else {
        updateCompletionAndFlags();
        setLive("Complete required fields to confirm.");
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      resetForm();
    }
  });

  /* ======================================================================
     14. CONNECTIVITY
     ✅ Smart: show offline warning in live region
  ====================================================================== */
  window.addEventListener("online", () => {
    setConnectionUI();
    setLive("Back online.");
  });

  window.addEventListener("offline", () => {
    setConnectionUI();
    setLive("You are offline. Draft can still be saved locally.");
  });

  // ✅ Smart: warn before leaving page if dirty
  window.addEventListener("beforeunload", (e) => {
    if (!dirtySinceLastSave) return;
    e.preventDefault();
    e.returnValue = "";
  });

  /* ======================================================================
     15. INIT
  ====================================================================== */
setConnectionUI();
wireCategoryEvents();
loadDraft();
goToStep(1);



  // Smart default booking date/time if empty (non-destructive)
  const bd = $("[name='booking_date']") || $("#bookingDate");
  const bt = $("[name='booking_time']") || $("#bookingTime");
  if (bd && !bd.value) bd.value = nowLocalDateYYYYMMDD();
  if (bt && !bt.value) bt.value = nowLocalTimeHHMM();

  refreshServicesSummary();
  updateIdentityPreview();

  setAutosaveUI(isDraftSaved ? "Loaded" : "Not saved", isDraftSaved);

  // ✅ Completion always updates
  updateCompletionAndFlags();

  // ✅ Preview: only show placeholder if truly empty
  const initData = collectFormData();
  const initMeaningful = detectMeaningfulInput(initData);

  if (!initMeaningful) {
    hasMeaningfulInput = false;
    lastPreviewHash = "";
    setPreviewBadge("hidden");
    renderPreviewPlaceholder();
  } else {
    hasMeaningfulInput = true;
    // build once (debounced) so UI is correct after draft load
    scheduleLivePreview();
  }

})();

