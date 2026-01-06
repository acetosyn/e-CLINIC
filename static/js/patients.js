/* ==========================================================================
   EPICONSULT e-CLINIC — NEW PATIENT REGISTRATION ENGINE
   Full Page Workflow (patients.html)
   Supabase Write • Wizard • Preview • Services Integration
   Scope: patients.html ONLY
========================================================================== */

(() => {
  "use strict";

  /* ======================================================================
     1. CORE SELECTORS
  ====================================================================== */
  const form = document.getElementById("patientRegistrationForm");

  const stepButtons = document.querySelectorAll(".step-pill");
  const stepPanels = document.querySelectorAll("[data-step-panel]");

  const btnNext = document.getElementById("btnNextStep");
  const btnPrev = document.getElementById("btnPrevStep");

  const btnSaveDraft = document.getElementById("btnSaveDraft");
  const btnSaveDraftTop = document.getElementById("btnSaveDraftTop");
  const btnClearForm = document.getElementById("btnClearFormTop");

  const btnPreview = document.getElementById("btnPreviewPatient");
  const btnConfirmSave = document.getElementById("btnConfirmSave");

  const previewContainer = document.getElementById("patientPreviewContent");

  /* Identity preview */
  const avatarInitials = document.getElementById("patientAvatarInitials");
  const identityName = document.getElementById("patientIdentityName");
  const identitySub = document.getElementById("patientIdentitySub");

  const chipAgeVal = document.getElementById("chipAgeVal");
  const chipSexVal = document.getElementById("chipSexVal");

  /* Mini summary */
  const miniPatientName = document.getElementById("miniPatientName");
  const miniPatientPhone = document.getElementById("miniPatientPhone");
  const miniServicesCount = document.getElementById("miniServicesCount");
  const miniServicesTotal = document.getElementById("miniServicesTotal");

  /* ======================================================================
     2. STATE
  ====================================================================== */
  let currentStep = 1;
  const TOTAL_STEPS = 4;

  let hasPreview = false;
  let isDraftSaved = false;

  /* ======================================================================
     3. UTILITIES
  ====================================================================== */

  /* ======================================================================
     CALCULATE AGE FROM DOB
  ====================================================================== */
  function calculateAge(dob) {
    if (!dob) return "";
    const birth = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : "";
  }

  /* ======================================================================
     GET FORM DATA AS OBJECT
  ====================================================================== */
  function collectFormData() {
    const fd = new FormData(form);
    const data = {};
    fd.forEach((v, k) => (data[k] = v));
    return data;
  }

  /* ======================================================================
     GET SELECTED SERVICES FROM services_register.js
     (Relies on global CART)
  ====================================================================== */
  function getSelectedServices() {
    if (!window.CART || !Array.isArray(window.CART)) return [];
    return window.CART;
  }

  /* ======================================================================
     COMPUTE SERVICES TOTAL
  ====================================================================== */
  function computeServicesTotal(services) {
    return services.reduce((sum, s) => sum + (s.amountNumber || 0), 0);
  }

  /* ======================================================================
     4. WIZARD CONTROL
  ====================================================================== */

  /* ======================================================================
     GO TO STEP
  ====================================================================== */
  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;

    currentStep = step;

    stepPanels.forEach(p => {
      p.classList.toggle(
        "hidden",
        Number(p.dataset.stepPanel) !== step
      );
    });

    stepButtons.forEach(b => {
      const s = Number(b.dataset.step);
      b.classList.toggle("is-active", s === step);
      b.setAttribute("aria-selected", s === step ? "true" : "false");
    });

    btnPrev.disabled = step === 1;
    btnNext.disabled = step === TOTAL_STEPS;
  }

  btnNext.addEventListener("click", () => goToStep(currentStep + 1));
  btnPrev.addEventListener("click", () => goToStep(currentStep - 1));

  stepButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      goToStep(Number(btn.dataset.step));
    });
  });

  /* ======================================================================
     5. LIVE IDENTITY PREVIEW
  ====================================================================== */

  /* ======================================================================
     UPDATE IDENTITY PREVIEW
  ====================================================================== */
  function updateIdentityPreview() {
    const first = form.patientFirstName.value || "";
    const last = form.patientLastName.value || "";
    const sex = form.querySelector("input[name='sex']:checked")?.value || "—";
    const dob = form.patientDob.value;

    const fullName = `${first} ${last}`.trim() || "New Patient";
    const age = calculateAge(dob);

    identityName.textContent = fullName;
    identitySub.textContent = dob ? `DOB: ${dob}` : "Fill the form to generate preview";

    miniPatientName.textContent = fullName;
    miniPatientPhone.textContent = form.patientPhone.value || "—";

    chipAgeVal.textContent = age || "—";
    chipSexVal.textContent = sex;

    avatarInitials.textContent =
      `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "NP";

    form.patientAge.value = age || "";
  }

  form.addEventListener("input", updateIdentityPreview);
  form.addEventListener("change", updateIdentityPreview);

  /* ======================================================================
     6. PREVIEW GENERATION
  ====================================================================== */

  /* ======================================================================
     BUILD PREVIEW HTML
  ====================================================================== */
  function buildPreview() {
    const data = collectFormData();
    const services = getSelectedServices();
    const total = computeServicesTotal(services);

    miniServicesCount.textContent = services.length;
    miniServicesTotal.textContent = `₦${total.toLocaleString()}`;

    previewContainer.innerHTML = `
      <div class="review-block">
        <h4>Patient</h4>
        <p><strong>${data.first_name} ${data.last_name}</strong></p>
        <p>${data.sex || "—"} · ${data.age || "—"} yrs</p>
        <p>${data.phone || "—"}</p>
      </div>

      <div class="review-block">
        <h4>Services (${services.length})</h4>
        ${
          services.length
            ? `<ul>${services
                .map(s => `<li>${s.name} — ${s.amountLabel}</li>`)
                .join("")}</ul>`
            : "<p>No services selected</p>"
        }
        <p><strong>Total: ₦${total.toLocaleString()}</strong></p>
      </div>
    `;

    hasPreview = true;
  }

  btnPreview.addEventListener("click", () => {
    buildPreview();
    goToStep(4);
  });

  /* ======================================================================
     7. SAVE DRAFT (LOCAL ONLY)
  ====================================================================== */

  /* ======================================================================
     SAVE DRAFT TO LOCAL STORAGE
  ====================================================================== */
  function saveDraft() {
    const payload = {
      form: collectFormData(),
      services: getSelectedServices(),
      timestamp: Date.now(),
    };

    localStorage.setItem("patientsDraft", JSON.stringify(payload));
    isDraftSaved = true;
  }

  btnSaveDraft.addEventListener("click", saveDraft);
  btnSaveDraftTop.addEventListener("click", saveDraft);

  /* ======================================================================
     8. CLEAR FORM
  ====================================================================== */

  /* ======================================================================
     RESET FORM & STATE
  ====================================================================== */
  function resetForm() {
    form.reset();
    localStorage.removeItem("patientsDraft");
    currentStep = 1;
    hasPreview = false;
    isDraftSaved = false;
    goToStep(1);
    previewContainer.innerHTML = "";
    updateIdentityPreview();
  }

  btnClearForm.addEventListener("click", resetForm);

  /* ======================================================================
     9. CONFIRM & SAVE TO SUPABASE
  ====================================================================== */

  /* ======================================================================
     SUBMIT PATIENT TO BACKEND (SUPABASE)
  ====================================================================== */
  async function submitPatient() {
    if (!hasPreview) {
      alert("Please generate preview before saving.");
      return;
    }

    // Basic HTML5 validation (required fields)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const payload = {
      ...collectFormData(),
      services: getSelectedServices(),
    };

    // Button loading state
    const originalBtnHtml = btnConfirmSave.innerHTML;
    btnConfirmSave.disabled = true;
    btnConfirmSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.success) {
        const msg = result.message || "Failed to save patient.";
        throw new Error(msg);
      }

      const patient = result.patient || {};
      const fullName = `${patient.first_name || payload.first_name || ""} ${patient.last_name || payload.last_name || ""}`.trim();

      resetForm();

      alert(
        `✓ Patient "${fullName || "Patient"}" registered successfully!\n\nPatient ID: ${patient.patient_id || "—"}\nFile No: ${patient.file_no || "—"}`
      );

    } catch (err) {
      console.error("Register patient failed:", err);
      alert(err.message || "Failed to save patient.");
    } finally {
      btnConfirmSave.disabled = false;
      btnConfirmSave.innerHTML = originalBtnHtml;
    }
  }


  /* ======================================================================
     10. KEYBOARD SHORTCUTS
  ====================================================================== */
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveDraft();
    }
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      buildPreview();
      goToStep(4);
    }
    if (e.key === "Escape") {
      resetForm();
    }
  });

  /* ======================================================================
     11. INIT
  ====================================================================== */
  goToStep(1);
  updateIdentityPreview();

})();
