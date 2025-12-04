/* ============================================================================
   EPICONSULT e-CLINIC — FULLSCREEN RECORDS MODAL LOADER (2025 FINAL BUILD)
   100% MATCHES new records.html + new records.js IDs
============================================================================ */

document.addEventListener("DOMContentLoaded", () => {

  const modal = document.getElementById("recordsFullModal");
  const modalBody = document.getElementById("recordsModalBody");
  const modalClose = document.getElementById("closeRecordsModal");

  const triggers = document.querySelectorAll(
    ".open-records-btn, .action-card[title='View patient records']"
  );

  if (!modal || !modalBody) {
    console.warn("[records_modal.js] Modal container not found.");
    return;
  }

  /* ============================================================================
     OPEN RECORDS WORKSPACE
  ============================================================================ */
  triggers.forEach(btn => {
    btn.addEventListener("click", async (e) => {

      if (!e.isTrusted) return;
      e.preventDefault();

      modal.removeAttribute("hidden");

      modalBody.innerHTML = `
        <div style="padding:2rem;text-align:center;color:#1e3a8a;">
          <div class="spinner-lg"></div>
          <p style="margin-top:1rem;font-weight:600;">Loading patient records…</p>
        </div>
      `;

      try {
        const res = await fetch("/records");
        const html = await res.text();

        modalBody.innerHTML = html;

        attachInternalCloseButtons();
        loadRecordsJS();

      } catch (err) {
        console.error("❌ Failed loading records:", err);
        modalBody.innerHTML = `
          <div style="padding:2rem;color:red;text-align:center;">
            Could not load the records workspace.<br>Please try again.
          </div>
        `;
      }
    });
  });

  /* ============================================================================
     INTERNAL CLOSE BUTTONS (MATCH EXACT HTML)
  ============================================================================ */
  function attachInternalCloseButtons() {

    // 1️⃣ BACK BUTTON (inside header)
    const backBtn = modalBody.querySelector("#records-close-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => modal.setAttribute("hidden", true));
    }

    // 2️⃣ TOP RIGHT CLOSE X
    const closeX = modalBody.querySelector("#recordsCloseX");
    if (closeX) {
      closeX.addEventListener("click", () => modal.setAttribute("hidden", true));
    }
  }

  /* ============================================================================
     LOAD records.js AFTER INJECTING HTML
  ============================================================================ */
  function loadRecordsJS() {
    if (modalBody.querySelector("script[data-records-loaded]")) return;

    const script = document.createElement("script");
    script.src = "/static/js/records.js?v=" + Date.now();
    script.dataset.recordsLoaded = "true";
    modalBody.appendChild(script);
  }

  /* ============================================================================
     OUTSIDE CLICK TO CLOSE
  ============================================================================ */
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.setAttribute("hidden", true);
    }
  });

  /* ============================================================================
     ESC KEY CLOSE
  ============================================================================ */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hasAttribute("hidden")) {
      modal.setAttribute("hidden", true);
    }
  });

  /* ============================================================================
     TOP-RIGHT CLOSE BUTTON (GLOBAL)
  ============================================================================ */
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      modal.setAttribute("hidden", true);
    });
  }

});
