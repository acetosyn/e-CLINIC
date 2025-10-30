/* ===========================================================
   user_timer.js — Glassmorphic Smooth Clock + Role Accent
   =========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const fullDateEl = document.getElementById("fullDate");
  const userEl = document.getElementById("loggedUser");
  const timeContainer = document.getElementById("liveClock");

  // Wrap structure for stability (hours, minutes, seconds separate)
  const wrapper = document.createElement("div");
  wrapper.id = "clockWrapper";
  wrapper.innerHTML = `
    <span id="clockMain" class="clock-fixed"></span>
    <span id="clockSeconds" class="clock-seconds"></span>
    <span id="clockAmPm" class="clock-ampm"></span>
  `;
  timeContainer.replaceWith(wrapper);

  const clockMain = document.getElementById("clockMain");
  const clockSeconds = document.getElementById("clockSeconds");
  const clockAmPm = document.getElementById("clockAmPm");

  const dayNameEl = document.createElement("span");
  dayNameEl.id = "dayName";
  fullDateEl.parentNode.insertBefore(dayNameEl, fullDateEl);

  // Smooth animation using requestAnimationFrame
  function updateClock() {
    const now = new Date();
    const days = [
      "Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday"
    ];
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
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

    // Static width clock numbers
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

  // Role color highlight
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

  requestAnimationFrame(updateClock);
});
