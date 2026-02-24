// static/js/users.js
// EpiSuite Admin Users (v2.4) — FIXED: initial load + loading spinners
// Endpoints:
//   GET    /admin/api/users
//   POST   /admin/api/users
//   PATCH  /admin/api/users/<id>/active
//   DELETE /admin/api/users/<id>

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------
    // DOM
    // ----------------------------
    const table = document.querySelector(".eu-table");
    const tableBody = document.querySelector(".eu-table tbody");

    const searchInput = document.querySelector(".eu-search");
    const deptFilter = document.querySelector(".eu-filter");
    const tabs = Array.from(document.querySelectorAll(".eu-tab"));

    const form =
      document.getElementById("createUserForm") ||
      document.querySelector(".eu-form");

    const fullNameInput = document.getElementById("fullName");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("passwordInput");

    const strengthText = document.getElementById("strengthText");
    const strengthBar = document.getElementById("strengthBar");

    const deptSelect = document.getElementById("departmentSelect");
    const roleSelect = document.getElementById("roleSelect");

    const statusSwitch = form?.querySelector(".eu-switch");
    const statusLabel = document.getElementById("statusLabel");

    const deleteModal = document.getElementById("deleteModal");

    // ----------------------------
    // Constants
    // ----------------------------
    const DEPARTMENTS = [
      { slug: "doctor", label: "Doctor" },
      { slug: "medical_officer", label: "Medical Officer" },
      { slug: "nurse", label: "Nurse" },
      { slug: "reception", label: "Customer Care / Reception" },
      { slug: "laboratory", label: "Laboratory" },
      { slug: "inventory", label: "Inventory" },
      { slug: "bdu", label: "Business Development Unit (BDU)" },
      { slug: "accountant", label: "Accountant" },
      { slug: "security_support", label: "Security & Support Staff" },
    ];

    const LS = {
      theme: "eu_theme",
      search: "eu_user_search",
      dept: "eu_user_dept",
      tab: "eu_user_tab",
      sort: "eu_user_sort",
    };

    // ----------------------------
    // State
    // ----------------------------
    let users = [];
    let activeTab = "all"; // all | active | disabled
    let sortState = { key: "created_at", dir: "desc" };
    let pendingDeleteId = null;

    // ----------------------------
    // Inject minimal spinner CSS (so you don't need to edit users.css)
    // ----------------------------
    (function injectSpinnerCSS() {
      const id = "eu_spinner_css";
      if (document.getElementById(id)) return;

      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        .btn-spinner{
          width:16px;height:16px;
          border-radius:50%;
          border:2px solid rgba(255,255,255,0.45);
          border-top-color: rgba(255,255,255,1);
          display:none;
          animation: euSpin 0.75s linear infinite;
        }
        .is-loading .btn-spinner{ display:inline-block; }
        .is-loading .btn-text{ opacity:.95; }
        @keyframes euSpin { to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(style);
    })();

    // ----------------------------
    // Toast (✓ / ✕)
    // ----------------------------
    let toastTimer = null;
    function showToast({ type = "success", text = "Done." } = {}) {
      const toast = document.getElementById("toast");
      const toastText = document.getElementById("toastText");
      const toastIcon = document.getElementById("toastIcon");

      if (!toast || !toastText || !toastIcon) {
        console[type === "error" ? "error" : "log"](text);
        return;
      }

      toast.classList.remove("is-success", "is-error", "is-show");
      clearTimeout(toastTimer);

      toastText.textContent = text;

      if (type === "error") {
        toast.classList.add("is-error");
        toastIcon.textContent = "✕";
      } else {
        toast.classList.add("is-success");
        toastIcon.textContent = "✓";
      }

      toast.classList.add("is-show");

      toastTimer = setTimeout(() => {
        toast.classList.remove("is-show");
      }, 3200);
    }

    // ----------------------------
    // Button loading helper (spinner + disable)
    // Expects:
    //   <button><span class="btn-spinner"></span><span class="btn-text">Create</span></button>
    // If not present, we auto-wrap button text.
    // ----------------------------
    function ensureButtonSpinner(btn) {
      if (!btn) return null;

      // if spinner exists, ok
      let spinner = btn.querySelector(".btn-spinner");
      let textEl = btn.querySelector(".btn-text");

      // auto-create structure if missing
      if (!spinner || !textEl) {
        const originalText = (btn.textContent || "").trim() || "Submit";
        btn.innerHTML = `
          <span class="btn-spinner" aria-hidden="true"></span>
          <span class="btn-text">${originalText}</span>
        `;
        spinner = btn.querySelector(".btn-spinner");
        textEl = btn.querySelector(".btn-text");
      }

      btn.style.display = btn.style.display || "inline-flex";
      btn.style.alignItems = "center";
      btn.style.gap = "10px";

      return { spinner, textEl };
    }

    function setBtnLoading(btn, isLoading, loadingText = "Loading…") {
      if (!btn) return;
      ensureButtonSpinner(btn);

      const textEl = btn.querySelector(".btn-text");
      btn.classList.toggle("is-loading", !!isLoading);
      btn.disabled = !!isLoading;
      btn.style.cursor = isLoading ? "not-allowed" : "pointer";
      btn.style.opacity = isLoading ? "0.9" : "1";

      if (textEl) {
        if (isLoading) {
          // save original
          if (!btn.dataset.originalText) btn.dataset.originalText = textEl.textContent;
          textEl.textContent = loadingText;
        } else {
          textEl.textContent = btn.dataset.originalText || textEl.textContent;
          btn.dataset.originalText = "";
        }
      }
    }

    // ----------------------------
    // Utils
    // ----------------------------
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

    function canonicalDeptSlug(slug) {
      const s = normalizeSlug(slug);
      if (s === "customer_care") return "reception";
      return s;
    }


    function safeText(s) {
      return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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

    function slugifyUsername(name) {
      const cleaned = String(name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleaned) return "";
      const parts = cleaned.split(" ");
      if (parts.length === 1) return parts[0];
      const first = parts[0][0] || "";
      const last = parts[parts.length - 1] || "";
      return (first + last).slice(0, 16);
    }

    function getUniqueUsername(base) {
      const existing = new Set(users.map((u) => String(u.username || "").toLowerCase()));
      if (!existing.has(base.toLowerCase())) return base;

      for (let i = 2; i <= 99; i++) {
        const candidate = `${base}${i}`;
        if (!existing.has(candidate.toLowerCase())) return candidate;
      }
      return base;
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
    // Theme
    // ----------------------------
    const themeBtn = document.querySelector("[data-theme-toggle]");
    function setTheme(mode) {
      document.documentElement.dataset.theme = mode;
      localStorage.setItem(LS.theme, mode);
    }
    function toggleTheme() {
      const current = localStorage.getItem(LS.theme) || "dark";
      setTheme(current === "dark" ? "light" : "dark");
      showToast({ type: "success", text: "Theme updated" });
    }
    themeBtn?.addEventListener("click", toggleTheme);
    setTheme(localStorage.getItem(LS.theme) || "dark");

    // ----------------------------
    // Dept filter options
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
    // Role/Dept sync
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
    // Status switch
    // ----------------------------
    function setStatusActive(active) {
      if (!statusSwitch) return;
      statusSwitch.setAttribute("aria-pressed", String(!!active));
      if (statusLabel) statusLabel.textContent = active ? "Active" : "Disabled";
    }
    setStatusActive(true);

    window.toggleStatus = (btn) => {
      const pressed = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", String(!pressed));
      if (statusLabel) statusLabel.textContent = !pressed ? "Active" : "Disabled";
    };

    // ----------------------------
    // Password generate/copy
    // ----------------------------
    window.generatePassword = () => {
      const pw = makePassword(14);
      if (passwordInput) passwordInput.value = pw;

      const s = passwordStrength(pw);
      if (strengthText) strengthText.textContent = s.label;
      if (strengthBar) strengthBar.style.width = `${s.pct}%`;

      showToast({ type: "success", text: "Password generated" });
    };

    window.copyPassword = async () => {
      const pw = (passwordInput?.value || "").trim();
      if (!pw) return showToast({ type: "error", text: "Type or generate a password first" });

      try {
        await navigator.clipboard.writeText(pw);
        showToast({ type: "success", text: "Password copied" });
      } catch {
        showToast({ type: "error", text: "Copy failed" });
      }
    };

    passwordInput?.addEventListener("input", () => {
      const pw = (passwordInput.value || "").trim();
      const s = passwordStrength(pw);
      if (strengthText) strengthText.textContent = s.label;
      if (strengthBar) strengthBar.style.width = `${s.pct}%`;
    });

    // username suggestion
    fullNameInput?.addEventListener(
      "input",
      debounce(() => {
        if (!usernameInput) return;
        const current = (usernameInput.value || "").trim();
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

    function enableHeaderSorting() {
      if (!table) return;
      const headers = table.querySelectorAll("thead th");
      const map = { 0: "full_name", 1: "username", 2: "department", 3: "status", 4: "last_login" };

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

    try {
      const savedSort = JSON.parse(localStorage.getItem(LS.sort) || "null");
      if (savedSort?.key) sortState = savedSort;
    } catch {}
    enableHeaderSorting();

    // ----------------------------
    // Render
    // ----------------------------
    function statusBadge(isActive) {
      return isActive
        ? `<span class="badge badge--green">Active</span>`
        : `<span class="badge badge--gray">Disabled</span>`;
    }

    function deptBadge(slug) {
      const label = deptLabelFromSlug(slug);
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
    // View modal (unchanged)
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
    // Delete modal + loading spinner on confirm
    // ----------------------------
    function openDeleteModal(userId) {
      pendingDeleteId = userId;

      if (!deleteModal) {
        showToast({ type: "error", text: "Delete modal not found" });
        return;
      }

      deleteModal.setAttribute("aria-hidden", "false");
      deleteModal.classList.add("is-open");

      const focusBtn =
        deleteModal.querySelector("button.eu-btn--danger") ||
        deleteModal.querySelector("button");
      focusBtn?.focus?.();
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

      const confirmBtn =
        deleteModal?.querySelector("button.eu-btn--danger") ||
        deleteModal?.querySelector('[data-confirm-delete="true"]');

      // show spinner on confirm button while deleting
      setBtnLoading(confirmBtn, true, "Deleting…");

      // lock all buttons too
      const modalBtns = deleteModal?.querySelectorAll("button") || [];
      modalBtns.forEach((b) => (b.disabled = true));
      // but keep confirm enabled state managed by setBtnLoading
      if (confirmBtn) confirmBtn.disabled = true;

      try {
        await apiDeleteUser(id);
        users = users.filter((u) => String(u.id) !== String(id));
        render();
        showToast({ type: "success", text: "User deleted" });
      } catch (err) {
        console.error(err);
        showToast({ type: "error", text: err?.message || "Delete failed" });
      } finally {
        // unlock
        modalBtns.forEach((b) => (b.disabled = false));
        setBtnLoading(confirmBtn, false);
        closeDeleteModal();
      }
    }

    window.openDeleteModal = openDeleteModal;
    window.closeDeleteModal = closeDeleteModal;
    window.confirmDelete = confirmDelete;

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDeleteModal();
    });

    deleteModal?.addEventListener("click", (e) => {
      if (e.target.classList.contains("eu-modal-backdrop")) closeDeleteModal();
    });

    // ----------------------------
    // Table actions
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

      const allBtns = row.querySelectorAll("button[data-action]");
      allBtns.forEach((b) => (b.disabled = true));

      try {
        if (action === "view") {
          openViewModal(user);
          return;
        }

        if (action === "toggle") {
          const old = user.is_active;
          user.is_active = !old;
          render();

          try {
            const updated = await apiSetActive(user.id, user.is_active);
            users = users.map((u) =>
              u.id === user.id ? { ...u, is_active: updated.is_active } : u
            );
            render();
            showToast({ type: "success", text: updated.is_active ? "User enabled" : "User disabled" });
          } catch (err) {
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
        showToast({ type: "error", text: err.message || "Action failed" });
      } finally {
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
    // Search/filter (persist)
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

    if (searchInput) searchInput.value = localStorage.getItem(LS.search) || "";
    if (deptFilter) deptFilter.value = localStorage.getItem(LS.dept) || "";

    // ----------------------------
    // Create user submit + spinner on submit button
    // ----------------------------
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const full_name = (fullNameInput?.value || "").trim();
      const username = (usernameInput?.value || "").trim().toLowerCase();
      const password = (passwordInput?.value || "").trim();

      let role = normalizeSlug(roleSelect?.value || "staff");
      role = role === "admin" ? "admin" : "staff";

      const department =
        role === "admin" ? null : canonicalDeptSlug(deptSelect?.value || "") || null;

      const is_active = statusSwitch?.getAttribute("aria-pressed") === "true";

      if (!full_name || !username || !password) {
        showToast({ type: "error", text: "Full name, username and password are required." });
        return;
      }

      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        showToast({ type: "error", text: "Username must be 3–30 chars (letters, numbers, underscore)." });
        return;
      }

      if (password.length < 8) {
        showToast({ type: "error", text: "Password must be at least 8 characters." });
        return;
      }

      if (role === "staff" && !department) {
        showToast({ type: "error", text: "Select a department for staff user." });
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      setBtnLoading(submitBtn, true, "Creating…");

      try {
        await apiCreateUser({ full_name, username, password, role, department, is_active });

        showToast({ type: "success", text: "User created successfully." });

        // ✅ reload list immediately so table always shows correct state
        users = await apiGetUsers();
        render();

        // reset inputs
        form.reset();
        if (roleSelect) roleSelect.value = "staff";
        if (deptSelect) deptSelect.value = "";
        setStatusActive(true);
        syncRoleDeptUI();

        if (strengthText) strengthText.textContent = "N/A";
        if (strengthBar) strengthBar.style.width = "0%";

        // optional auto-copy password
        try {
          await navigator.clipboard.writeText(password);
          showToast({ type: "success", text: "Created + password copied." });
        } catch {}
      } catch (err) {
        console.error(err);
        showToast({ type: "error", text: err.message || "Create failed" });
      } finally {
        setBtnLoading(submitBtn, false);
      }
    });

    // ----------------------------
    // ✅ FIX #2: Load users table immediately on page open
    // ----------------------------
    async function loadUsersNow() {
      try {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="muted">Loading users…</td></tr>`;
        users = await apiGetUsers();
        render();
      } catch (err) {
        console.error(err);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load users.</td></tr>`;
        showToast({ type: "error", text: "Failed to load users" });
      }
    }

    // IMPORTANT: do not wait for anything else — load immediately
    loadUsersNow();
  });
})();