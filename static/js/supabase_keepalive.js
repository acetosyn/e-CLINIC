/* ===========================================================
   Supabase Keep-Alive Helper
   Prevents database cold starts by periodically pinging Supabase
   =========================================================== */

let keepAliveInterval = null;
let supabaseKeepAliveClient = null;
const KEEP_ALIVE_INTERVAL = 1 * 60 * 1000; // 1 minute (60000 ms) - aggressive to prevent cold starts
const PING_ENDPOINT = '/api/health'; // Lightweight health check endpoint

/**
 * Initialize Supabase keep-alive mechanism
 * Calls a lightweight endpoint periodically to keep connection warm
 */
function initSupabaseKeepAlive() {
  // Only run if Supabase client is available
  if (typeof supabase === 'undefined' && !supabaseKeepAliveClient) {
    console.log('[KeepAlive] Waiting for Supabase client to initialize...');
    // Wait for Supabase to load
    const checkInterval = setInterval(() => {
      if (typeof supabase !== 'undefined') {
        clearInterval(checkInterval);
        setupKeepAlive();
      }
    }, 1000);
    
    // Give up after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (typeof supabase === 'undefined') {
        console.warn('[KeepAlive] Supabase not loaded, using API-only keep-alive');
        setupAPIKeepAlive();
      }
    }, 30000);
    return;
  }
  
  setupKeepAlive();
}

/**
 * Setup keep-alive using Supabase client
 */
function setupKeepAlive() {
  try {
    const supabaseUrlEl = document.getElementById('supabase-url');
    const supabaseKeyEl = document.getElementById('supabase-anon-key');
    
    const supabaseUrl = supabaseUrlEl?.getAttribute('data-url');
    const supabaseAnonKey = supabaseKeyEl?.getAttribute('data-key');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[KeepAlive] Supabase credentials not found, using API-only mode');
      setupAPIKeepAlive();
      return;
    }
    
    // Initialize Supabase client for keep-alive
    if (typeof supabase !== 'undefined') {
      supabaseKeepAliveClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    }
    
    // Start keep-alive pings
    startKeepAlive();
    console.log('[KeepAlive] Supabase keep-alive initialized (every 1 minute)');
  } catch (error) {
    console.error('[KeepAlive] Error setting up keep-alive:', error);
    // Fallback to API keep-alive
    setupAPIKeepAlive();
  }
}

/**
 * Setup keep-alive using API endpoint (fallback)
 */
function setupAPIKeepAlive() {
  startKeepAlive();
  console.log('[KeepAlive] API keep-alive initialized (every 1 minute)');
}

/**
 * Start the keep-alive interval
 */
function startKeepAlive() {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // Ping immediately
  pingDatabase();
  
  // Then ping every 1 minute to aggressively prevent cold starts
  keepAliveInterval = setInterval(() => {
    pingDatabase();
  }, KEEP_ALIVE_INTERVAL);
  
  console.log(`[KeepAlive] Keep-alive started (interval: ${KEEP_ALIVE_INTERVAL / 1000}s)`);
}

/**
 * Ping a single table with retry logic
 */
async function pingTable(tableName, maxRetries = 3) {
  if (!supabaseKeepAliveClient) return null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabaseKeepAliveClient
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .limit(1);
      
      if (result && !result.error) {
        return { success: true, table: tableName };
      }
      
      // If we get an error but it's not a connection error, don't retry
      if (result && result.error && !result.error.message?.includes('connection') && !result.error.message?.includes('network')) {
        return { success: false, table: tableName, error: result.error };
      }
      
      // Connection error - retry
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`[KeepAlive] ${tableName} ping failed (attempt ${attempt}/${maxRetries}), retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[KeepAlive] ${tableName} ping error (attempt ${attempt}/${maxRetries}), retrying in ${delay/1000}s:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return { success: false, table: tableName, error: error.message };
      }
    }
  }
  
  return { success: false, table: tableName, error: 'Max retries exceeded' };
}

/**
 * Ping the database to keep connection warm
 * Targets multiple tables to prevent cold starts: users, activities, patients, patient_records
 * Includes retry logic for each table
 */
async function pingDatabase() {
  try {
    // Try Supabase first if available
    if (supabaseKeepAliveClient) {
      // Tables to ping (in order of importance)
      const tablesToPing = [
        'activities',  // Most critical for real-time notifications
        'users',       // Authentication
        'patients',    // Patient records
        'patient_records' // Patient records detail
      ];
      
      // Ping all tables in parallel with individual retry logic
      const pingPromises = tablesToPing.map(table => pingTable(table, 3));
      const results = await Promise.all(pingPromises);
      
      // Count successful pings
      const successful = results.filter(r => r && r.success);
      const failed = results.filter(r => r && !r.success);
      
      if (successful.length > 0) {
        const successTables = successful.map(r => r.table).join(', ');
        console.log(`[KeepAlive] ✅ Ping successful: ${successful.length}/${tablesToPing.length} tables warmed (${successTables})`);
        
        // Log failed tables if any
        if (failed.length > 0) {
          const failedTables = failed.map(r => r.table).join(', ');
          console.warn(`[KeepAlive] ⚠️ Failed to ping: ${failedTables}`);
        }
        
        return; // Success - no need for API fallback
      } else {
        console.warn('[KeepAlive] ❌ All Supabase table pings failed, trying API fallback');
      }
    }
    
    // Fallback: Ping our own API health endpoint with retry
    let apiSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(PING_ENDPOINT, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (response && response.ok) {
          console.log('[KeepAlive] ✅ API ping successful');
          apiSuccess = true;
          break;
        }
      } catch (error) {
        if (attempt < 3) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[KeepAlive] API ping failed (attempt ${attempt}/3), retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!apiSuccess) {
      console.warn('[KeepAlive] ❌ All ping methods failed, will retry next interval');
    }
  } catch (error) {
    // Silent fail - don't spam console
    console.debug('[KeepAlive] Ping error (silent):', error.message);
  }
}

/**
 * Stop keep-alive (when user logs out)
 */
function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[KeepAlive] Keep-alive stopped');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Only run if user is authenticated (check for authenticated indicators)
  const isAuthenticated = document.querySelector('.header-actions') || 
                         document.querySelector('[data-user]') ||
                         document.cookie.includes('session');
  
  if (isAuthenticated) {
    // Wait a bit for other scripts to initialize
    setTimeout(() => {
      initSupabaseKeepAlive();
    }, 2000);
  }
});

// Stop keep-alive when page unloads or user logs out
window.addEventListener('beforeunload', () => {
  stopKeepAlive();
});

// Expose stop function globally for logout handlers
window.stopSupabaseKeepAlive = stopKeepAlive;

