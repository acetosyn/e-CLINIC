/* ===========================================================
   EPICONSULT DEPARTMENT_BASE.JS (v6.9.1)
   Unified Department Dashboard Core Logic

   ✅ Chat is controlled by chat.js
   ✅ We DO NOT touch chat badge/polling/modal logic
   ✅ We ONLY hide legacy chat UI safely (not the chat.js modal)
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* -------------------------------------------------------
     0) RECORDS LOADER (unchanged)
  ------------------------------------------------------- */
  const openRecordsBtn = document.querySelector(".open-records-btn");
  const loader = document.querySelector(".open-records-btn .loader-spinner");

  if (openRecordsBtn && loader) {
    openRecordsBtn.addEventListener("click", () => {
      loader.style.display = "block";
      openRecordsBtn.classList.add("loading");

      setTimeout(() => {
        loader.style.display = "none";
        openRecordsBtn.classList.remove("loading");
        console.log("Modal should open now");
      }, 5000);
    });
  }

  /* -------------------------------------------------------
     1) CLOCK & DATE SYSTEM — Real-time Updates
  ------------------------------------------------------- */
  const timeEl = document.getElementById("dept-current-time");
  const dateEl = document.getElementById("dept-current-date");

  if (!timeEl || !dateEl) {
    console.warn("⏰ Clock elements not found. Ensure IDs 'dept-current-time' and 'dept-current-date' exist.");
  } else {
    function updateClock() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      timeEl.textContent = `${hours}:${minutes}:${seconds}`;
      dateEl.textContent = now.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  /* -------------------------------------------------------
     2) NOTIFICATION DROPDOWN
  ------------------------------------------------------- */
  const notifBtn = document.querySelector(".notif-btn");
  const notifDropdown = document.querySelector(".notif-dropdown");

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.remove("active");
      }
    });
  }

  /* -------------------------------------------------------
     3) CHAT — HAND OFF TO chat.js (SAFE)
     Fix: DO NOT hide the chat.js modal (it's also .chat-modal)
  ------------------------------------------------------- */
  const overlay = document.getElementById("chatModalOverlay");
  const hasChatJS = !!overlay && !!document.getElementById("floating-chat-button");

  if (hasChatJS) {
    // Hide any *legacy* floating chat button (old system)
    const legacyFloatBtn = document.querySelector(".floating-chat-btn");
    if (legacyFloatBtn) legacyFloatBtn.style.display = "none";

    // Hide any *legacy* chat modal ONLY if it's NOT inside the new overlay
    // (chat.js modal lives INSIDE #chatModalOverlay)
    const allChatModals = Array.from(document.querySelectorAll(".chat-modal"));
    allChatModals.forEach((m) => {
      const isChatJsModal = overlay.contains(m);
      if (!isChatJsModal) {
        m.style.display = "none";
      }
    });

    // Also disable legacy close buttons if present (outside overlay)
    const legacyCloseBtns = Array.from(document.querySelectorAll(".chat-modal-close"));
    legacyCloseBtns.forEach((btn) => {
      if (!overlay.contains(btn)) btn.style.display = "none";
    });

    console.log("💬 chat.js active — department_base.js will not initialize chat logic (legacy UI hidden safely).");
  }

  /* -------------------------------------------------------
     4) DASHBOARD METRIC PLACEHOLDERS
  ------------------------------------------------------- */
  const metricIds = [
    "statPatients",
    "statFollowups",
    "statAccounts",
    "statDiagnostics",
    "statMessages",
    "statQueue"
  ];

  metricIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "—";
  });

  // Simulate dynamic updates (optional)
  setTimeout(() => {
    metricIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.floor(Math.random() * 40) + 1;
    });
  }, 2500);

  /* -------------------------------------------------------
     5) LIVE FEED / QUEUE / REPORTS (Placeholders)
  ------------------------------------------------------- */
  const liveFeed = document.getElementById("liveActivityFeed");
  const queueList = document.getElementById("ccQueueList");
  const reportBlock = document.getElementById("deptReportFeed");

  if (liveFeed) liveFeed.innerHTML = `<li class="muted">⏳ Awaiting live activities...</li>`;
  if (queueList) queueList.innerHTML = `<li class="muted">🧍 No patient in queue.</li>`;
  if (reportBlock) reportBlock.innerHTML = `<p class="muted">📊 Reports will appear here after Supabase sync.</p>`;

  /* -------------------------------------------------------
     6) TOAST UTILITY
  ------------------------------------------------------- */
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 90);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 320);
    }, 2800);
  }

  setTimeout(() => {
    showToast("Welcome to your Department Dashboard!", "success");
  }, 800);

  /* -------------------------------------------------------
     7) THEME TOGGLE
  ------------------------------------------------------- */
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const mode = document.body.classList.contains("dark") ? "Dark Mode" : "Light Mode";
      showToast(`${mode} Activated`, "info");
    });
  }

  /* -------------------------------------------------------
     8) SCROLL REVEAL
  ------------------------------------------------------- */
  const revealElements = document.querySelectorAll(".dept-card, .dept-main, .dept-sidebar, .dept-sidebar-right");
  const revealOnScroll = () => {
    const trigger = window.innerHeight * 0.88;
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < trigger) el.classList.add("visible");
    });
  };
  window.addEventListener("scroll", revealOnScroll);
  revealOnScroll();

}); // DOMContentLoaded end


/* -------------------------------------------------------
   OPTIONAL: CSS for Toasts & Reveal (Inline Support)
------------------------------------------------------- */
const style = document.createElement("style");
style.textContent = `
.toast-msg{
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(18px);
  background: #0f2b46;
  color: #fff;
  padding: 0.75rem 1.15rem;
  border-radius: 12px;
  opacity: 0;
  transition: all .35s ease;
  z-index: 3000;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  font-size: .92rem;
  font-weight: 650;
}
.toast-msg.success{ background:#16a34a; }
.toast-msg.info{ background:#0284c7; }
.toast-msg.error{ background:#dc2626; }
.toast-msg.show{
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.visible{
  opacity: 1;
  transform: none;
  transition: .6s all ease;
}
`;
document.head.appendChild(style);