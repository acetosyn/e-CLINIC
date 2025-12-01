/* ===========================================================
   EPICONSULT — RECORDS MODAL HANDLER (records_modal.js)
   Handles loading/unloading of records.html into fullscreen modal
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  const recordsModal = document.getElementById("recordsFullModal");
  const recordsModalBody = document.getElementById("recordsModalBody");
  const closeRecordsModal = document.getElementById("closeRecordsModal");

  // Buttons that open the modal
  const recordsTriggers = document.querySelectorAll(
    ".open-records-btn, .action-card[title='View patient records']"
  );

  if (!recordsModal || !recordsModalBody) {
    console.warn("❌ Records modal container missing in HTML.");
    return;
  }

  /* ------------------------------------------------------
     OPEN MODAL → FETCH /records
  ------------------------------------------------------ */
  recordsTriggers.forEach(btn => {
    btn.addEventListener("click", async (e) => {

      if (!e.isTrusted) {
        console.warn("⚠️ Blocked auto-triggered modal opening.");
        return;
      }

      e.preventDefault();

      // Show modal shell
      recordsModal.removeAttribute("hidden");
      recordsModalBody.innerHTML = `
        <div style="padding:2rem;text-align:center;">
          Loading patient records...
        </div>
      `;

      try {
        const res = await fetch("/records");
        const html = await res.text();

        // Inject content
        recordsModalBody.innerHTML = html;

        /* ------------------------------------------------------
           INTERNAL CLOSE BUTTONS INSIDE records.html
        ------------------------------------------------------ */

        // 1️⃣ Close "Back to Dashboard" button
        const internalBackBtn = recordsModalBody.querySelector("#records-close-btn");
        if (internalBackBtn) {
          internalBackBtn.addEventListener("click", () => {
            recordsModal.setAttribute("hidden", true);
          });
        }

        // 2️⃣ NEW Close X button
        const closeX = recordsModalBody.querySelector("#recordsCloseX");
        if (closeX) {
          closeX.addEventListener("click", () => {
            recordsModal.setAttribute("hidden", true);
          });
        }

        // 3️⃣ Initialize search and fetch functionality
        initRecordsSearchAndFetch(recordsModalBody);

      } catch (err) {
        console.error("❌ Failed loading records:", err);
        recordsModalBody.innerHTML = `
          <div style="padding:2rem;color:red;text-align:center;">
            Could not load patient records.
          </div>
        `;
      }
    });
  });

  /* ------------------------------------------------------
     TOP-RIGHT CLOSE BUTTON (GLOBAL)
  ------------------------------------------------------ */
  if (closeRecordsModal) {
    closeRecordsModal.addEventListener("click", () => {
      recordsModal.setAttribute("hidden", true);
    });
  }

  /* ------------------------------------------------------
     OUTSIDE CLICK TO CLOSE
  ------------------------------------------------------ */
  recordsModal.addEventListener("click", (e) => {
    if (e.target === recordsModal) {
      recordsModal.setAttribute("hidden", true);
    }
  });

  /* ------------------------------------------------------
     ESC KEY TO CLOSE
  ------------------------------------------------------ */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !recordsModal.hasAttribute("hidden")) {
      recordsModal.setAttribute("hidden", true);
    }
  });

});

/* ===========================================================
   RECORDS SEARCH & FETCH FUNCTIONALITY
=========================================================== */

