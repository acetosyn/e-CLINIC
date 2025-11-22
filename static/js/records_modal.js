/* ===========================================================
   EPICONSULT — RECORDS MODAL HANDLER (records_modal.js)
   Handles loading/unloading of records.html into fullscreen modal
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  const recordsModal = document.getElementById("recordsFullModal");
  const recordsModalBody = document.getElementById("recordsModalBody");
  const closeRecordsModal = document.getElementById("closeRecordsModal");

  // Buttons that open the modal
  const recordsTriggers = document.querySelectorAll(
    ".open-records-btn, .action-card[title='View patient records']"
  );

  if (!recordsModal || !recordsModalBody) {
    console.warn("❌ Records modal container missing in HTML.");
    return;
  }

  /* ------------------------------------------------------
     OPEN MODAL → FETCH /records
  ------------------------------------------------------ */
  recordsTriggers.forEach(btn => {
    btn.addEventListener("click", async (e) => {

      if (!e.isTrusted) {
        console.warn("⚠️ Blocked auto-triggered modal opening.");
        return;
      }

      e.preventDefault();

      // Show modal shell
      recordsModal.removeAttribute("hidden");
      recordsModalBody.innerHTML = `
        <div style="padding:2rem;text-align:center;">
          Loading patient records...
        </div>
      `;

      try {
        const res = await fetch("/records");
        const html = await res.text();

        // Inject content
        recordsModalBody.innerHTML = html;

        /* ------------------------------------------------------
           INTERNAL CLOSE BUTTONS INSIDE records.html
        ------------------------------------------------------ */

        // 1️⃣ Close "Back to Dashboard" button
        const internalBackBtn = recordsModalBody.querySelector("#records-close-btn");
        if (internalBackBtn) {
          internalBackBtn.addEventListener("click", () => {
            recordsModal.setAttribute("hidden", true);
          });
        }

        // 2️⃣ NEW Close X button
        const closeX = recordsModalBody.querySelector("#recordsCloseX");
        if (closeX) {
          closeX.addEventListener("click", () => {
            recordsModal.setAttribute("hidden", true);
          });
        }

      } catch (err) {
        console.error("❌ Failed loading records:", err);
        recordsModalBody.innerHTML = `
          <div style="padding:2rem;color:red;text-align:center;">
            Could not load patient records.
          </div>
        `;
      }
    });
  });

  /* ------------------------------------------------------
     TOP-RIGHT CLOSE BUTTON (GLOBAL)
  ------------------------------------------------------ */
  if (closeRecordsModal) {
    closeRecordsModal.addEventListener("click", () => {
      recordsModal.setAttribute("hidden", true);
    });
  }

  /* ------------------------------------------------------
     OUTSIDE CLICK TO CLOSE
  ------------------------------------------------------ */
  recordsModal.addEventListener("click", (e) => {
    if (e.target === recordsModal) {
      recordsModal.setAttribute("hidden", true);
    }
  });

  /* ------------------------------------------------------
     ESC KEY TO CLOSE
  ------------------------------------------------------ */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !recordsModal.hasAttribute("hidden")) {
      recordsModal.setAttribute("hidden", true);
    }
  });

});
