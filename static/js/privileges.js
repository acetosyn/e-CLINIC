/* ===========================================================
   privileges.js — Department Restriction Logic (v3.1)
   Doctor Added to Unrestricted Roles
   =========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ---- Get current user's role from sidebar ----
  let userRole = document.querySelector(".sidebar-role")?.textContent?.trim().toLowerCase();

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
  // ✅ Doctor added here
  const unrestrictedRoles = ["admin", "operations", "hop", "doctor"];

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
  const navItems = document.querySelectorAll(".main-nav .dropdown");
  if (userRole && !unrestrictedRoles.includes(userRole)) {
    navItems.forEach(item => {
      const button = item.querySelector("button");
      const deptName = button?.textContent?.toLowerCase().trim();
      const dropdown = item.querySelector(".dropdown-menu");

      // Restrict everything except the user's own department
      if (allowedMap[userRole] !== deptName) {
        item.classList.add("restricted");

        // Completely block dropdowns
        if (dropdown) dropdown.style.display = "none";

        // Keep button clickable for flash message
        button.style.pointerEvents = "auto";
        button.addEventListener("click", e => {
          e.preventDefault();
          flashMessage(
            `Access restricted — you can only access your ${userRole} dashboard.`,
            "error"
          );
        });
      }
    });
  }

  // ---- Optional Enhancement: Tooltip on restricted items ----
  const restrictedItems = document.querySelectorAll(".main-nav .dropdown.restricted button");
  restrictedItems.forEach(btn => {
    btn.setAttribute("title", "Access Restricted");
  });
});
