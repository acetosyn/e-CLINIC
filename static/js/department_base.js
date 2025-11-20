/* ===========================================================
   EPICONSULT DEPARTMENT_BASE.JS (v6.8)
   Unified Department Dashboard Core Logic
   Architected: 2025
   - Clock + Date
   - Notification Toggle
   - Floating Chat System
   - Dynamic Containers (Supabase-ready)
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

/* -------------------------------------------------------
   1️⃣ CLOCK & DATE SYSTEM — Real-time Updates
------------------------------------------------------- */
  const timeEl = document.getElementById("dept-current-time");
  const dateEl = document.getElementById("dept-current-date");

  if (!timeEl || !dateEl) {
    console.warn("⏰ Clock elements not found in DOM. Ensure IDs 'dept-current-time' and 'dept-current-date' exist.");
  } else {
    function updateClock() {
      const now = new Date();

      // Format time: HH:MM:SS
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const timeStr = `${hours}:${minutes}:${seconds}`;

      // Format date: Day, DD MMM YYYY (e.g., "Mon, 16 Nov 2025")
      const dateStr = now.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

      timeEl.textContent = timeStr;
      dateEl.textContent = dateStr;
    }

    // Update immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);
    console.log("⏰ Real-time clock initialized");
  }


  /* -------------------------------------------------------
     2️⃣ NOTIFICATION DROPDOWN
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
     3️⃣ FLOATING CHAT SYSTEM
  ------------------------------------------------------- */
  const chatBtn = document.querySelector(".floating-chat-btn");
  const chatModal = document.querySelector(".chat-modal");
  const chatClose = chatModal?.querySelector(".chat-modal-close");

  if (chatBtn && chatModal) {
    chatBtn.addEventListener("click", () => {
      chatModal.classList.toggle("active");
      chatModal.style.display = chatModal.classList.contains("active") ? "flex" : "none";
    });
    chatClose?.addEventListener("click", () => {
      chatModal.classList.remove("active");
      chatModal.style.display = "none";
    });
  }

  /* -------------------------------------------------------
     4️⃣ CHAT INPUT HANDLER (Placeholder)
  ------------------------------------------------------- */
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatInput = document.getElementById("chatMessage");
  const chatFeed = document.querySelector(".chat-messages");

  if (chatSendBtn && chatInput && chatFeed) {
    chatSendBtn.addEventListener("click", () => {
      const msg = chatInput.value.trim();
      if (msg) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble";
        bubble.innerHTML = `<strong>You:</strong> ${msg}`;
        chatFeed.appendChild(bubble);
        chatFeed.scrollTop = chatFeed.scrollHeight;
        chatInput.value = "";

        // Placeholder: Future Supabase message push
        console.log("Chat message sent:", msg);
      }
    });
  }

  /* -------------------------------------------------------
     5️⃣ DASHBOARD METRIC PLACEHOLDERS
     (For future Supabase real-time binding)
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
    if (el) el.textContent = "—"; // Placeholder until data loads
  });

  // Simulate dynamic updates (for now)
  setTimeout(() => {
    metricIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.floor(Math.random() * 40) + 1;
    });
  }, 2500);

  /* -------------------------------------------------------
     6️⃣ LIVE FEED / QUEUE / REPORTS (Containers)
  ------------------------------------------------------- */
  const liveFeed = document.getElementById("liveActivityFeed");
  const queueList = document.getElementById("ccQueueList");
  const reportBlock = document.getElementById("deptReportFeed");

  if (liveFeed) {
    liveFeed.innerHTML = `
      <li class="muted">⏳ Awaiting live activities...</li>
    `;
  }

  if (queueList) {
    queueList.innerHTML = `
      <li class="muted">🧍 No patient in queue.</li>
    `;
  }

  if (reportBlock) {
    reportBlock.innerHTML = `
      <p class="muted">📊 Reports will appear here after Supabase sync.</p>
    `;
  }

  /* -------------------------------------------------------
     7️⃣ TOAST UTILITY (Optional)
  ------------------------------------------------------- */
  function showToast(message, type = "info") {
    let toast = document.createElement("div");
    toast.className = `toast-msg ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // Example toast (for visual)
  setTimeout(() => {
    showToast("Welcome to your Department Dashboard!", "success");
  }, 800);

  /* -------------------------------------------------------
     8️⃣ DYNAMIC THEMING PLACEHOLDER
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
     9️⃣ SCROLL REVEAL (Simple)
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

});

/* -------------------------------------------------------
   🔟 OPTIONAL: CSS for Toasts & Reveals (Inline Support)
------------------------------------------------------- */
const style = document.createElement("style");
style.textContent = `
.toast-msg {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #0f2b46;
  color: #fff;
  padding: 0.75rem 1.2rem;
  border-radius: 10px;
  opacity: 0;
  transition: all 0.4s ease;
  z-index: 3000;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  font-size: 0.9rem;
}
.toast-msg.success { background: #16a34a; }
.toast-msg.info { background: #0284c7; }
.toast-msg.error { background: #dc2626; }
.toast-msg.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.visible { opacity: 1; transform: none; transition: 0.6s all ease; }
`;
document.head.appendChild(style);
