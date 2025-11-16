/* ===========================================================
   privileges.js — Department Restriction Logic (v3.1)
   Doctor Added to Unrestricted Roles
   =========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ---- Get current user's role from sidebar or current_user context ----
  let userRole = document.querySelector(".sidebar-role")?.textContent?.trim().toLowerCase();
  
  // Fallback: Try to get from meta tag or data attribute if sidebar role not found
  if (!userRole || userRole === 'user' || userRole === 'guest') {
    const roleMeta = document.querySelector('meta[name="user-role"]');
    userRole = roleMeta ? roleMeta.getAttribute('content')?.toLowerCase() : userRole;
  }

  // ---- Normalize short aliases from .env to full department names ----
  const roleAliases = {
    "customer": "customer care",
    "customer care": "customer care",
    "doctor": "doctor",
    "nurse": "nursing",
    "nursing": "nursing",
    "pharmacy": "nursing", // pharmacy falls under Nursing Department
    "lab": "laboratory",
    "laboratory": "laboratory",
    "diagnostics": "diagnostics",
    "inv": "inventory",
    "inventory": "inventory",
    "accounts": "accounts",
    "it": "it",
    "hop": "operations",
    "operations": "operations",
    "admin": "admin",
    "staff": "customer care" // fallback: staff under customer care
  };

  userRole = roleAliases[userRole] || userRole;

  // ---- Define unrestricted departments ----
  // Only admin and operations have full access
  const unrestrictedRoles = ["admin", "operations", "hop"];

  // ---- Map of header menu departments ----
  const allowedMap = {
    "customer care": "customer care",
    "doctor": "doctor",
    "nursing": "nursing",
    "laboratory": "laboratory",
    "diagnostics": "diagnostics",
    "inventory": "inventory",
    "accounts": "accounts",
    "it": "it"
  };

  // ---- Helper: Flash popup message ----
  const flashMessage = (msg, type = "error") => {
    let box = document.getElementById("accessMessage");
    if (!box) {
      box = document.createElement("div");
      box.id = "accessMessage";
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.className = `show ${type}`;
    setTimeout(() => {
      box.classList.remove("show");
    }, 3000);
  };

  // ---- Apply restrictions only if not unrestricted ----
  // Note: Server-side already handles this via nav-disabled class
  // Server-side logic is the source of truth - only apply client-side as fallback
  const navItems = document.querySelectorAll(".main-nav .dropdown");
  if (userRole && !unrestrictedRoles.includes(userRole)) {
    navItems.forEach(item => {
      // Skip if already disabled by server-side (has nav-disabled class)
      // Server-side logic is the source of truth
      if (item.classList.contains("nav-disabled")) {
        return;
      }

      const button = item.querySelector("button");
      if (!button) return;
      
      const deptName = button.textContent?.toLowerCase().trim();
      const userDept = allowedMap[userRole];
      
      // If this is the user's own department, NEVER restrict it
      if (userDept && deptName && userDept === deptName) {
        // Ensure it's not restricted
        item.classList.remove("restricted");
        return;
      }

      const dropdown = item.querySelector(".dropdown-menu");

      // Only restrict if it's NOT the user's department
      if (userDept && deptName && userDept !== deptName) {
        item.classList.add("restricted");

        // Completely block dropdowns
        if (dropdown) dropdown.style.display = "none";

        // Keep button clickable for flash message
        button.style.pointerEvents = "auto";
        // Remove any existing click listeners to avoid duplicates
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener("click", e => {
          e.preventDefault();
          flashMessage(
            `Access restricted — you can only access your ${userRole} dashboard.`,
            "error"
          );
        });
      }
    });
  } else if (unrestrictedRoles.includes(userRole)) {
    // For unrestricted roles, ensure nothing is restricted
    navItems.forEach(item => {
      item.classList.remove("restricted");
      const dropdown = item.querySelector(".dropdown-menu");
      if (dropdown) dropdown.style.display = "";
    });
  }

  // ---- Optional Enhancement: Tooltip on restricted items ----
  const restrictedItems = document.querySelectorAll(".main-nav .dropdown.restricted button");
  restrictedItems.forEach(btn => {
    btn.setAttribute("title", "Access Restricted");
  });
});
