/* ==========================================================================
   EPICONSULT e-CLINIC — PATIENT RECORDS UI ENGINE (2025)
   FINAL MODAL-SAFE BUILD — AUTO-DETECT EXECUTION CONTEXT
========================================================================== */

/**
 * IMPORTANT:
 * This script is injected dynamically AFTER records.html is inserted inside the modal.
 * DOMContentLoaded ALREADY FIRED — so DO NOT wrap anything in DOMContentLoaded.
 */

(function initRecords() {

  /* ==========================================================================
     1️⃣ ENSURE SCRIPT RUNS ONLY INSIDE MODAL
  ========================================================================== */

  const requiredRoot = document.querySelector("#recordsTable");

  if (!requiredRoot) {
    console.warn("[records.js] #recordsTable not found — script loaded outside modal, skipping…");
    return;
  }

  if (window.__EPIC_RECORDS_BOUND__) {
    console.warn("[records.js] Already initialized — skipping rebinding");
    return;
  }
  window.__EPIC_RECORDS_BOUND__ = true;

  console.log(
    "%c[records.js] Initialized successfully (Modal Build Ready)",
    "color:#1e40af;font-weight:700"
  );

  /* ==========================================================================
     2️⃣ SELECTORS
  ========================================================================== */

  const btnFetch = document.querySelector("#btnFetchRecords");
  const table = document.querySelector("#recordsTable");
  const tbody = document.querySelector("#recordsTableBody");
  const emptyState = document.querySelector("#recordsEmptyState");

  const searchInput = document.querySelector("#recordsSearchInput");
  const suggestionsBox = document.querySelector("#recordsSearchSuggestions");

  // RIGHT PANEL
  const ppName = document.querySelector("#ppFullName");
  const ppFileNo = document.querySelector("#ppFileNo");
  const ppPatientId = document.querySelector("#ppPatientId");
  const ppSex = document.querySelector("#ppSex");
  const ppAge = document.querySelector("#ppAge");
  const ppDob = document.querySelector("#ppDob");
  const ppPhone = document.querySelector("#ppPhone");
  const ppEmail = document.querySelector("#ppEmail");
  const ppAddress = document.querySelector("#ppAddress");
  const ppAvatar = document.querySelector("#patientAvatarInitialsFixed");

  const ppNotes = document.querySelector("#ppNotes");
  const ppNotesLength = document.querySelector("#ppNotesLength");

  const ppAvailableServices = document.querySelector("#ppAvailableServices");
  const ppSelectedServices = document.querySelector("#ppSelectedServices");
  const ppSelectedServicesEmpty = document.querySelector("#ppSelectedServicesEmpty");

  const ppServiceCategory = document.querySelector("#ppServiceCategory");
  const ppServiceSearch = document.querySelector("#ppServiceSearch");

  const ppServicesCount = document.querySelector("#ppServicesCount");
  const ppTotalAmount = document.querySelector("#ppTotalAmount");

  const stateBadge = document.querySelector("#patientPanelStateBadge");

  /* ==========================================================================
     3️⃣ TEMP STORAGE & PAGINATION STATE
  ========================================================================== */

  const LOCAL_TEMP = {
    notes: {},
    selectedServices: {},
  };

  // Pagination state
  let ALL_RECORDS = [];
  let currentPage = 1;
  let pageSize = 25;

  // Pagination elements
  const pageSizeSelect = document.querySelector("#recordsPageSize");
  const rangeStart = document.querySelector("#records-range-start");
  const rangeEnd = document.querySelector("#records-range-end");
  const totalCount = document.querySelector("#records-total-count");
  const currentPageInput = document.querySelector("#recordsCurrentPageInput");
  const totalPagesSpan = document.querySelector("#recordsTotalPages");
  const paginationBar = document.querySelector("#recordsPaginationBar");
  const firstPageBtn = document.querySelector("#recordsFirstPageBtn");
  const prevPageBtn = document.querySelector("#recordsPrevPageBtn");
  const nextPageBtn = document.querySelector("#recordsNextPageBtn");
  const lastPageBtn = document.querySelector("#recordsLastPageBtn");
  const goToPageBtn = document.querySelector("#recordsGoToPageBtn");

  /* ==========================================================================
     4️⃣ API WRAPPER
  ========================================================================== */

  async function api(url) {
    try {
      const res = await fetch(url, {
        credentials: 'same-origin',  // Send session cookies
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if response is OK
      if (!res.ok) {
        console.error(`[API] HTTP ${res.status} for ${url}`);
        const text = await res.text();
        console.error("[API] Response body:", text.substring(0, 200));
        
        // If redirected to login - could be DB connection issue, not session
        if (text.includes("Login") || text.includes("login")) {
          console.warn("[API] Redirected to login - likely DB connection issue");
          // Don't redirect, just return error - let user retry
          return { success: false, error: "Connection issue - please try again" };
        }
        
        return { success: false, error: `HTTP ${res.status}` };
      }
      
      // Check content type
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error(`[API] Expected JSON but got: ${contentType}`);
        const text = await res.text();
        console.error("[API] Response body:", text.substring(0, 200));
        
        // If HTML returned, likely a DB connection issue causing auth failure
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          console.warn("[API] Got HTML instead of JSON - DB connection may have failed");
          return { success: false, error: "Connection issue - please try again" };
        }
        
        return { success: false, error: "Server returned non-JSON response" };
      }
      
      return await res.json();
    } catch (err) {
      console.error("[API ERROR]", err);
      return { success: false, error: err.message };
    }
  }

  /* ==========================================================================
     5️⃣ RENDER TABLE WITH PAGINATION
  ========================================================================== */

  function getTotalPages() {
    return Math.ceil(ALL_RECORDS.length / pageSize) || 1;
  }

  function getCurrentPageRecords() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return ALL_RECORDS.slice(start, end);
  }

  function updatePaginationUI() {
    const total = ALL_RECORDS.length;
    const totalPages = getTotalPages();
    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);

    // Update range display
    if (rangeStart) rangeStart.textContent = start;
    if (rangeEnd) rangeEnd.textContent = end;
    if (totalCount) totalCount.textContent = total;

    // Update page info
    if (currentPageInput) currentPageInput.value = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;

    // Enable/disable buttons
    const isFirstPage = currentPage === 1;
    const isLastPage = currentPage >= totalPages;

    if (firstPageBtn) firstPageBtn.disabled = isFirstPage;
    if (prevPageBtn) prevPageBtn.disabled = isFirstPage;
    if (nextPageBtn) nextPageBtn.disabled = isLastPage;
    if (lastPageBtn) lastPageBtn.disabled = isLastPage;

    // Show/hide pagination bar
    if (paginationBar) paginationBar.hidden = total === 0;
  }

  function renderCurrentPage() {
    const records = getCurrentPageRecords();
    tbody.innerHTML = "";

    if (ALL_RECORDS.length === 0) {
      emptyState.hidden = false;
      table.hidden = true;
      updatePaginationUI();
      return;
    }

    emptyState.hidden = true;
    table.hidden = false;

    records.forEach(rec => {
      const id = rec.id || "";
      const fileNo = rec.file_no || "-";
      const pid = rec.patient_id || "-";
      const name = `${rec.first_name || ""} ${rec.last_name || ""}`.trim();
      const age = rec.age || "-";
      const sex = rec.sex || "-";
      const phone = rec.phone || "-";
      const email = rec.email || "-";
      const address = rec.address || "-";
      const dob = rec.date_of_birth || "-";

      const row = document.createElement("tr");
      row.className = "records-row";
      row.dataset.identifier = fileNo || pid;

      row.innerHTML = `
        <td class="col-select"><input type="checkbox" class="row-select" /></td>
        <td>${id}</td>
        <td>${fileNo}</td>
        <td>${pid}</td>
        <td class="cell-full-name">${name}</td>
        <td>${dob}</td>
        <td>${age}</td>
        <td>${sex}</td>
        <td>${phone}</td>
        <td>${email}</td>
        <td>${address}</td>
        <td>
          <span class="status-chip ${phone !== "-" || email !== "-" ? "status-chip-ok" : "status-chip-warn"}">
            ${phone !== "-" || email !== "-" ? "Complete" : "Missing"}
          </span>
        </td>
        <td>
          <button type="button" class="btn-row-open">
            <i class="fa-solid fa-up-right-from-square"></i>
          </button>
        </td>
      `;

      // open panel on row click
      row.addEventListener("click", e => {
        if (e.target.closest("input.row-select")) return;
        if (e.target.closest(".btn-row-open")) return;
        loadPatientIntoPanel(row.dataset.identifier);
      });

      // open button
      row.querySelector(".btn-row-open").addEventListener("click", e => {
        e.stopPropagation();
        loadPatientIntoPanel(row.dataset.identifier);
      });

      tbody.appendChild(row);
    });

    updatePaginationUI();
  }

  function renderTable(records) {
    ALL_RECORDS = records || [];
    currentPage = 1;
    renderCurrentPage();
  }

  /* ==========================================================================
     5️⃣b PAGINATION EVENT HANDLERS
  ========================================================================== */

  // Page size change
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      pageSize = parseInt(pageSizeSelect.value, 10) || 25;
      currentPage = 1; // Reset to first page
      renderCurrentPage();
    });
  }

  // First page
  if (firstPageBtn) {
    firstPageBtn.addEventListener("click", () => {
      currentPage = 1;
      renderCurrentPage();
    });
  }

  // Previous page
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderCurrentPage();
      }
    });
  }

  // Next page
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      if (currentPage < getTotalPages()) {
        currentPage++;
        renderCurrentPage();
      }
    });
  }

  // Last page
  if (lastPageBtn) {
    lastPageBtn.addEventListener("click", () => {
      currentPage = getTotalPages();
      renderCurrentPage();
    });
  }

  // Go to specific page
  if (goToPageBtn && currentPageInput) {
    goToPageBtn.addEventListener("click", () => {
      const page = parseInt(currentPageInput.value, 10);
      if (page >= 1 && page <= getTotalPages()) {
        currentPage = page;
        renderCurrentPage();
      } else {
        currentPageInput.value = currentPage;
      }
    });

    // Also allow Enter key
    currentPageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        goToPageBtn.click();
      }
    });
  }

  /* ==========================================================================
     6️⃣ FETCH ALL PATIENTS
  ========================================================================== */

  async function fetchAllPatients() {
    btnFetch.dataset.state = "loading";

    const res = await api("/records/all");

    btnFetch.dataset.state = "idle";

    if (!res.success) {
      alert("Unable to load records. Check your connection and try again.");
      return;
    }

    const records = res.records || [];
    renderTable(records);

    // Update summary counts
    const cntElem = document.querySelector("#records-summary-count");
    if (cntElem) cntElem.textContent = records.length;

    // Update mini stats
    const statTotal = document.querySelector("#recordsStatTotal");
    const statMale = document.querySelector("#recordsStatMale");
    const statFemale = document.querySelector("#recordsStatFemale");
    const statNoContact = document.querySelector("#recordsStatNoContact");
    const statUpdated = document.querySelector("#recordsStatUpdated");

    if (statTotal) statTotal.textContent = records.length;
    if (statMale) statMale.textContent = records.filter(r => r.sex === "Male").length;
    if (statFemale) statFemale.textContent = records.filter(r => r.sex === "Female").length;
    if (statNoContact) statNoContact.textContent = records.filter(r => !r.phone && !r.email).length;
    if (statUpdated) statUpdated.textContent = new Date().toLocaleTimeString();

    // Update last sync time
    const lastSync = document.querySelector("#records-last-sync-value");
    if (lastSync) lastSync.textContent = new Date().toLocaleTimeString();
  }

  btnFetch.addEventListener("click", fetchAllPatients);

  /* ==========================================================================
     7️⃣ SEARCH
  ========================================================================== */

  let searchDebounce = null;

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    if (!q) return (suggestionsBox.hidden = true);

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => liveSearch(q), 200);
  });

  async function liveSearch(q) {
    const res = await api(`/records/search?q=${encodeURIComponent(q)}`);

    if (!res.success || !res.results.length) {
      suggestionsBox.hidden = true;
      return;
    }

    suggestionsBox.innerHTML = "";
    res.results.forEach(p => {
      const id = p.patient_id || p.file_no;
      const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();

      const btn = document.createElement("button");
      btn.className = "suggestion-item";
      btn.dataset.id = id;

      btn.innerHTML = `
        <div class="suggestion-main">
          <span class="suggestion-name">${name}</span>
          <span class="suggestion-meta">File: ${p.file_no || "-"} • ID: ${p.patient_id || "-"}</span>
        </div>
        <span class="suggestion-tag">Open</span>
      `;

      btn.addEventListener("click", () => {
        loadPatientIntoPanel(id);
        suggestionsBox.hidden = true;
      });

      suggestionsBox.appendChild(btn);
    });

    suggestionsBox.hidden = false;
  }

  /* ==========================================================================
     8️⃣ LOAD PATIENT INTO RIGHT PANEL
  ========================================================================== */

  async function loadPatientIntoPanel(identifier) {
    stateBadge.textContent = "Loading…";

    const res = await api(`/records/get/${encodeURIComponent(identifier)}`);
    if (!res.success) {
      alert("Unable to load patient");
      stateBadge.textContent = "Error";
      return;
    }

    const p = res.patient || {};
    const firstName = p.first_name || "";
    const lastName = p.last_name || "";
    const name = `${firstName} ${lastName}`.trim();

    // Set avatar initials
    if (ppAvatar) {
      const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "?";
      ppAvatar.textContent = initials;
    }

    ppName.textContent = name || "Unknown";
    ppFileNo.textContent = `File: ${p.file_no || "-"}`;
    ppPatientId.textContent = `ID: ${p.patient_id || "-"}`;
    ppSex.textContent = p.sex || "-";
    ppAge.textContent = p.age || "-";
    ppDob.textContent = p.date_of_birth || "-";
    ppPhone.textContent = p.phone || "-";
    ppEmail.textContent = p.email || "-";
    ppAddress.textContent = p.address || "-";

    // Notes
    const savedNotes = LOCAL_TEMP.notes[identifier] || "";
    ppNotes.value = savedNotes;
    ppNotesLength.textContent = `${savedNotes.length} characters`;

    // Services
    LOCAL_TEMP.selectedServices[identifier] ??= [];
    renderSelectedServices(identifier);

    // Highlight selected row in table
    const allRows = tbody.querySelectorAll(".records-row");
    allRows.forEach(r => r.classList.remove("row-selected"));
    const selectedRow = tbody.querySelector(`.records-row[data-identifier="${identifier}"]`);
    if (selectedRow) selectedRow.classList.add("row-selected");

    stateBadge.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Loaded`;
  }

  /* ==========================================================================
     9️⃣ NOTES
  ========================================================================== */

  ppNotes.addEventListener("input", () => {
    const identifier = ppPatientId.textContent.trim();
    if (!identifier) return;

    LOCAL_TEMP.notes[identifier] = ppNotes.value;
    ppNotesLength.textContent = `${ppNotes.value.length} characters`;
  });

  /* ==========================================================================
     🔟 SERVICES
  ========================================================================== */

  let ALL_SERVICES = [];

  async function loadServices() {
    const res = await api("/records/services");
    if (!res.success) return;

    ALL_SERVICES = res.services || [];

    const categories = [...new Set(ALL_SERVICES.map(s => s.category || "Other"))];
    ppServiceCategory.innerHTML = `<option value="">All categories</option>`;
    categories.forEach(c =>
      (ppServiceCategory.innerHTML += `<option value="${c}">${c}</option>`)
    );

    renderAvailableServices();
  }

  loadServices();

  function renderAvailableServices() {
    const cat = ppServiceCategory.value;
    const q = ppServiceSearch.value.toLowerCase();

    const filtered = ALL_SERVICES.filter(s => {
      const matchCat = !cat || s.category === cat;
      const matchText = s.name.toLowerCase().includes(q);
      return matchCat && matchText;
    });

    ppAvailableServices.innerHTML = "";

    filtered.forEach(s => {
      const btn = document.createElement("button");
      btn.className = "service-item-btn";
      btn.textContent = `${s.name} — ₦${s.price}`;
      btn.addEventListener("click", () => addServiceToCurrent(s));
      ppAvailableServices.appendChild(btn);
    });
  }

  ppServiceCategory.addEventListener("change", renderAvailableServices);
  ppServiceSearch.addEventListener("input", renderAvailableServices);

  /* ==========================================================================
     1️⃣1️⃣ ADD / REMOVE SERVICES
  ========================================================================== */

  function addServiceToCurrent(service) {
    const identifier = ppPatientId.textContent.trim();
    if (!identifier) return;

    LOCAL_TEMP.selectedServices[identifier].push(service);
    renderSelectedServices(identifier);
  }

  function renderSelectedServices(identifier) {
    const list = LOCAL_TEMP.selectedServices[identifier] || [];

    ppSelectedServices.innerHTML = "";
    ppSelectedServicesEmpty.style.display = list.length ? "none" : "block";

    let total = 0;

    list.forEach((srv, i) => {
      total += srv.price;

      const row = document.createElement("div");
      row.className = "svc-selected-row";

      row.innerHTML = `
        <span class="svc-title">${srv.name}</span>
        <span class="svc-price">₦${srv.price}</span>
        <button class="svc-remove">&times;</button>
      `;

      row.querySelector(".svc-remove").addEventListener("click", () => {
        LOCAL_TEMP.selectedServices[identifier].splice(i, 1);
        renderSelectedServices(identifier);
      });

      ppSelectedServices.appendChild(row);
    });

    ppServicesCount.textContent = list.length;
    ppTotalAmount.textContent = list.length ? `₦${total}` : "–";
  }

})(); // END INIT WRAPPER
