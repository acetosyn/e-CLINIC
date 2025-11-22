/* ============================================================
   EPICONSULT — records.js (SAFE VERSION)
   Prevents duplicate supabaseClient declaration when loaded twice
=============================================================== */

// ------------------------------------------------------------
// PREVENT DUPLICATE DECLARATION
// ------------------------------------------------------------
if (!window.__recordsSupabaseInitialized) {
    window.__recordsSupabaseInitialized = true;

    // Global supabase client holder
    window.supabaseClient = null;
}

// =========================
// SUPABASE CLIENT
// =========================

function initSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  
  const supabaseUrlEl = document.getElementById('supabase-url');
  const supabaseKeyEl = document.getElementById('supabase-anon-key');
  
  const supabaseUrl = supabaseUrlEl?.getAttribute('data-url');
  const supabaseAnonKey = supabaseKeyEl?.getAttribute('data-key');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Records] Supabase credentials not found');
    return null;
  }
  
  if (typeof supabase === 'undefined') {
    console.warn('[Records] Supabase library not loaded yet, delaying init…');
    const checkInterval = setInterval(() => {
      if (typeof supabase !== 'undefined') {
        clearInterval(checkInterval);
        window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
        console.log('[Records] Supabase client initialized (delayed)');
      }
    }, 100);
    return null;
  }
  
  window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Records] Supabase client initialized');
  return window.supabaseClient;
}

document.addEventListener('DOMContentLoaded', () => {
  initSupabaseClient();
});

// =========================
// GLOBAL STATE
// =========================
let selectedFolderNo = null;

// =========================
// OPEN RECORD MODAL + LOAD PATIENT
// =========================
window.openRecordModal = async function (folderNo) {
    selectedFolderNo = folderNo;

    const modal = document.getElementById("modalRecord");
    if (modal) modal.setAttribute("aria-hidden", "false");

    let client = initSupabaseClient();
    if (!client) {
        await new Promise(r => setTimeout(r, 500));
        client = initSupabaseClient();
    }
    if (!client) {
        alert("Unable to connect to database.");
        return;
    }

    const { data, error } = await client
        .from("patients")
        .select("*")
        .eq("folder_no", folderNo)
        .single();

    if (error || !data) {
        alert("Unable to load record.");
        return;
    }

    fillPatientPreview(data);
};

// =========================
// FILL PREVIEW TABLE
// =========================
function fillPatientPreview(p) {
    document.getElementById("pvTitle").textContent = p.title || "";
    document.getElementById("pvName").textContent = p.name || "";
    document.getElementById("pvSex").textContent = p.sex || "";
    document.getElementById("pvFolder").textContent = p.folder_no || "";
    document.getElementById("pvStatus").textContent = p.account_status || "";
    document.getElementById("pvDob").textContent = p.date_of_birth || "";
    document.getElementById("pvAge").textContent = p.age || "";
    document.getElementById("pvPhone").textContent = p.mobile_no || "";
    document.getElementById("pvRegDate").textContent = p.registration_date || "";
    document.getElementById("pvEmail").textContent = p.email || "";
    document.getElementById("pvDataEntry").textContent = p.data_entry || "";

    document.getElementById("patientPreview").classList.remove("hidden");
}

// =========================
// SAVE RECORD
// =========================
const saveBtn = document.querySelector("[data-action='save-record']");

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    if (!selectedFolderNo) {
      alert("No patient selected.");
      return;
    }

    const recordType = document.getElementById("recordType").value;
    const description = document.getElementById("recordDescription").value;
    const dataEntry = document.getElementById("recordDataEntry").value;

    const services = collectServices();

    const payload = {
      folder_no: selectedFolderNo,
      record_type: recordType,
      description: description,
      services: services,
      data_entry: dataEntry,
      created_at: new Date().toISOString()
    };

    const client = initSupabaseClient();
    if (!client) {
      alert("Unable to connect to database. Please refresh the page.");
      return;
    }

    const { error } = await client.from("patient_records").insert([payload]);

    if (error) {
      console.error(error);
      alert("Unable to save record.");
      return;
    }

    alert("Record saved!");
  });
} else {
  console.warn("[Records] Save button not found — OK if records.html not loaded yet.");
}

// =========================
// COLLECT SERVICES
// =========================
function collectServices() {
    const container = document.getElementById("serviceItemsContainer");
    const items = container.querySelectorAll(".service-item");

    let list = [];

    items.forEach(item => {
        const type = item.querySelector(".service-type").value;
        const qty = parseInt(item.querySelector(".service-qty").value);

        if (type && qty > 0) {
            list.push({ type, qty });
        }
    });

    return list;
}
