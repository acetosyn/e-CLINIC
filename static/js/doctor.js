/* ===========================================================
   doctor.js — Epiconsult e-Clinic (2025)
   Live Timer • Dynamic Stats • Activity Feed • Mood Tracker
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Doctor Dashboard initialized");

  /* --------------------------------------------------------
     DOM Shortcuts
  -------------------------------------------------------- */
  const toast = document.getElementById("doctorToast");
  const fullDateEl = document.getElementById("fullDate");
  const liveClockEl = document.getElementById("liveClock");
  const userEl = document.getElementById("loggedDoctor");

  /* --------------------------------------------------------
     Live Clock (Glassmorphic-style like user_timer.js)
  -------------------------------------------------------- */
  const wrapper = document.createElement("div");
  wrapper.id = "clockWrapper";
  wrapper.innerHTML = `
    <span id="clockMain" class="clock-fixed"></span>
    <span id="clockSeconds" class="clock-seconds"></span>
    <span id="clockAmPm" class="clock-ampm"></span>
  `;
  liveClockEl.replaceWith(wrapper);

  const clockMain = document.getElementById("clockMain");
  const clockSeconds = document.getElementById("clockSeconds");
  const clockAmPm = document.getElementById("clockAmPm");

  const dayNameEl = document.createElement("span");
  dayNameEl.id = "dayName";
  fullDateEl.parentNode.insertBefore(dayNameEl, fullDateEl);

  function updateClock() {
    const now = new Date();
    const days = [
      "Sunday","Monday","Tuesday","Wednesday",
      "Thursday","Friday","Saturday"
    ];
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();

    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const h = hours.toString().padStart(2, "0");
    const m = minutes.toString().padStart(2, "0");
    const s = seconds.toString().padStart(2, "0");

    clockMain.textContent = `${h}:${m}`;
    clockSeconds.textContent = `:${s}`;
    clockAmPm.textContent = ampm;
    fullDateEl.textContent = `${date} ${monthName} ${year}`;
    dayNameEl.textContent = dayName;

    requestAnimationFrame(updateClock);
  }
  requestAnimationFrame(updateClock);

  /* --------------------------------------------------------
     Role-based Greeting Color
  -------------------------------------------------------- */
  if (userEl) {
    const role = userEl.textContent.trim();
    userEl.textContent = `Welcome, ${role}`;
    const lower = role.toLowerCase();
    userEl.style.color =
      lower.includes("doctor") ? "#00e0ff" :
      lower.includes("nurse") ? "#00ff88" :
      lower.includes("admin") ? "#ffcc70" :
      "#ffffff";
  }

  /* --------------------------------------------------------
     Toast System
  -------------------------------------------------------- */
  function showToast(msg, type = "info") {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background =
      type === "success"
        ? "#16a34a"
        : type === "error"
        ? "#dc2626"
        : "#e11d48";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  /* --------------------------------------------------------
     Announcement Close Button
  -------------------------------------------------------- */
  const closeBtn = document.querySelector(".announcement-close");
  if (closeBtn)
    closeBtn.addEventListener("click", (e) => {
      e.target.closest(".dc-announcement").style.display = "none";
      showToast("Announcement dismissed", "info");
    });

  /* --------------------------------------------------------
     Mood Tracker
  -------------------------------------------------------- */
  document.querySelectorAll(".mood-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const mood = btn.dataset.mood;
      showToast(`Mood set to ${mood}`, "success");
    })
  );

  /* --------------------------------------------------------
     Fake Stats + Animation
  -------------------------------------------------------- */
  const stats = {
    patients: Math.floor(Math.random() * 20) + 5,
    queue: Math.floor(Math.random() * 6),
    prescriptions: Math.floor(Math.random() * 15) + 3,
    referrals: Math.floor(Math.random() * 5),
  };

  const updateStat = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = value / 20;
    const interval = setInterval(() => {
      current += step;
      if (current >= value) {
        el.textContent = value;
        clearInterval(interval);
      } else {
        el.textContent = Math.floor(current);
      }
    }, 50);
  };

  updateStat("statPatientsSeen", stats.patients);
  updateStat("statQueue", stats.queue);
  updateStat("statPrescriptions", stats.prescriptions);
  updateStat("statReferrals", stats.referrals);

  document.querySelectorAll(".progress .bar").forEach((bar) => {
    bar.style.width = `${Math.floor(Math.random() * 90 + 10)}%`;
  });

  /* --------------------------------------------------------
     Queue + Live Feed Simulation
  -------------------------------------------------------- */
  const feed = document.getElementById("doctorFeed");
  const queue = document.getElementById("doctorQueue");
  const feedItems = [
    "Consultation completed — EPN-045",
    "New patient added to queue (EPN-046)",
    "Prescription sent to Pharmacy",
    "Diagnostics referral created",
    "Follow-up scheduled for tomorrow",
  ];
  const queueData = ["EPN-045", "EPN-046", "EPN-047", "EPN-048"];

  queue.innerHTML = "";
  queueData.forEach((id) => {
    const li = document.createElement("li");
    li.innerHTML = `<i class="fa-solid fa-user"></i> ${id}`;
    queue.appendChild(li);
  });

  let index = 0;
  setInterval(() => {
    const li = document.createElement("li");
    li.textContent = feedItems[index % feedItems.length];
    feed.prepend(li);
    if (feed.children.length > 6) feed.removeChild(feed.lastChild);
    index++;
  }, 5000);

  /* --------------------------------------------------------
     Chart (Performance Summary)
  -------------------------------------------------------- */
  const ctx = document.getElementById("doctorChart");
  if (ctx) {
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Consultations", "Prescriptions", "Referrals"],
        datasets: [
          {
            data: [stats.patients, stats.prescriptions, stats.referrals],
            backgroundColor: ["#0f2b46", "#e11d48", "#f59e0b"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { color: "#334155" } },
        },
      },
    });
  }

  /* --------------------------------------------------------
     Summary Toast at Load
  -------------------------------------------------------- */
  showToast("Doctor Dashboard loaded successfully ✅", "success");
});
