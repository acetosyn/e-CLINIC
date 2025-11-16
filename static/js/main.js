/* ============================================================
   EPICONSULT e-CLINIC — main.js (v6)
   Enterprise Frontend Controller | 2025 Architecture
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  
  /* --------------------------------------------------------
     HIDE PAGE LOADING OVERLAY
     Hide loading indicator once page is ready
  -------------------------------------------------------- */
  const pageLoadingOverlay = document.getElementById("pageLoadingOverlay");
  
  // Hide overlay after a short delay to ensure smooth transition
  setTimeout(() => {
    if (pageLoadingOverlay) {
      pageLoadingOverlay.classList.add("hidden");
      // Remove from DOM after animation completes
      setTimeout(() => {
        if (pageLoadingOverlay.parentNode) {
          pageLoadingOverlay.parentNode.removeChild(pageLoadingOverlay);
        }
      }, 400);
    }
  }, 300);

  // Also hide on window load (as backup for slow resources)
  window.addEventListener("load", () => {
    if (pageLoadingOverlay && !pageLoadingOverlay.classList.contains("hidden")) {
      pageLoadingOverlay.classList.add("hidden");
      setTimeout(() => {
        if (pageLoadingOverlay.parentNode) {
          pageLoadingOverlay.parentNode.removeChild(pageLoadingOverlay);
        }
      }, 400);
    }
  });

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
     NOTIFICATION PANEL TOGGLE (Real notifications handled by notifications.js)
  -------------------------------------------------------- */
  const notifBtn = document.getElementById("notifBtn");
  const notifPanel = document.getElementById("notifPanel");
  
  // Toggle notification panel visibility
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener("click", e => {
      e.stopPropagation();
      const notificationCenter = notifBtn.closest(".notification-center");
      if (notificationCenter) {
        notificationCenter.classList.toggle("active");
      }
    });

    // Close on outside click
    document.addEventListener("click", e => {
      if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
        const notificationCenter = notifBtn.closest(".notification-center");
        if (notificationCenter) {
          notificationCenter.classList.remove("active");
        }
      }
    });
  }


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
