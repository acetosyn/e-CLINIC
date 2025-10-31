/* ============================================================
   EPICONSULT e-CLINIC — CUSTOMER CARE (NEW PATIENT MODULE)
   Modern Reactive Edition — 2025
   Features:
   ▪ Floating-label form sync
   ▪ Animated summary preview
   ▪ Auto age calculation
   ▪ Live activity & stat updates
   ▪ Supabase-ready structure
   Architect: GPT-5
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  console.log("🧾 Customer Care — New Patient module active (Modern Edition)");

  /* ------------------------------------------------------------
     ELEMENT REFERENCES
  ------------------------------------------------------------ */
  const form = document.getElementById("newPatientForm");
  const summary = document.getElementById("liveSummary");
  const fileNoEl = document.getElementById("fileNo");
  const patientIdEl = document.getElementById("patientId");
  const dobEl = document.getElementById("dob");
  const ageEl = document.getElementById("age");
  const notesEl = document.querySelector("textarea[name='notes']");
  const saveBtn = form?.querySelector(".cc-btn.primary");

  if (!form) return console.warn("⚠️ New Patient form not found.");

  /* ------------------------------------------------------------
     INTERNAL COUNTERS + UTILITIES
  ------------------------------------------------------------ */
  let fileCounter = 1;

  const generateFileNo = () => `F-${String(fileCounter++).padStart(3, "0")}`;
  const generatePatientID = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `EPN-${new Date().getFullYear()}-${rand}`;
  };

  const getTodayISO = () => new Date().toISOString();
  const toDisplayDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  /* ------------------------------------------------------------
     AUTO-EXPAND TEXTAREA
  ------------------------------------------------------------ */
  if (notesEl) {
    notesEl.addEventListener("input", () => {
      notesEl.style.height = "auto";
      notesEl.style.height = `${notesEl.scrollHeight}px`;
    });
  }

  /* ------------------------------------------------------------
     AGE CALCULATION
  ------------------------------------------------------------ */
  dobEl?.addEventListener("change", () => {
    if (!dobEl.value) {
      ageEl.value = "";
      return;
    }
    const birth = new Date(dobEl.value);
    const diff = Date.now() - birth.getTime();
    const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    ageEl.value = age;
  });

  /* ------------------------------------------------------------
     SMOOTH FIELD VALIDATION EFFECT
  ------------------------------------------------------------ */
  const highlightInvalidFields = () => {
    form.querySelectorAll("input[required], select[required]").forEach((field) => {
      if (!field.value.trim()) {
        field.classList.add("invalid-field");
        setTimeout(() => field.classList.remove("invalid-field"), 900);
      }
    });
  };

  /* ------------------------------------------------------------
     SUMMARY UPDATER
  ------------------------------------------------------------ */
  const updateSummary = (data) => {
    if (!summary) return;
    summary.classList.add("updating");
    summary.innerHTML = `
      <h4><i class="fa-solid fa-user"></i> Patient Summary</h4>
      <p><strong>Date Registered:</strong> ${toDisplayDate(data.dateRegistered)}</p>
      <p><strong>File No:</strong> ${data.fileNo}</p>
      <p><strong>Patient ID:</strong> ${data.patientId}</p>
      <p><strong>Name:</strong> ${data.fullName}</p>
      <p><strong>Age:</strong> ${data.age || "—"}</p>
      <p><strong>Gender:</strong> ${data.gender || "—"}</p>
      <p><strong>Service:</strong> ${data.service || "—"}</p>
      <p><strong>Delivery Mode:</strong> ${data.deliveryMode || "—"}</p>
      <p><strong>Next of Kin:</strong> ${data.nokName || "—"} (${data.nokPhone || "—"})</p>
      <hr>
      <small><i class="fa-regular fa-clock"></i> Record created at ${new Date().toLocaleTimeString()}</small>
    `;
    setTimeout(() => summary.classList.remove("updating"), 400);
  };

  /* ------------------------------------------------------------
     FORM SUBMISSION HANDLER
  ------------------------------------------------------------ */
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Validate essential fields
    const requiredFilled = Array.from(form.querySelectorAll("[required]")).every(
      (el) => el.value.trim()
    );
    if (!requiredFilled) {
      highlightInvalidFields();
      if (typeof window.showToast === "function")
        showToast("⚠️ Please complete all required fields.", "error");
      return;
    }

    // Auto-generate IDs if missing
    if (!fileNoEl.value) fileNoEl.value = generateFileNo();
    if (!patientIdEl.value) patientIdEl.value = generatePatientID();

    const formData = Object.fromEntries(new FormData(form).entries());
    formData.fileNo = fileNoEl.value;
    formData.patientId = patientIdEl.value;
    formData.dateRegistered = getTodayISO();

    // Update live summary
    updateSummary(formData);

    // Increment stat counters if global state exists
    if (window.ccState && window.ccState.stats) {
      window.ccState.stats.newPatients =
        (window.ccState.stats.newPatients || 0) + 1;
      const el = document.getElementById("statPatients");
      if (el) el.textContent = window.ccState.stats.newPatients;
    }

    // Add to live activity
    if (typeof window.addActivity === "function") {
      addActivity(
        "🆕 New Patient Registered",
        `${formData.fullName} (${formData.patientId}) — ${formData.service}`,
        "fa-user-check"
      );
    }

    // Success feedback
    if (typeof window.showToast === "function") {
      showToast("✅ New patient record saved successfully!", "success");
    }

    // Visual feedback (button glow)
    if (saveBtn) {
      saveBtn.classList.add("saved");
      setTimeout(() => saveBtn.classList.remove("saved"), 1200);
    }

    // Scroll to summary section
    summary?.scrollIntoView({ behavior: "smooth", block: "center" });

    // Reset form but keep counter continuity
    setTimeout(() => {
      form.reset();
      fileNoEl.value = generateFileNo();
      patientIdEl.value = generatePatientID();
    }, 500);
  });

  /* ------------------------------------------------------------
     RESET HANDLER
  ------------------------------------------------------------ */
  form.addEventListener("reset", () => {
    if (summary) {
      summary.classList.add("fading");
      summary.innerHTML = `<p class="muted">Patient summary will appear here after registration.</p>`;
      setTimeout(() => summary.classList.remove("fading"), 500);
    }
  });

  /* ------------------------------------------------------------
     INITIALIZATION
  ------------------------------------------------------------ */
  fileNoEl.value = generateFileNo();
  patientIdEl.value = generatePatientID();

  if (summary)
    summary.innerHTML = `<p class="muted">Patient summary will appear here after registration.</p>`;

  console.log("✅ New Patient JS initialized — IDs ready and reactive.");
});
