// static/js/users.js
// EpiSuite Admin Users (v1) — wired to Flask admin_bp APIs
// Endpoints:
//   GET    /admin/api/users
//   POST   /admin/api/users
//   PATCH  /admin/api/users/<id>/active
//   DELETE /admin/api/users/<id>

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------
  // DOM
  // ----------------------------
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const table = document.querySelector(".eu-table");
  const tableBody = document.querySelector(".eu-table tbody");

  const searchInput = document.querySelector(".eu-search");
  const deptFilter = document.querySelector(".eu-filter");
  const tabs = Array.from(document.querySelectorAll(".eu-tab"));

  const form = document.querySelector(".eu-form");
  const fullNameInput =
    form?.querySelector('input[placeholder*="Sarah"]') ||
    form?.querySelectorAll("input[type='text']")?.[0] ||
    null;

  const usernameInput =
    form?.querySelector('input[placeholder*="swilliams"]') ||
    form?.querySelectorAll("input[type='text']")?.[1] ||
    null;

  const generatedPassword = document.getElementById("generatedPassword");
  const strengthText = document.getElementById("strengthText");
  const strengthBar = document.getElementById("strengthBar");

  const deptSelect = document.getElementById("departmentSelect");
  const roleSelect = document.getElementById("roleSelect");

  const statusSwitch = form?.querySelector(".eu-switch");
  const statusLabel = document.getElementById("statusLabel");

  // Delete modal from HTML (you have it)
  const deleteModal = document.getElementById("deleteModal");

  // ----------------------------
  // Constants: slugs => labels
  // Must match constants.py
  // ----------------------------
  const DEPARTMENTS = [
    { slug: "doctor", label: "Doctor" },
    { slug: "medical_officer", label: "Medical Officer" },
    { slug: "nurse", label: "Nurse" },
    { slug: "customer_care", label: "Customer Care" },
    { slug: "laboratory", label: "Laboratory" },
    { slug: "inventory", label: "Inventory" },
    { slug: "bdu", label: "Business Development Unit (BDU)" },
    { slug: "accountant", label: "Accountant" },
    { slug: "security_support", label: "Security & Support Staff" },
  ];

  // ----------------------------
  // State
  // ----------------------------
  let users = [];
  let activeTab = "all"; // all | active | disabled
  let sortState = { key: "created_at", dir: "desc" }; // sortable
  let pendingDeleteId = null;

  // Persist UI state
  const LS = {
    theme: "eu_theme",
    search: "eu_user_search",
    dept: "eu_user_dept",
    tab: "eu_user_tab",
    sort: "eu_user_sort",
  };

  // ----------------------------
  // Utilities
  // ----------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function showToast(msg, ms = 2200) {
    if (!toast || !toastText) return;
    toastText.textContent = msg;
    toast.classList.add("is-show");
    setTimeout(() => toast.classList.remove("is-show"), ms);
  }

  function debounce(fn, wait = 180) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function normalizeSlug(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_");
  }

  function deptLabelFromSlug(slug) {
    const s = normalizeSlug(slug);
    const found = DEPARTMENTS.find((d) => d.slug === s);
    return found ? found.label : (slug ? String(slug).replaceAll("_", " ") : "—");
  }

  function initials(name) {
    const parts = (name || "").trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "??";
  }

  function safeText(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatLastLogin(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  function formatCreated(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  }

  // password utils
  function makePassword(len = 14) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    let out = "";
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  function passwordStrength(pw) {
    if (!pw) return { label: "N/A", pct: 0 };
    let score = 0;
    if (pw.length >= 10) score++;
    if (pw.length >= 14) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const pct = Math.min(100, Math.round((score / 6) * 100));
    let label = "Weak";
    if (pct >= 80) label = "Strong";
    else if (pct >= 55) label = "Good";
    else if (pct >= 35) label = "Fair";
    return { label, pct };
  }

  // Username suggestions
  function slugifyUsername(name) {
    const cleaned = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return "";
    const parts = cleaned.split(" ");
    // e.g., "Sarah Williams" -> "swilliams"
    if (parts.length === 1) return parts[0];
    const first = parts[0][0] || "";
    const last = parts[parts.length - 1] || "";
    return (first + last).slice(0, 16);
  }

  function getUniqueUsername(base) {
    const existing = new Set(users.map((u) => String(u.username || "").toLowerCase()));
    if (!existing.has(base.toLowerCase())) return base;

    // try base + number
    for (let i = 2; i <= 99; i++) {
      const candidate = `${base}${i}`;
      if (!existing.has(candidate.toLowerCase())) return candidate;
    }
    return base; // fallback (backend will reject if duplicate)
  }

  // ----------------------------
  // API
  // ----------------------------
  async function apiGetUsers() {
    const res = await fetch("/admin/api/users", { headers: { "Accept": "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to load users");
    return data.users || [];
  }

  async function apiCreateUser(payload) {
    const res = await fetch("/admin/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Create failed");
    return data.user;
  }

  async function apiSetActive(userId, isActive) {
    const res = await fetch(`/admin/api/users/${userId}/active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ is_active: !!isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Update failed");
    return data.user;
  }

  async function apiDeleteUser(userId) {
    const res = await fetch(`/admin/api/users/${userId}`, {
      method: "DELETE",
      headers: { "Accept": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || "Delete failed");
    return true;
  }

  // ----------------------------
  // Feature: Theme toggle (localStorage)
  // ----------------------------
  const themeBtn = document.querySelector("[data-theme-toggle]");
  function setTheme(mode) {
    document.documentElement.dataset.theme = mode; // you can style with [data-theme="dark"]
    localStorage.setItem(LS.theme, mode);
  }
  function toggleTheme() {
    const current = localStorage.getItem(LS.theme) || "dark";
    setTheme(current === "dark" ? "light" : "dark");
    showToast("Theme updated");
  }
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
  setTheme(localStorage.getItem(LS.theme) || "dark");

  // ----------------------------
  // Feature: Build department filter dynamically (matches your slugs)
  // ----------------------------
  function buildDeptFilterOptions() {
    if (!deptFilter) return;
    const saved = localStorage.getItem(LS.dept) || "";

    deptFilter.innerHTML = `
      <option value="">All Departments</option>
      ${DEPARTMENTS.map(d => `<option value="${d.slug}">${safeText(d.label)}</option>`).join("")}
      <option value="__none__">No Department</option>
    `;

    if (saved) deptFilter.value = saved;
  }
  buildDeptFilterOptions();

  // ----------------------------
  // Feature: Disable dept select when role=admin
  // ----------------------------
  function syncRoleDeptUI() {
    if (!roleSelect || !deptSelect) return;
    const role = normalizeSlug(roleSelect.value);
    const isAdmin = role === "admin";
    deptSelect.disabled = isAdmin;
    if (isAdmin) deptSelect.value = "";
  }
  roleSelect?.addEventListener("change", syncRoleDeptUI);
  syncRoleDeptUI();

  // ----------------------------
  // Feature: Status switch default to Active
  // ----------------------------
  function setStatusActive(active) {
    if (!statusSwitch) return;
    statusSwitch.setAttribute("aria-pressed", String(!!active));
    if (statusLabel) statusLabel.textContent = active ? "Active" : "Disabled";
  }
  // default active
  setStatusActive(true);

  // HTML still calls toggleStatus(this)
  window.toggleStatus = (btn) => {
    const pressed = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", String(!pressed));
    if (statusLabel) statusLabel.textContent = !pressed ? "Active" : "Disabled";
  };

  // ----------------------------
  // Feature: Password generate + copy (your inline onclick)
  // ----------------------------
  window.generatePassword = () => {
    const pw = makePassword(14);
    if (generatedPassword) generatedPassword.value = pw;

    const s = passwordStrength(pw);
    if (strengthText) strengthText.textContent = s.label;
    if (strengthBar) strengthBar.style.width = `${s.pct}%`;

    showToast("Password generated");
  };

  window.copyPassword = async () => {
    const pw = generatedPassword?.value || "";
    if (!pw) return showToast("Generate a password first");
    try {
      await navigator.clipboard.writeText(pw);
      showToast("Password copied");
    } catch {
      showToast("Copy failed");
    }
  };

  // ----------------------------
  // Feature: Auto-suggest username from Full Name (and try to keep unique)
  // ----------------------------
  fullNameInput?.addEventListener(
    "input",
    debounce(() => {
      if (!usernameInput) return;
      const current = (usernameInput.value || "").trim();
      // don't overwrite if user already typed something meaningful
      if (current.length >= 3) return;

      const base = slugifyUsername(fullNameInput.value);
      if (!base) return;

      usernameInput.value = getUniqueUsername(base);
    }, 220)
  );

  // ----------------------------
  // Filtering + Sorting
  // ----------------------------
  function matchesFilters(u) {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const dept = (deptFilter?.value || "").trim().toLowerCase();

    const name = (u.full_name || "").toLowerCase();
    const usern = (u.username || "").toLowerCase();
    const udept = normalizeSlug(u.department || "");

    if (q && !(name.includes(q) || usern.includes(q))) return false;

    if (dept) {
      if (dept === "__none__") {
        if (udept) return false;
      } else {
        if (udept !== dept) return false;
      }
    }

    if (activeTab === "active" && !u.is_active) return false;
    if (activeTab === "disabled" && u.is_active) return false;

    return true;
  }

  function getSortValue(u, key) {
    switch (key) {
      case "full_name":
        return (u.full_name || "").toLowerCase();
      case "username":
        return (u.username || "").toLowerCase();
      case "department":
        return normalizeSlug(u.department || "");
      case "status":
        return u.is_active ? 1 : 0;
      case "last_login":
        return u.last_login ? new Date(u.last_login).getTime() : 0;
      case "created_at":
        return u.created_at ? new Date(u.created_at).getTime() : 0;
      default:
        return (u[key] ?? "");
    }
  }

  function sortUsers(list) {
    const { key, dir } = sortState;
    const mul = dir === "asc" ? 1 : -1;

    return [...list].sort((a, b) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
  }

  // Feature: click headers to sort
  function enableHeaderSorting() {
    if (!table) return;
    const headers = table.querySelectorAll("thead th");
    // Map indexes to sort keys (based on your table columns)
    const map = {
      0: "full_name",
      1: "username",
      2: "department",
      3: "status",
      4: "last_login",
    };

    headers.forEach((th, idx) => {
      if (!(idx in map)) return;
      th.style.cursor = "pointer";
      th.title = "Click to sort";

      th.addEventListener("click", () => {
        const key = map[idx];
        if (sortState.key === key) {
          sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
        } else {
          sortState.key = key;
          sortState.dir = "asc";
        }
        localStorage.setItem(LS.sort, JSON.stringify(sortState));
        render();
      });
    });
  }

  // restore saved sort
  try {
    const savedSort = JSON.parse(localStorage.getItem(LS.sort) || "null");
    if (savedSort?.key) sortState = savedSort;
  } catch {}
  enableHeaderSorting();

  // ----------------------------
  // Render table
  // ----------------------------
  function statusBadge(isActive) {
    return isActive
      ? `<span class="badge badge--green">Active</span>`
      : `<span class="badge badge--gray">Disabled</span>`;
  }

  function deptBadge(slug) {
    const label = deptLabelFromSlug(slug);
    // keep your existing style; you can refine badge color mapping later
    return `<span class="badge badge--purple">${safeText(label)}</span>`;
  }

  function render() {
    if (!tableBody) return;

    const filtered = users.filter(matchesFilters);
    const sorted = sortUsers(filtered);

    const rows = sorted
      .map((u) => {
        const dept = u.department ? deptBadge(u.department) : `<span class="muted">—</span>`;
        const roleText = safeText((u.role || "staff").replaceAll("_", " "));
        const lastLogin = safeText(formatLastLogin(u.last_login));

        const toggleText = u.is_active ? "Disable" : "Enable";
        const toggleClass = u.is_active ? "act--warn" : "act--ok";

        return `
          <tr data-user-id="${safeText(u.id)}">
            <td>
              <div class="eu-person">
                <span class="avatar">${safeText(initials(u.full_name))}</span>
                <div>
                  <strong>${safeText(u.full_name || "—")}</strong>
                  <div class="small">Role: ${roleText}</div>
                </div>
              </div>
            </td>

            <td class="muted">${safeText(u.username || "—")}</td>
            <td>${dept}</td>
            <td>${statusBadge(!!u.is_active)}</td>
            <td class="muted">${lastLogin}</td>

            <td class="actions">
              <button class="act act--view" type="button" data-action="view">View</button>
              <button class="act ${toggleClass}" type="button" data-action="toggle">${toggleText}</button>
              <button class="act act--danger" type="button" data-action="delete">Delete</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tableBody.innerHTML =
      rows || `<tr><td colspan="6" class="muted">No users found.</td></tr>`;
  }

  // ----------------------------
  // Feature: View User Modal (created dynamically)
  // ----------------------------
  function ensureViewModal() {
    let modal = document.getElementById("viewUserModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "eu-modal";
    modal.id = "viewUserModal";
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="eu-modal-backdrop" data-close-view></div>
      <div class="eu-modal-card">
        <div class="eu-modal-icon">i</div>
        <h3>User Details</h3>
        <div id="viewUserBody" style="margin-top:10px; line-height:1.6;"></div>
        <div class="eu-modal-actions">
          <button class="eu-btn eu-btn--ghost" type="button" data-close-view>Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target.matches("[data-close-view]")) closeViewModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeViewModal();
    });

    return modal;
  }

  function openViewModal(user) {
    const modal = ensureViewModal();
    const body = document.getElementById("viewUserBody");
    if (body) {
      body.innerHTML = `
        <div><strong>Name:</strong> ${safeText(user.full_name || "—")}</div>
        <div><strong>Username:</strong> ${safeText(user.username || "—")}</div>
        <div><strong>Role:</strong> ${safeText(user.role || "staff")}</div>
        <div><strong>Department:</strong> ${safeText(user.department ? deptLabelFromSlug(user.department) : "—")}</div>
        <div><strong>Status:</strong> ${user.is_active ? "Active" : "Disabled"}</div>
        <div><strong>Created:</strong> ${safeText(formatCreated(user.created_at))}</div>
        <div><strong>Last login:</strong> ${safeText(formatLastLogin(user.last_login))}</div>
      `;
    }
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
  }

  function closeViewModal() {
    const modal = document.getElementById("viewUserModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
  }

  // ----------------------------
  // Feature: Delete modal (uses your HTML one)
  // We'll override your old inline functions by providing global functions too.
  // ----------------------------
  function openDeleteModal(userId) {
    pendingDeleteId = userId;
    if (!deleteModal) return;
    deleteModal.setAttribute("aria-hidden", "false");
    deleteModal.classList.add("is-open");
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    if (!deleteModal) return;
    deleteModal.setAttribute("aria-hidden", "true");
    deleteModal.classList.remove("is-open");
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;

    try {
      await apiDeleteUser(id);
      users = users.filter((u) => String(u.id) !== String(id));
      render();
      showToast("User deleted");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Delete failed");
    } finally {
      closeDeleteModal();
    }
  }

  // provide globals for HTML onclicks (your existing modal uses them)
  window.openDeleteModal = () => {
    // if user clicked old demo button (no id), just show toast
    showToast("Use table delete button (wired).");
  };
  window.closeDeleteModal = closeDeleteModal;
  window.confirmDelete = confirmDelete;

  // Close delete modal on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDeleteModal();
  });

  // ----------------------------
  // Table actions (event delegation)
  // ----------------------------
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const row = btn.closest("tr[data-user-id]");
    const id = row?.getAttribute("data-user-id");
    if (!id) return;

    const action = btn.getAttribute("data-action");
    const user = users.find((u) => String(u.id) === String(id));
    if (!user) return;

    // Disable buttons during action
    const allBtns = row.querySelectorAll("button[data-action]");
    allBtns.forEach((b) => (b.disabled = true));

    try {
      if (action === "view") {
        openViewModal(user);
        return;
      }

      if (action === "toggle") {
        // Modern feature: optimistic UI update + rollback
        const old = user.is_active;
        user.is_active = !old;
        render();

        try {
          const updated = await apiSetActive(user.id, user.is_active);
          users = users.map((u) =>
            u.id === user.id ? { ...u, is_active: updated.is_active } : u
          );
          render();
          showToast(updated.is_active ? "User enabled" : "User disabled");
        } catch (err) {
          // rollback
          user.is_active = old;
          render();
          throw err;
        }
      }

      if (action === "delete") {
        openDeleteModal(user.id);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Action failed");
    } finally {
      // Re-enable
      allBtns.forEach((b) => (b.disabled = false));
    }
  });

  // ----------------------------
  // Tabs (persist)
  // ----------------------------
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("is-active"));
      t.classList.add("is-active");

      const label = (t.textContent || "").trim().toLowerCase();
      activeTab = label.includes("active")
        ? "active"
        : label.includes("disabled")
        ? "disabled"
        : "all";

      localStorage.setItem(LS.tab, activeTab);
      render();
    });
  });

  // restore saved tab
  const savedTab = localStorage.getItem(LS.tab);
  if (savedTab) {
    activeTab = savedTab;
    const btn = tabs.find((t) => (t.textContent || "").toLowerCase().includes(savedTab));
    if (btn) {
      tabs.forEach((x) => x.classList.remove("is-active"));
      btn.classList.add("is-active");
    }
  }

  // ----------------------------
  // Search/filter (debounced, persisted)
  // ----------------------------
  const rerenderDebounced = debounce(() => {
    localStorage.setItem(LS.search, searchInput?.value || "");
    render();
  }, 160);

  searchInput?.addEventListener("input", rerenderDebounced);

  deptFilter?.addEventListener("change", () => {
    localStorage.setItem(LS.dept, deptFilter.value || "");
    render();
  });

  // restore saved search/filter
  if (searchInput) searchInput.value = localStorage.getItem(LS.search) || "";
  if (deptFilter) deptFilter.value = localStorage.getItem(LS.dept) || "";

  // ----------------------------
  // Create user submit (wired)
  // NOTE: Your HTML still has onsubmit="...demoToast..."
  // We override by binding submit and preventing default.
  // ----------------------------
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const full_name = (fullNameInput?.value || "").trim();
    const username = (usernameInput?.value || "").trim().toLowerCase();
    const password = (generatedPassword?.value || "").trim();

    let role = normalizeSlug(roleSelect?.value || "staff");
    if (role !== "admin") role = "staff";

    const department =
      role === "admin" ? null : normalizeSlug(deptSelect?.value || "") || null;

    const is_active = statusSwitch?.getAttribute("aria-pressed") === "true";

    if (!full_name || !username || !password) {
      showToast("Full name, username, and password are required");
      return;
    }

    // Basic username validation
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      showToast("Username must be 3–20 chars (letters, numbers, underscore)");
      return;
    }

    try {
      // disable submit button while posting
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.8";
      }

      const created = await apiCreateUser({
        full_name,
        username,
        password,
        role,
        department,
        is_active,
      });

      showToast("User created");

      // refresh list (safer, also returns created_at, etc.)
      users = await apiGetUsers();
      render();

      // reset form fields
      if (fullNameInput) fullNameInput.value = "";
      if (usernameInput) usernameInput.value = "";
      if (generatedPassword) generatedPassword.value = "";
      if (strengthText) strengthText.textContent = "N/A";
      if (strengthBar) strengthBar.style.width = "0%";
      if (roleSelect) roleSelect.value = "staff";
      if (deptSelect) deptSelect.value = "";
      setStatusActive(true);
      syncRoleDeptUI();

      // nice: auto-copy password after create (optional)
      try {
        await navigator.clipboard.writeText(password);
        showToast("Created + password copied");
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Create failed");
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
      }
    }
  });

  // ----------------------------
  // Load initial users
  // ----------------------------
  (async () => {
    try {
      // tiny skeleton feel
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="muted">Loading users…</td></tr>`;
      users = await apiGetUsers();
      render();
      showToast("Users loaded", 1400);
    } catch (err) {
      console.error(err);
      showToast("Failed to load users");
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load users.</td></tr>`;
    }
  })();
});
