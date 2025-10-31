/* ============================================================
   EPICONSULT e-CLINIC — CUSTOMER CARE CORE JS
   Dynamic Dashboard • Modals • Activity Router • Header Integration
   Architect: GPT-5 (2025)
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Customer Care Core JS initialized");

  /* ---------------------------
     DOM Shortcuts & State
  --------------------------- */
  const byId = (id) => document.getElementById(id);
  const toastBox = byId("ccToast");

  window.ccState = {
    activePatient: null,
    stats: {
      newPatients: 0,
      queue: 0,
      routed: 0,
      sentAccounts: 0,
    },
  };

  /* ---------------------------
     Toast Notifications
  --------------------------- */
  window.showToast = function (msg, type = "info") {
    if (!toastBox) return;
    toastBox.textContent = msg;
    toastBox.style.background =
      type === "error"
        ? "#dc2626"
        : type === "success"
        ? "#16a34a"
        : "var(--accent)";
    toastBox.classList.add("show");
    setTimeout(() => toastBox.classList.remove("show"), 2500);
  };

  /* ---------------------------
     Modal Controls
  --------------------------- */
  window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal && !modal.classList.contains("active")) {
      modal.classList.add("active");
    } else if (!modal) {
      showToast(`⚠️ Modal not found: ${id}`, "error");
    }
  };

  window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("active");
  };

  document.querySelectorAll(".cc-modal-close, [data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.target.closest("[data-close-modal]");
      const modalId = target
        ? target.dataset.closeModal.replace("#", "")
        : e.target.closest(".cc-modal").id;
      closeModal(modalId);
    });
  });

  /* ---------------------------
     Grid Tile Clicks
  --------------------------- */
  document.querySelectorAll(".cc-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const target = tile.dataset.target;
      if (target) openModal(target);
      else showToast("Coming soon: " + tile.querySelector("h3").textContent);
    });
  });

  /* ---------------------------
     Activity Feed
  --------------------------- */
  window.addActivity = function (title, desc, icon = "fa-bell") {
    const feed =
      document.getElementById("activityFeed") ||
      document.getElementById("liveActivityFeed");
    if (!feed) return;

    const li = document.createElement("li");
    li.classList.add("feed-item");
    li.innerHTML = `
      <div class="feed-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="feed-body">
        <h4>${title}</h4>
        <p>${desc}</p>
        <span class="time">${new Date().toLocaleTimeString()}</span>
      </div>`;
    feed.prepend(li);
  };

  /* ---------------------------
     Header Menu Instant Modals (No Reload)
  --------------------------- */
  document.querySelectorAll('a[data-modal]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetModal = link.getAttribute("data-modal");
      const modalEl = document.getElementById(targetModal);

      // If user is NOT already on the customer_care page
      if (!modalEl) {
        // Safe redirect fallback
        const baseUrl = window.location.origin + "{{ url_for('customer_care') }}";
        window.location.href = `${baseUrl}?modal=${targetModal}`;
        return;
      }

      // If user is already in the customer care page — open instantly
      openModal(targetModal);
      addActivity(
        `Opened from Header: ${targetModal}`,
        `Modal "${targetModal}" opened instantly from top menu.`,
        "fa-bolt"
      );
    });
  });

  /* ---------------------------
     URL PARAM HANDLER — open ?modal=
  --------------------------- */
  const params = new URLSearchParams(window.location.search);
  const modalParam = params.get("modal");

  if (modalParam) {
    const modalEl = document.getElementById(modalParam);
    if (modalEl) {
      // Small delay just to ensure DOM + CSS ready
      setTimeout(() => {
        openModal(modalParam);
        addActivity(
          `Opened via URL: ${modalParam}`,
          `Modal "${modalParam}" loaded from header link.`,
          "fa-window-maximize"
        );
      }, 200);
    } else {
      showToast(
        `Coming soon: ${modalParam.replace(/^modal/i, "").replace(/([A-Z])/g, " $1")}`,
        "info"
      );
    }
  }

  /* ---------------------------
     Initialization Log
  --------------------------- */
  addActivity("Customer Care dashboard ready", "All modules loaded.", "fa-sparkles");
});
