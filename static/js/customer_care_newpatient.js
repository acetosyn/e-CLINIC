/* ============================================================
   CUSTOMER CARE — NEW PATIENT JS
   Registration Modal • Age Calc • Summary Update
   Works standalone before Supabase integration
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  console.log("🧾 New Patient module ready");

  const form = document.getElementById("newPatientForm");
  const summaryBox = document.getElementById("liveSummary");
  const fileNoEl = document.getElementById("fileNo");
  const patientIdEl = document.getElementById("patientId");
  const dobEl = document.getElementById("dob");
  const ageEl = document.getElementById("age");

  let fileCounter = 1;

  /* ---------------------------
     Auto Generate IDs
  --------------------------- */
  function generatePatientID() {
    const now = new Date();
    const unique = now.getTime().toString().slice(-5);
    return `EPN-${now.getFullYear()}-${unique}`;
  }

  function generateFileNo() {
    return fileCounter++;
  }

  /* ---------------------------
     Age Calculation
  --------------------------- */
  dobEl?.addEventListener("change", () => {
    if (!dobEl.value) return (ageEl.value = "");
    const dob = new Date(dobEl.value);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    ageEl.value = age;
  });

  /* ---------------------------
     Form Submit
  --------------------------- */
  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    // Generate if missing
    if (!fileNoEl.value) fileNoEl.value = generateFileNo();
    if (!patientIdEl.value) patientIdEl.value = generatePatientID();

    const data = Object.fromEntries(new FormData(form).entries());
    data.dateRegistered = new Date().toISOString();

    // Update live summary
    updateSummary(data);

    // Global stats
    window.ccState.stats.newPatients++;
    document.getElementById("statNewPatients").textContent =
      window.ccState.stats.newPatients;

    // Tracking
    window.addActivity(
      `New patient: ${data.fullName}`,
      `Registered as ${data.patientId}`,
      "fa-user-plus"
    );

    showToast("Patient record saved successfully!", "success");
    form.reset();
  });

  /* ---------------------------
     Live Summary Panel
  --------------------------- */
  function updateSummary(data) {
    if (!summaryBox) return;
    summaryBox.innerHTML = `
      <h4>Live Summary</h4>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>File No:</strong> ${data.fileNo}</p>
      <p><strong>Patient ID:</strong> ${data.patientId}</p>
      <p><strong>Name:</strong> ${data.fullName}</p>
      <p><strong>Age:</strong> ${data.age || "—"}</p>
      <p><strong>Delivery Mode:</strong> ${data.deliveryMode}</p>
      <p><strong>Service:</strong> ${data.service}</p>
      <p><strong>Next of Kin:</strong> ${data.nokName} (${data.nokPhone})</p>
      <hr>
      <small>Auto-tracking enabled for this registration.</small>
    `;
  }
});
