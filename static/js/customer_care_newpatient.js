/* ============================================================
   EPICONSULT e-CLINIC — CUSTOMER CARE (NEW PATIENT MODULE)
   Version: 2025 Dynamic Edition
   Features:
   ▪ Smart ID generation
   ▪ Auto Age calculation
   ▪ Live summary preview
   ▪ Activity + Stat integration
   ▪ Modular-ready for Supabase
   Architect: GPT-5
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  console.log("🧾 Customer Care — New Patient module active");

  /* ------------------------------------------------------------
     ELEMENT REFERENCES
  ------------------------------------------------------------ */
  const form = document.getElementById("newPatientForm");
  const summary = document.getElementById("liveSummary");
  const fileNoEl = document.getElementById("fileNo");
  const patientIdEl = document.getElementById("patientId");
  const dobEl = document.getElementById("dob");
  const ageEl = document.getElementById("age");

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
     SUMMARY UPDATER
  ------------------------------------------------------------ */
  const updateSummary = (data) => {
    if (!summary) return;
    summary.innerHTML = `
      <h4><i class="fa-solid fa-user"></i> Patient Summary</h4>
      <p><strong>Date Registered:</strong> ${toDisplayDate(data.dateRegistered)}</p>
      <p><strong>File No:</strong> ${data.fileNo}</p>
      <p><strong>Patient ID:</strong> ${data.patientId}</p>
      <p><strong>Full Name:</strong> ${data.fullName}</p>
      <p><strong>Age:</strong> ${data.age || "—"}</p>
      <p><strong>Gender:</strong> ${data.gender || "—"}</p>
      <p><strong>Service:</strong> ${data.service || "—"}</p>
      <p><strong>Delivery Mode:</strong> ${data.deliveryMode || "—"}</p>
      <p><strong>Next of Kin:</strong> ${data.nokName || "—"} (${data.nokPhone || "—"})</p>
      <hr>
      <p><small>Record created <strong>${new Date().toLocaleString()}</strong></small></p>
    `;
  };

  /* ------------------------------------------------------------
     FORM SUBMISSION HANDLER
  ------------------------------------------------------------ */
  form.addEventListener("submit", (e) => {
    e.preventDefault();

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

    // Add activity record
    if (typeof window.addActivity === "function") {
      addActivity(
        "New Patient Registered",
        `${formData.fullName} (${formData.patientId})`,
        "fa-user-check"
      );
    }

    // Show toast
    if (typeof window.showToast === "function") {
      showToast("✅ New patient record saved successfully!", "success");
    }

    // Reset form (but retain live counter continuity)
    form.reset();
    fileNoEl.value = generateFileNo();
    patientIdEl.value = generatePatientID();
  });

  /* ------------------------------------------------------------
     RESET HANDLER
  ------------------------------------------------------------ */
  form.addEventListener("reset", () => {
    if (summary)
      summary.innerHTML = `<p class="muted">Patient summary will appear here after registration.</p>`;
  });

  /* ------------------------------------------------------------
     INITIALIZATION
  ------------------------------------------------------------ */
  fileNoEl.value = generateFileNo();
  patientIdEl.value = generatePatientID();
  if (summary)
    summary.innerHTML = `<p class="muted">Patient summary will appear here after registration.</p>`;

  console.log("✅ New Patient JS ready — IDs preloaded and reactive.");
});