function initRecordsSearchAndFetch(container) {
  const searchInput = container.querySelector("#recordsSearchInput");
  const fetchBtn = container.querySelector("#btnFetchRecords");
  const tableBody = container.querySelector("#recordsTableBody");
  const recordsTable = container.querySelector("#recordsTable");
  const emptyState = container.querySelector("#recordsEmptyState");
  const suggestionsDiv = container.querySelector("#recordsSearchSuggestions");
  
  let searchTimeout = null;
  let currentRecords = [];
  let currentPage = 1;
  let recordsPerPage = 25;

  // Initialize search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      
      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      // Hide suggestions if empty
      if (!query) {
        if (suggestionsDiv) suggestionsDiv.setAttribute("hidden", true);
        return;
      }
      
      // Debounce search (wait 300ms after user stops typing)
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 300);
    });

    // Show suggestions on focus if there's a value
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim() && suggestionsDiv) {
        suggestionsDiv.removeAttribute("hidden");
      }
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
      if (suggestionsDiv && !searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
        suggestionsDiv.setAttribute("hidden", true);
      }
    });
  }

  // Fetch Records button
  if (fetchBtn) {
    fetchBtn.addEventListener("click", async () => {
      await fetchAllRecords();
    });
  }

  // Perform search
  async function performSearch(query) {
    if (!query || query.length < 2) {
      if (suggestionsDiv) suggestionsDiv.setAttribute("hidden", true);
      return;
    }

    try {
      // Update connection state
      updateConnectionState("Searching...", "searching");
      
      const response = await fetch(`/records/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.results) {
        currentRecords = result.results;
        displayRecords(currentRecords);
        updateConnectionState("Connected", "connected");
        
        // Show suggestions for quick access
        if (suggestionsDiv && result.results.length > 0) {
          showSuggestions(result.results.slice(0, 5));
        }
      } else {
        currentRecords = [];
        displayRecords([]);
        updateConnectionState("No results", "idle");
      }
    } catch (error) {
      console.error("[Records] Search error:", error);
      updateConnectionState("Error", "error");
      currentRecords = [];
      displayRecords([]);
    }
  }

  // Fetch all records
  async function fetchAllRecords() {
    if (!fetchBtn) return;
    
    // Update button state
    fetchBtn.setAttribute("data-state", "loading");
    fetchBtn.disabled = true;
    updateConnectionState("Fetching...", "loading");
    
    try {
      const response = await fetch("/records/all", {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.records) {
        currentRecords = result.records;
        displayRecords(currentRecords);
        updateConnectionState("Connected", "connected");
        updateLastSync();
      } else {
        currentRecords = [];
        displayRecords([]);
        updateConnectionState("No records", "idle");
      }
    } catch (error) {
      console.error("[Records] Fetch error:", error);
      updateConnectionState("Error", "error");
      currentRecords = [];
      displayRecords([]);
    } finally {
      fetchBtn.setAttribute("data-state", "idle");
      fetchBtn.disabled = false;
    }
  }

  // Display records in table
  function displayRecords(records) {
    if (!tableBody || !recordsTable || !emptyState) return;
    
    if (records.length === 0) {
      recordsTable.setAttribute("hidden", true);
      emptyState.removeAttribute("hidden");
      updateRecordCount(0, 0, 0);
      return;
    }
    
    // Show table, hide empty state
    recordsTable.removeAttribute("hidden");
    emptyState.setAttribute("hidden", true);
    
    // Clear existing rows
    tableBody.innerHTML = "";
    
    // Calculate pagination
    const start = (currentPage - 1) * recordsPerPage;
    const end = Math.min(start + recordsPerPage, records.length);
    const paginatedRecords = records.slice(start, end);
    
    // Render rows
    paginatedRecords.forEach((patient) => {
      const row = createTableRow(patient);
      tableBody.appendChild(row);
    });
    
    // Update counts
    updateRecordCount(start + 1, end, records.length);
    updatePagination(records.length);
  }

  // Create table row
  function createTableRow(patient) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-patient-id", patient.patient_id || "");
    tr.setAttribute("data-file-no", patient.file_no || "");
    
    const fullName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "N/A";
    const dob = patient.date_of_birth || "N/A";
    const age = patient.age || "N/A";
    const sex = patient.sex || "N/A";
    const phone = patient.phone || "N/A";
    const email = patient.email || "N/A";
    const address = patient.address || "N/A";
    
    tr.innerHTML = `
      <td data-col="id">${patient.id || ""}</td>
      <td data-col="file_no">${patient.file_no || ""}</td>
      <td data-col="patient_id">${patient.patient_id || ""}</td>
      <td data-col="full_name">${fullName}</td>
      <td data-col="date_of_birth">${dob}</td>
      <td data-col="age">${age}</td>
      <td data-col="sex">${sex}</td>
      <td data-col="phone">${phone}</td>
      <td data-col="email">${email}</td>
      <td data-col="address">${address}</td>
      <td class="records-row-actions">
        <button type="button" class="btn-row-open" data-role="open-patient" data-file-no="${patient.file_no || ""}">
          <i class="fa-solid fa-up-right-from-square"></i>
          Open
        </button>
      </td>
    `;
    
    // Add click handler to open button
    const openBtn = tr.querySelector(".btn-row-open");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const fileNo = openBtn.getAttribute("data-file-no");
        if (fileNo && window.openRecordModal) {
          window.openRecordModal(fileNo);
        }
      });
    }
    
    return tr;
  }

  // Show search suggestions
  function showSuggestions(results) {
    if (!suggestionsDiv) return;
    
    suggestionsDiv.innerHTML = "";
    suggestionsDiv.removeAttribute("hidden");
    
    results.forEach((patient) => {
      const fullName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim();
      const button = document.createElement("button");
      button.className = "suggestion-item";
      button.type = "button";
      button.setAttribute("data-patient-id", patient.patient_id || "");
      button.setAttribute("data-file-no", patient.file_no || "");
      button.innerHTML = `
        <div class="suggestion-main">
          <span class="suggestion-name">${fullName}</span>
          <span class="suggestion-meta">File: ${patient.file_no || "N/A"} • ID: ${patient.patient_id || "N/A"}</span>
        </div>
      `;
      
      button.addEventListener("click", () => {
        const fileNo = button.getAttribute("data-file-no");
        if (fileNo && window.openRecordModal) {
          window.openRecordModal(fileNo);
        }
        suggestionsDiv.setAttribute("hidden", true);
        searchInput.value = "";
      });
      
      suggestionsDiv.appendChild(button);
    });
  }

  // Update connection state
  function updateConnectionState(text, state) {
    const stateEl = container.querySelector("#records-connection-state");
    const pillEl = container.querySelector("#records-connection-pill");
    
    if (stateEl) stateEl.textContent = text;
    if (pillEl) {
      pillEl.className = `status-pill status-${state}`;
    }
  }

  // Update record count
  function updateRecordCount(start, end, total) {
    const startEl = container.querySelector("#records-range-start");
    const endEl = container.querySelector("#records-range-end");
    const totalEl = container.querySelector("#records-total-count");
    
    if (startEl) startEl.textContent = start;
    if (endEl) endEl.textContent = end;
    if (totalEl) totalEl.textContent = total;
  }

  // Update last sync time
  function updateLastSync() {
    const syncEl = container.querySelector("#records-last-sync-value");
    if (syncEl) {
      const now = new Date();
      syncEl.textContent = now.toLocaleTimeString();
    }
  }

  // Update pagination
  function updatePagination(total) {
    const totalPages = Math.ceil(total / recordsPerPage);
    const paginationBar = container.querySelector("#recordsPaginationBar");
    const totalPagesEl = container.querySelector("#recordsTotalPages");
    const currentPageInput = container.querySelector("#recordsCurrentPageInput");
    const prevBtn = container.querySelector("#recordsPrevPageBtn");
    const nextBtn = container.querySelector("#recordsNextPageBtn");
    const firstBtn = container.querySelector("#recordsFirstPageBtn");
    const lastBtn = container.querySelector("#recordsLastPageBtn");
    
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (currentPageInput) currentPageInput.value = currentPage;
    
    // Show/hide pagination
    if (paginationBar) {
      if (total > recordsPerPage) {
        paginationBar.removeAttribute("hidden");
      } else {
        paginationBar.setAttribute("hidden", true);
      }
    }
    
    // Update button states
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (firstBtn) firstBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (lastBtn) lastBtn.disabled = currentPage >= totalPages;
    
    // Pagination handlers
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (currentPage > 1) {
          currentPage--;
          displayRecords(currentRecords);
        }
      };
    }
    
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (currentPage < totalPages) {
          currentPage++;
          displayRecords(currentRecords);
        }
      };
    }
    
    if (firstBtn) {
      firstBtn.onclick = () => {
        currentPage = 1;
        displayRecords(currentRecords);
      };
    }
    
    if (lastBtn) {
      lastBtn.onclick = () => {
        currentPage = totalPages;
        displayRecords(currentRecords);
      };
    }
    
    if (currentPageInput) {
      currentPageInput.onchange = (e) => {
        const page = parseInt(e.target.value);
        if (page >= 1 && page <= totalPages) {
          currentPage = page;
          displayRecords(currentRecords);
        } else {
          e.target.value = currentPage;
        }
      };
    }
  }

  // Page size handler
  const pageSizeSelect = container.querySelector("#recordsPageSize");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      recordsPerPage = parseInt(e.target.value);
      currentPage = 1;
      displayRecords(currentRecords);
    });
  }
}
