/* ============================================================
   EPICONSULT e-CLINIC — CUSTOMER CARE CORE JS (2025 Edition)
   Modules: Timer • Modals • Dynamic Stats • AI Feed • Live Queue
   Architect: GPT-5
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Customer Care JS — Reimagined dashboard loaded.");

  /* ------------------------------------------------------------
     DOM Shortcuts + State
  ------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const toast = $("ccToast");

  const state = {
    stats: {
      newPatients: 0,
      followUps: 0,
      sentAccounts: 0,
      diagnostics: 0,
      messages: 0,
    },
    queue: [],
    ai: {
      lastAction: "--",
      nextSuggestion: "--",
      peakPrediction: "--",
    },
  };

  /* ------------------------------------------------------------
     Toast Notifications
  ------------------------------------------------------------ */
  window.showToast = function (msg, type = "info") {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background =
      type === "error" ? "#dc2626" :
      type === "success" ? "#16a34a" :
      "var(--accent)";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  };

  /* ------------------------------------------------------------
     Clock + Date System
  ------------------------------------------------------------ */
  const fullDateEl = $("fullDate");
  const clockEl = $("liveClock");
  function updateClock() {
    const now = new Date();
    const day = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const time = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (fullDateEl) fullDateEl.textContent = day;
    if (clockEl) clockEl.textContent = time;
  }
  setInterval(updateClock, 1000);
  updateClock();

  /* ------------------------------------------------------------
     Modal Control System
  ------------------------------------------------------------ */
  window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("active");
    else showToast(`⚠️ Modal not found: ${id}`, "error");
  };
  window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("active");
  };
  document.querySelectorAll(".cc-modal-close, [data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modalId =
        e.target.dataset.closeModal?.replace("#", "") ||
        e.target.closest(".cc-modal").id;
      closeModal(modalId);
    });
  });

  /* ------------------------------------------------------------
     Tile Triggers
  ------------------------------------------------------------ */
  document.querySelectorAll(".cc-tile-mini").forEach((tile) => {
    tile.addEventListener("click", () => {
      const target = tile.dataset.target;
      if (target) {
        openModal(target);
        addActivity(
          "Opened Module",
          `Accessed ${tile.textContent.trim()} section.`,
          "fa-window-maximize"
        );
      } else {
        showToast("Coming soon!", "info");
      }
    });
  });

  /* ------------------------------------------------------------
     Activity Feed + Live Queue
  ------------------------------------------------------------ */
  const liveFeed = $("liveActivityFeed");
  const queueList = $("ccQueueList");

  window.addActivity = function (title, desc, icon = "fa-bell") {
    if (!liveFeed) return;
    const li = document.createElement("li");
    li.innerHTML = `<i class="fa-solid ${icon}" style="color:var(--accent);margin-right:6px;"></i>
                    <strong>${title}</strong> — ${desc}
                    <span style="float:right;opacity:0.6">${new Date().toLocaleTimeString()}</span>`;
    liveFeed.prepend(li);
    state.ai.lastAction = title;
    updateAIInsights();
  };

  function updateQueueDisplay() {
    if (!queueList) return;
    queueList.innerHTML = "";
    if (state.queue.length === 0) {
      queueList.innerHTML = `<li class="muted">No patient waiting at the moment.</li>`;
      return;
    }
    state.queue.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${p}`;
      queueList.appendChild(li);
    });
  }

  /* ------------------------------------------------------------
     Stats + AI Insight
  ------------------------------------------------------------ */
  function updateStats() {
    $("statPatients").textContent = state.stats.newPatients;
    $("statFollowups").textContent = state.stats.followUps;
    $("statAccounts").textContent = state.stats.sentAccounts;
    $("statDiagnostics").textContent = state.stats.diagnostics;
    $("statMessages").textContent = state.stats.messages;
  }

  function updateAIInsights() {
    $("lastAction").textContent = state.ai.lastAction;
    $("nextSuggestion").textContent = state.ai.nextSuggestion;
    $("peakPrediction").textContent = state.ai.peakPrediction;
  }

  // Simulate Smart AI Suggestions every few seconds
  const aiPhrases = [
    "Consider sending summary to Accounts",
    "Queue reaching limit — notify nurse desk",
    "Diagnostics referral likely next",
    "Good time to clear follow-ups",
    "Prepare invoice for next patient",
  ];
  setInterval(() => {
    const random = aiPhrases[Math.floor(Math.random() * aiPhrases.length)];
    state.ai.nextSuggestion = random;
    state.ai.peakPrediction = `${Math.floor(8 + Math.random() * 4)} PM`;
    updateAIInsights();
  }, 8000);

  /* ------------------------------------------------------------
     Demo Live Simulation (Optional)
  ------------------------------------------------------------ */
  const demoPatients = ["Olu John", "Chinwe Grace", "Tunde Musa", "Esther James"];
  let i = 0;
  setInterval(() => {
    if (i < demoPatients.length) {
      const name = demoPatients[i++];
      state.stats.newPatients++;
      state.queue.push(name);
      updateStats();
      updateQueueDisplay();
      addActivity("New Patient Added", `${name} registered at front desk.`, "fa-user-plus");
    }
  }, 12000);

  /* ------------------------------------------------------------
     URL Query Modal Trigger
  ------------------------------------------------------------ */
  const params = new URLSearchParams(window.location.search);
  const modalParam = params.get("modal");
  if (modalParam) {
    setTimeout(() => openModal(modalParam), 300);
    addActivity("Modal Loaded via URL", `${modalParam} opened from menu.`, "fa-bolt");
  }

  /* ------------------------------------------------------------
     Initialize Dashboard
  ------------------------------------------------------------ */
  updateStats();
  updateQueueDisplay();
  updateAIInsights();
  addActivity("Customer Care Dashboard Ready", "Live modules initialized.", "fa-sparkles");
});
