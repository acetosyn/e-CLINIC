/* ==========================================================================
   EPICONSULT e-CLINIC — PATIENT RECORDS ENGINE (Supabase)
   Server-side pagination + Live Search
   Scope: records.html ONLY
========================================================================== */

(() => {
  "use strict";

  /* ======================================================================
     1. CORE SELECTORS
  ====================================================================== */
  const tableHead = document.querySelector(".records-table thead");
  const tableBody = document.getElementById("recordsTableBody");

  const searchInput = document.getElementById("globalSearchInput");
  const clearSearchBtn = document.querySelector(".search-clear-btn");

  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");

  const currentPageEl = document.getElementById("currentPage");
  const totalPagesEl = document.getElementById("totalPages");

  const totalRecordsCount = document.getElementById("totalRecordsCount");
  const renderedRecordsCount = document.getElementById("renderedRecordsCount");

  const startRecordEl = document.getElementById("startRecord");
  const endRecordEl = document.getElementById("endRecord");
  const totalRecordsEl = document.getElementById("totalRecords");

  const previewEmpty = document.getElementById("previewEmpty");
  const previewContent = document.getElementById("previewContent");

  /* Preview fields */
  const pv = {
    fullName: document.getElementById("preview-full-name"),
    patientId: document.getElementById("preview-patient-id"),
    fileNo: document.getElementById("preview-file-no"),
    sex: document.getElementById("preview-sex"),
    age: document.getElementById("preview-age"),
    email: document.getElementById("preview-email"),
    phone: document.getElementById("preview-phone"),
  };

  /* ======================================================================
     2. STATE (Server-side pagination)
  =======================================================================*/
  let currentRecords = [];  // Current page's records only
  let totalRecords = 0;     // Total from Supabase
  let currentPage = 1;
  let pageSize = parseInt(pageSizeSelect?.value, 10) || 25;
  let currentSearchQuery = "";
  let selectedRowId = null;
  let searchTimeout = null;

  /* ======================================================================
     3. LOAD DATA FROM SUPABASE (Server-side Pagination)
  ====================================================================== */
  async function loadRecords() {
    console.log(`[Records] Loading page ${currentPage} (${pageSize} per page)...`);
    
    // Show loading state
    if (tableBody) {
      tableBody.innerHTML = `
        <tr class="loading-row">
          <td colspan="11">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading patients...
          </td>
        </tr>
      `;
    }

    try {
      // Wait for Supabase to be ready
      if (!window.Supabase || !window.Supabase.Patients) {
        console.error("[Records] Supabase module not loaded!");
        showError("Supabase not ready. Please refresh the page.");
        return;
      }

      const result = await window.Supabase.Patients.fetchPage(currentPage, pageSize, currentSearchQuery);

      if (result.success) {
        currentRecords = result.records || [];
        totalRecords = result.total || 0;

        if (totalRecordsCount) totalRecordsCount.textContent = totalRecords;
        console.log(`[Records] Loaded ${currentRecords.length} patients (total: ${totalRecords})`);
        
        renderTable();
        updatePagination();
        updateFooter();
      } else {
        console.error("[Records] Fetch failed:", result.message);
        showError(result.message || "Failed to load patients");
      }
    } catch (err) {
      console.error("[Records] Load error:", err);
      showError("Error loading records. Check console.");
    }
  }

  function showError(message) {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="11">
            <i class="fa-solid fa-exclamation-triangle"></i>
            ${escapeHtml(message)}
            <br><br>
            <button onclick="location.reload()" class="btn-row-open" style="width: auto; padding: 8px 16px;">
              <i class="fa-solid fa-refresh"></i> Retry
            </button>
          </td>
        </tr>
      `;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /* ======================================================================
     4. RENDER HEADER ROW
  ====================================================================== */
  function renderHeader() {
    if (!tableHead) return;
    
    tableHead.innerHTML = "";
    
    const tr = document.createElement("tr");
    tr.className = "header-row";
    
    const headers = [
      "File No",
      "Patient ID", 
      "First Name",
      "Last Name",
      "Sex",
      "Age",
      "Email",
      "Phone",
      "Status",
      "Category",
      "Actions"
    ];
    
    headers.forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      tr.appendChild(th);
    });
    
    tableHead.appendChild(tr);
  }

  /* ======================================================================
     5. RENDER TABLE BODY
  ====================================================================== */
  function renderTable() {
    if (!tableBody) return;
    
    // Render header first
    renderHeader();
    
    tableBody.innerHTML = "";

    if (currentRecords.length === 0) {
      tableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="11">
            <i class="fa-solid fa-folder-open"></i>
            ${currentSearchQuery 
              ? 'No patients found matching "' + escapeHtml(currentSearchQuery) + '"' 
              : 'No patients found.'}
          </td>
        </tr>
      `;
      if (renderedRecordsCount) renderedRecordsCount.textContent = 0;
      return;
    }

    currentRecords.forEach(rec => {
      const tr = document.createElement("tr");
      tr.className = "records-row";
      tr.dataset.id = rec.file_no || rec.patient_id;

      tr.innerHTML = `
        <td>${escapeHtml(rec.file_no) || '-'}</td>
        <td>${escapeHtml(rec.patient_id) || '-'}</td>
        <td>${escapeHtml(rec.first_name) || '-'}</td>
        <td>${escapeHtml(rec.last_name) || '-'}</td>
        <td>${escapeHtml(rec.sex) || '-'}</td>
        <td>${rec.age || '-'}</td>
        <td>${escapeHtml(rec.email) || '-'}</td>
        <td>${escapeHtml(rec.phone) || '-'}</td>
        <td>${escapeHtml(rec.account_status) || '-'}</td>
        <td>${escapeHtml(rec.category) || '-'}</td>
        <td>
          <button class="btn-row-open" title="View patient">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </td>
      `;

      tr.addEventListener("click", () => selectRecord(rec, tr));
      tableBody.appendChild(tr);
    });

    if (renderedRecordsCount) renderedRecordsCount.textContent = currentRecords.length;
  }

  /* ======================================================================
     5. PREVIEW PANEL SYNC
  ====================================================================== */
  function selectRecord(rec, rowEl) {
    document.querySelectorAll(".records-row").forEach(r => r.classList.remove("row-selected"));
    rowEl.classList.add("row-selected");
    selectedRowId = rowEl.dataset.id;

    if (previewEmpty) previewEmpty.classList.add("hidden");
    if (previewContent) previewContent.classList.remove("hidden");

    if (pv.fullName) pv.fullName.textContent = `${rec.first_name || ""} ${rec.last_name || ""}`.trim() || "—";
    if (pv.patientId) pv.patientId.textContent = rec.patient_id || "—";
    if (pv.fileNo) pv.fileNo.textContent = rec.file_no || "—";
    if (pv.sex) pv.sex.textContent = rec.sex || "—";
    if (pv.age) pv.age.textContent = rec.age || "—";
    if (pv.email) pv.email.textContent = rec.email || "—";
    if (pv.phone) pv.phone.textContent = rec.phone || "—";
  }

  /* ======================================================================
     6. LIVE SEARCH (Server-side, debounced)
  ====================================================================== */
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      const value = e.target.value.trim();
      
      // Debounce search
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearchQuery = value;
        currentPage = 1;
        loadRecords();
      }, 300);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      currentSearchQuery = "";
      currentPage = 1;
      loadRecords();
    });
  }

  /* ======================================================================
     7. PAGINATION
  ====================================================================== */
  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;

    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadRecords();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      const totalPages = Math.ceil(totalRecords / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        loadRecords();
      }
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      pageSize = parseInt(pageSizeSelect.value, 10) || 25;
      currentPage = 1;
      loadRecords();
    });
  }

  /* ======================================================================
     8. FOOTER COUNTS
  ====================================================================== */
  function updateFooter() {
    const total = totalRecords;
    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);

    if (startRecordEl) startRecordEl.textContent = start;
    if (endRecordEl) endRecordEl.textContent = end;
    if (totalRecordsEl) totalRecordsEl.textContent = total;
  }

  /* ======================================================================
     9. INIT — Wait for Supabase
  ====================================================================== */
  function init() {
    if (window.Supabase && window.Supabase.Patients) {
      console.log("[Records] Supabase ready, loading records...");
      loadRecords();
    } else {
      console.log("[Records] Waiting for Supabase...");
      setTimeout(init, 200);
    }
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ======================================================================
   PREVIEW FLOATING STATE (outside IIFE for global access)
====================================================================== */
const previewPanel = document.getElementById("recordsPreview");
const previewFab = document.getElementById("previewFab");
const previewMinBtn = document.getElementById("previewMinimizeBtn");

if (previewFab) previewFab.addEventListener("click", () => previewPanel?.classList.remove("is-collapsed"));
if (previewMinBtn) previewMinBtn.addEventListener("click", () => previewPanel?.classList.add("is-collapsed"));

/* ======================================================================
   PREVIEW COPY HANDLERS
====================================================================== */
document.addEventListener("click", (event) => {
  const btn = event.target.closest(".copy-btn");
  if (!btn) return;

  const targetId = btn.dataset.copyTarget;
  if (!targetId) return;

  const valueEl = document.getElementById(targetId);
  if (!valueEl) return;

  const text = valueEl.textContent.trim();
  if (!text || text === "—") return;

  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add("copied");
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = '<i class="fa-regular fa-clone"></i>';
    }, 1200);
  }).catch(err => console.error("Copy failed:", err));
});
