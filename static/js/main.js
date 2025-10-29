/* ============================================================
   EPICONSULT e-CLINIC — main.js (v6)
   Enterprise Frontend Controller | 2025 Architecture
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* --------------------------------------------------------
     SIDEBAR TOGGLE
  -------------------------------------------------------- */
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const mainContent = document.getElementById("mainContent");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      mainContent.classList.toggle("expanded");
    });
  }

  /* --------------------------------------------------------
     MOBILE SIDEBAR TOGGLE (Hamburger)
  -------------------------------------------------------- */
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", e => {
      e.stopPropagation();
      sidebar.classList.toggle("open");
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", e => {
    if (window.innerWidth <= 992 && sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    }
  });

  /* --------------------------------------------------------
     DROPDOWN TOGGLES (Sidebar Profile Menu)
  -------------------------------------------------------- */
  const sidebarDropdowns = document.querySelectorAll(".sidebar-menu .dropdown > button");
  sidebarDropdowns.forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const parent = btn.closest(".dropdown");
      parent.classList.toggle("open");
    });
  });

  /* --------------------------------------------------------
     DARK / LIGHT THEME SWITCH
  -------------------------------------------------------- */
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;
  const savedTheme = localStorage.getItem("eclinic-theme");

  if (savedTheme === "dark") body.classList.add("dark");

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      body.classList.toggle("dark");
      localStorage.setItem(
        "eclinic-theme",
        body.classList.contains("dark") ? "dark" : "light"
      );
      themeToggle.innerHTML = body.classList.contains("dark")
        ? `<i class="fa-solid fa-sun"></i>`
        : `<i class="fa-solid fa-moon"></i>`;
    });
  }

    /* --------------------------------------------------------
     WINDOWS-STYLE NOTIFICATION PANEL (Interactive & Scrollable)
  -------------------------------------------------------- */
  const notifBtn = document.getElementById("notifBtn");
  const notifPanel = document.createElement("div");
  notifPanel.classList.add("notif-slide-panel");
  notifPanel.innerHTML = `
      <div class="notif-header">
        <h2><i class="fa-solid fa-bell"></i> Notifications</h2>
        <button id="closeNotif"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="notif-body">
        <div class="notif-item" data-link="/patients/123">
          <i class="fa-solid fa-user-md"></i>
          <span>Dr. Ade updated patient diagnosis.</span>
        </div>
        <div class="notif-item" data-link="/pharmacy/stock">
          <i class="fa-solid fa-capsules"></i>
          <span>Pharmacy restocked essential drugs.</span>
        </div>
        <div class="notif-item" data-link="/reports/staff">
          <i class="fa-solid fa-info-circle"></i>
          <span>Staff report uploaded successfully.</span>
        </div>
        <div class="notif-item" data-link="/meetings">
          <i class="fa-solid fa-calendar-check"></i>
          <span>Meeting with Head of Operations at 2:00PM.</span>
        </div>
      </div>

      <div class="notif-footer">
        <button class="view-all">View All Notifications</button>
      </div>
  `;
  document.body.appendChild(notifPanel);

  // Overlay blur background
  const overlay = document.createElement("div");
  overlay.classList.add("notif-overlay");
  document.body.appendChild(overlay);

  // Toggle Notification Panel
  if (notifBtn) {
    notifBtn.addEventListener("click", e => {
      e.stopPropagation();
      notifPanel.classList.add("show");
      overlay.classList.add("active");
    });
  }

  // Close on outside click
  document.body.addEventListener("click", e => {
    if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
      notifPanel.classList.remove("show");
      overlay.classList.remove("active");
    }
  });

  // Close button
  const closeNotif = () => {
    notifPanel.classList.remove("show");
    overlay.classList.remove("active");
  };
  notifPanel.querySelector("#closeNotif").addEventListener("click", closeNotif);
  notifPanel.querySelector(".view-all").addEventListener("click", closeNotif);

  // ✅ Make notification items clickable
  const notifItems = notifPanel.querySelectorAll(".notif-item");
  notifItems.forEach(item => {
    item.addEventListener("click", e => {
      const targetLink = item.getAttribute("data-link");
      // You can replace this alert with a redirect or modal in your system
      item.classList.add("active");
      setTimeout(() => item.classList.remove("active"), 300);
      console.log(`Clicked notification: ${targetLink}`);
      // Example redirect:
      // window.location.href = targetLink;
    });
  });

  // ✅ Enable smooth scroll inside notification body
  const notifBody = notifPanel.querySelector(".notif-body");
  notifBody.addEventListener("wheel", e => {
    e.stopPropagation(); // prevent overlay scroll
  });


  /* --------------------------------------------------------
     MOBILE HEADER MENU (Department Nav)
     - Converts header nav into vertical accordion for small screens
  -------------------------------------------------------- */
  const headerNav = document.querySelector(".main-nav");
  const headerDropdowns = document.querySelectorAll(".main-nav .dropdown > button");

  // Toggle visibility of main-nav on mobile
  const toggleHeaderNav = () => {
    headerNav.classList.toggle("open");
  };

  // Make dropdown buttons clickable (accordion style)
  headerDropdowns.forEach(btn => {
    btn.addEventListener("click", e => {
      if (window.innerWidth <= 992) {
        e.preventDefault();
        const parent = btn.closest(".dropdown");
        const menu = parent.querySelector(".dropdown-menu");
        const open = parent.classList.contains("open");

        // Close other open dropdowns
        document.querySelectorAll(".main-nav .dropdown.open").forEach(d => {
          if (d !== parent) d.classList.remove("open");
        });

        // Toggle current
        parent.classList.toggle("open");

        // Smooth dropdown animation
        if (menu) {
          if (!open) {
            menu.style.maxHeight = menu.scrollHeight + "px";
          } else {
            menu.style.maxHeight = 0;
          }
        }
      }
    });
  });

  // Reset dropdown height on window resize
  window.addEventListener("resize", () => {
    if (window.innerWidth > 992) {
      document.querySelectorAll(".main-nav .dropdown-menu").forEach(m => {
        m.style.maxHeight = "";
      });
      headerNav.classList.remove("open");
      sidebar.classList.remove("open");
    } else {
      sidebar.classList.add("collapsed");
    }
  });

});
