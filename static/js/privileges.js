/* ===========================================================
   privileges.js — Department Restriction Logic (v6.0)
   MATCHES privileges.py EXACTLY
   =========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------------------------------------------------------
     1. DETECT USER ROLE
  --------------------------------------------------------- */
  let userRole = document.querySelector(".sidebar-role")?.textContent?.trim().toLowerCase();

  if (!userRole || userRole === "user" || userRole === "guest") {
    const meta = document.querySelector('meta[name="user-role"]');
    if (meta) userRole = meta.getAttribute("content")?.toLowerCase();
  }


  /* ---------------------------------------------------------
     2. NORMALIZE ROLE LABELS (FRONTEND ALIASES)
  --------------------------------------------------------- */
  const roleAliases = {
    "customer": "customer care",
    "customer care": "customer care",
    "doctor": "doctor",
    "nurse": "nursing",
    "nursing": "nursing",
    "pharmacy": "pharmacy",
    "lab": "laboratory",
    "laboratory": "laboratory",
    "diagnostics": "diagnostics",
    "inv": "inventory",
    "inventory": "inventory",
    "accounts": "accounts",
    "it": "it",
    "operations": "operations",
    "hop": "hop",
    "admin": "admin",
    "staff": "staff"
  };

  userRole = roleAliases[userRole] || userRole;


  /* ---------------------------------------------------------
     3. UNRESTRICTED USERS (MATCH BACKEND)
  --------------------------------------------------------- */
  const unrestrictedRoles = ["admin", "operations", "hop", "doctor"];


  /* ---------------------------------------------------------
     4. DEPARTMENT MAP
     This must match BACKEND slugs + header menu
  --------------------------------------------------------- */
  const allowedMap = {
    "customer care": "customer care",
    "doctor": "doctor",
    "nursing": "nursing",
    "pharmacy": "nursing",
    "laboratory": "laboratory",
    "diagnostics": "diagnostics",
    "inventory": "inventory",
    "accounts": "accounts",
    "it": "it",
    "staff": "customer care"
  };


  /* ---------------------------------------------------------
     5. Flash message helper
  --------------------------------------------------------- */
  const flashMessage = (msg) => {
    let box = document.getElementById("accessMessage");
    if (!box) {
      box = document.createElement("div");
      box.id = "accessMessage";
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.className = "show error";
    setTimeout(() => box.classList.remove("show"), 2500);
  };


  /* ---------------------------------------------------------
     6. APPLY RESTRICTIONS
  --------------------------------------------------------- */
  const navItems = document.querySelectorAll(".main-nav .dropdown");

  if (userRole && !unrestrictedRoles.includes(userRole)) {
    const userDept = allowedMap[userRole];

    navItems.forEach(item => {
      if (item.classList.contains("nav-disabled")) return;

      const button = item.querySelector("button");
      if (!button) return;

      const deptName = button.textContent?.toLowerCase().trim();

      // Allow user's own department
      if (deptName === userDept) {
        item.classList.remove("restricted");
        return;
      }

      // Restrict all other departments
      const dropdown = item.querySelector(".dropdown-menu");
      if (dropdown) dropdown.style.display = "none";

      item.classList.add("restricted");

      const newBtn = button.cloneNode(true);
      button.parentNode.replaceChild(newBtn, button);

      newBtn.addEventListener("click", (e) => {
        e.preventDefault();
        flashMessage(
          `Access restricted — you can only access your ${userRole} dashboard.`
        );
      });

      newBtn.setAttribute("title", "Access Restricted");
    });

  } else if (unrestrictedRoles.includes(userRole)) {

    // Unrestricted → unlock ALL
    navItems.forEach(item => {
      item.classList.remove("restricted");
      const dropdown = item.querySelector(".dropdown-menu");
      if (dropdown) dropdown.style.display = "";
    });
  }

});
