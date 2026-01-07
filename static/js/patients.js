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
  const snapEnrollee = $("#snapEnrollee");

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

  // ✅ Smart: determine “meaningful input”
  function detectMeaningfulInput(data) {
    const hasName = !!((data.first_name || "").trim() || (data.last_name || "").trim());
    const hasPhone = !!((data.phone || "").trim());
    const hasDob = !!((data.date_of_birth || "").trim());
    const hasSex = !!((data.sex || "").trim());
    const hasBooking = !!((data.booking_date || "").trim() || (data.booking_time || "").trim());
    const hasService = !!((data.service_type || "").trim() || (data.doctor || "").trim());
    const hasServices = getSelectedServices().length > 0;

    return hasName || hasPhone || hasDob || hasSex || hasBooking || hasService || hasServices;
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
        enrollee_type: data.enrollee_type || "",
        enrollee_no: data.enrollee_no || "",
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
    if (snapEnrollee) {
      const enrollee = [data.enrollee_type, data.enrollee_no].filter(Boolean).join(" • ");
      snapEnrollee.textContent = safeText(enrollee);
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

    const enrollee = [data.enrollee_type, data.enrollee_no].filter(Boolean).join(" • ");

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

    previewContainer.innerHTML = `
      ${warnHTML}

      <section class="pv-section">
        <h4 class="pv-h">Patient</h4>
        <div class="pv-grid">
          <div class="pv-row"><span class="pv-k">Name</span><span class="pv-v"><strong>${safeText(`${data.first_name || ""} ${data.last_name || ""}`.trim(), "—")}</strong>${missingBadge((data.first_name || "").trim() && (data.last_name || "").trim())}</span></div>
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
          <div class="pv-row"><span class="pv-k">Enrollee</span><span class="pv-v">${safeText(enrollee)}</span></div>
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

        if (field instanceof RadioNodeList) {
          const target = form.querySelector(`[name="${CSS.escape(name)}"][value="${CSS.escape(f[name])}"]`);
          if (target) target.checked = true;
        } else if (field.type === "checkbox") {
          field.checked = !!f[name];
        } else {
          field.value = f[name];
        }
      });

      // restore services CART (best effort)
      if (Array.isArray(payload.services)) {
        window.CART = payload.services;
      }

      // restore priceType
      const pt = payload.priceType || "walkin";
      const pr = form.querySelector(`input[name="priceType"][value="${pt}"]`);
      if (pr) pr.checked = true;

      isDraftSaved = true;
      dirtySinceLastSave = false;

      setAutosaveUI("Loaded", true);
      setLastAction("Draft loaded");
      setLive("Draft loaded.");

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
      "enrollee_type",
      "enrollee_ministry",
      "enrollee_no",
    ];
    names.forEach((n) => {
      const el = form.elements[n];
      if (!el) return;
      if (el instanceof RadioNodeList) return;
      el.value = "";
    });

    setLastAction("Booking cleared");
    setLive("Booking fields cleared.");
    markEdited();
    updateIdentityPreview();
    scheduleLivePreview();
  }

  btnClearBookingMetaBtns.forEach((b) => b.addEventListener("click", clearBookingMetaOnly));

  function resetForm() {
    form.reset();
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

  // preview starts hidden until user types
  setPreviewBadge("hidden");
  renderPreviewPlaceholder();
  updateCompletionAndFlags();

  // In case draft already has data, build preview
  scheduleLivePreview();

})();
