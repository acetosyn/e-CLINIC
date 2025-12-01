// ============================================================
// EPICONSULT e-CLINIC — Real-time Notifications
// Displays activities from Supabase activities table
// ============================================================

let supabaseClient = null;
let activitiesChannel = null;
let isInitialized = false;
const MAX_VISIBLE_NOTIFICATIONS = 4; // CSS limits display to 4, rest scrollable

// Initialize Supabase client
function initSupabase() {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('[Notifications] Already initialized, skipping...');
    return;
  }

  console.log('[Notifications] Initializing Supabase client...');
  const supabaseUrlEl = document.getElementById('supabase-url');
  const supabaseKeyEl = document.getElementById('supabase-anon-key');
  
  const supabaseUrl = supabaseUrlEl?.getAttribute('data-url')?.trim();
  const supabaseAnonKey = supabaseKeyEl?.getAttribute('data-key')?.trim();
  
  // Debug: Log the actual HTML content of the elements
  if (supabaseUrlEl) {
    console.log('[Notifications] URL element HTML:', supabaseUrlEl.outerHTML);
  }
  if (supabaseKeyEl) {
    console.log('[Notifications] Key element HTML:', supabaseKeyEl.outerHTML.substring(0, 100) + '...');
  }
  
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '' || supabaseAnonKey === '' || supabaseUrl.includes('...') || supabaseAnonKey.includes('...')) {
    console.warn('[Notifications] Supabase credentials not found or invalid in page - falling back to API-only mode');
    console.warn('[Notifications] URL value:', supabaseUrl || 'EMPTY');
    console.warn('[Notifications] Key value:', supabaseAnonKey ? '***' + supabaseAnonKey.slice(-4) : 'EMPTY');
    console.warn('[Notifications] ⚠️ Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file');
    // Still load notifications from API
    loadInitialNotifications();
    return null;
  }
  
  console.log('[Notifications] Supabase credentials found, setting up client...');

  // Load Supabase client library dynamically
  if (typeof supabase === 'undefined') {
    console.log('[Notifications] Loading Supabase library...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = () => {
      console.log('[Notifications] Supabase library loaded, creating client...');
      if (typeof supabase === 'undefined') {
        console.error('[Notifications] Supabase library loaded but supabase is still undefined');
        loadInitialNotifications();
        return;
      }
      supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
      setupRealtimeNotifications();
      loadInitialNotifications();
      isInitialized = true;
    };
    script.onerror = () => {
      console.error('[Notifications] Failed to load Supabase library');
      loadInitialNotifications();
    };
    document.head.appendChild(script);
  } else {
    console.log('[Notifications] Supabase library already loaded, creating client...');
    supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    setupRealtimeNotifications();
    loadInitialNotifications();
    isInitialized = true;
  }
}

// Load initial notifications from API (all for today)
async function loadInitialNotifications() {
  try {
    console.log('[Notifications] Fetching activities from API...');
    const response = await fetch('/api/activities', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include' // Include cookies for authentication
    });
    
    // Check if response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[Notifications] API returned non-JSON response:', response.status, response.statusText);
      console.error('[Notifications] Response preview:', text.substring(0, 200));
      
      if (response.status === 401 || response.status === 403) {
        console.warn('[Notifications] Authentication required - user may need to log in');
      }
      showEmptyState();
      return;
    }
    
    if (!response.ok) {
      console.error('[Notifications] API response not OK:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      console.error('[Notifications] Error details:', errorData);
      showEmptyState();
      return;
    }
    
    const result = await response.json();
    console.log('[Notifications] API response:', result);
    
    if (result.success && result.activities) {
      console.log(`[Notifications] Loaded ${result.activities.length} activities`);
      updateNotificationsList(result.activities);
      updateNotificationCount(result.activities.length);
    } else {
      console.warn('[Notifications] No activities in response or success=false:', result);
      showEmptyState();
    }
  } catch (error) {
    console.error('[Notifications] Error loading initial notifications:', error);
    console.error('[Notifications] Error details:', error.message, error.stack);
    showEmptyState();
  }
}

// Setup Supabase Realtime subscription
function setupRealtimeNotifications() {
  if (!supabaseClient) {
    console.warn('[Notifications] Supabase client not available');
    return;
  }

  // Clean up existing subscription if it exists
  if (activitiesChannel) {
    console.log('[Notifications] Removing existing channel subscription...');
    supabaseClient.removeChannel(activitiesChannel);
    activitiesChannel = null;
  }

  // Subscribe to activities table changes
  // Use a unique channel name to avoid conflicts
  activitiesChannel = supabaseClient
    .channel('activities-realtime-' + Date.now(), {
      config: {
        broadcast: { self: false }
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activities'
      },
      (payload) => {
        console.log('[Notifications] New activity received via Realtime:', payload.new);
        if (payload.new) {
          addNotification(payload.new);
        } else {
          console.warn('[Notifications] Realtime payload missing new data:', payload);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Notifications] Successfully subscribed to Realtime updates');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Notifications] Error subscribing to Realtime channel:', err);
        // Retry subscription after a delay
        setTimeout(() => {
          console.log('[Notifications] Retrying subscription...');
          setupRealtimeNotifications();
        }, 3000);
      } else if (status === 'TIMED_OUT') {
        console.warn('[Notifications] Subscription timed out, retrying...');
        setTimeout(() => {
          setupRealtimeNotifications();
        }, 2000);
      } else if (status === 'CLOSED') {
        console.warn('[Notifications] Subscription closed, reconnecting...');
        setTimeout(() => {
          setupRealtimeNotifications();
        }, 2000);
      } else {
        console.log('[Notifications] Realtime subscription status:', status);
      }
    });
}

// Add single notification to list
function addNotification(activity) {
  if (!activity || !activity.created_at) {
    console.warn('[Notifications] Cannot add notification - missing data:', activity);
    return;
  }
  
  console.log('[Notifications] Adding new notification:', activity);
  
  // Update all notification panels
  const notifList = document.getElementById('notifList');
  const deptNotifList = document.getElementById('dept-notif-list');
  const sidebarNotifList = document.getElementById('sidebar-notif-list');
  
  const allLists = [notifList, deptNotifList, sidebarNotifList].filter(Boolean);
  
  if (allLists.length === 0) {
    console.error('[Notifications] No notification list elements found!');
    return;
  }
  
  console.log(`[Notifications] Found ${allLists.length} notification lists to update`);
  
  allLists.forEach(list => {
    
    // Remove empty state if present
    const emptyState = list.querySelector('.notif-empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    // Create notification item
    const li = document.createElement('li');
    li.className = 'notif-item';
    
    // Get icon based on activity type
    const icon = getActivityIcon(activity.activity_type);
    
    // Format time
    const time = activity.created_at 
      ? new Date(activity.created_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : 'Just now';

    // Check which panel this is for proper formatting
    const isSidebar = list.id === 'sidebar-notif-list';
    const isDeptPanel = list.id === 'dept-notif-list';
    
    if (isSidebar) {
      // Sidebar format with <time> element and department class for border colors
      const deptClass = getDepartmentTypeClass(activity.department);
      li.className = `notif-item ${deptClass}`;
      li.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(activity.description)}</span>
        <time>${time}</time>
      `;
    } else if (isDeptPanel) {
      // Department subheader format (simple list item)
      li.className = 'notif-item';
      li.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(activity.description)}</span>
        <time>${time}</time>
      `;
    } else {
      // Header panel format with div structure
      li.className = 'notif-item';
      li.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="notif-content">
          <p class="notif-text">${escapeHtml(activity.description)}</p>
          <span class="notif-time">${time}</span>
        </div>
      `;
    }

    // Insert at top
    list.insertBefore(li, list.firstChild);

    // Animate new notification
    li.style.opacity = '0';
    li.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      li.style.transition = 'all 0.3s ease';
      li.style.opacity = '1';
      li.style.transform = 'translateY(0)';
    }, 10);
  });

  // Update notification count
  const headerItems = notifList ? notifList.querySelectorAll('.notif-item') : [];
  updateNotificationCount(headerItems.length);
}

// Update notifications list from activities array
function updateNotificationsList(activities) {
  console.log('[Notifications] Updating all notification panels with', activities.length, 'activities');
  
  // Update header notification panel (main dropdown)
  const notifList = document.getElementById('notifList');
  if (notifList) {
    console.log('[Notifications] Found header notifList, updating...');
    updateNotificationsPanel(notifList, activities);
  } else {
    console.warn('[Notifications] Header notifList not found!');
  }
  
  // Update department subheader notification panel
  const deptNotifList = document.getElementById('dept-notif-list');
  if (deptNotifList) {
    console.log('[Notifications] Found dept-notif-list, updating...');
    updateNotificationsPanel(deptNotifList, activities);
  } else {
    console.warn('[Notifications] dept-notif-list not found!');
  }
  
  // Update sidebar notification panel (if exists - for department pages)
  const sidebarNotifList = document.getElementById('sidebar-notif-list');
  if (sidebarNotifList) {
    console.log('[Notifications] Found sidebar-notif-list, updating...');
    updateNotificationsPanel(sidebarNotifList, activities);
  }
}

// Update a specific notifications panel (header or sidebar)
function updateNotificationsPanel(notifList, activities) {
  if (!notifList) return;

  if (!activities || activities.length === 0) {
    showEmptyState(notifList);
    return;
  }

  // Clear existing
  notifList.innerHTML = '';

  // API already filters by today, so we can trust all activities are from today
  // But we'll still validate that activities have created_at
  const validActivities = activities.filter(activity => {
    if (!activity || !activity.created_at) {
      console.warn('[Notifications] Skipping activity without created_at:', activity);
      return false;
    }
    return true;
  });

  if (validActivities.length === 0) {
    console.log('[Notifications] No valid activities to display');
    showEmptyState(notifList);
    return;
  }

  console.log(`[Notifications] Displaying ${validActivities.length} activities`);

  // Add all notifications (API already filtered by today, newest first from backend)
  validActivities.forEach(activity => {
    const li = document.createElement('li');
    const icon = getActivityIcon(activity.activity_type);
    const deptClass = getDepartmentTypeClass(activity.department);
    const time = activity.created_at 
      ? new Date(activity.created_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : 'Just now';

    // Check which panel this is for proper formatting
    const isSidebar = notifList.id === 'sidebar-notif-list';
    const isDeptPanel = notifList.id === 'dept-notif-list';
    
    if (isSidebar) {
      // Sidebar format with <time> element and department class for border colors
      li.className = `notif-item ${deptClass}`;
      li.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(activity.description)}</span>
        <time>${time}</time>
      `;
    } else if (isDeptPanel) {
      // Department subheader format (simple list item)
      li.className = 'notif-item';
      li.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(activity.description)}</span>
        <time>${time}</time>
      `;
    } else {
      // Header panel format with div structure
      li.className = 'notif-item';
      li.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="notif-content">
          <p class="notif-text">${escapeHtml(activity.description)}</p>
          <span class="notif-time">${time}</span>
        </div>
      `;
    }
    
    notifList.appendChild(li);
  });

  // CSS handles scrolling automatically (max-height set to show 4 items)

  // Update count badge (only for header)
  if (notifList.id === 'notifList') {
    updateNotificationCount(validActivities.length);
  }
}

// Show empty state when no notifications
function showEmptyState(notifListElement) {
  // Try to find notification list if not provided
  let notifList = notifListElement;
  if (!notifList) {
    // Try header panel first, then department panel
    notifList = document.getElementById('notifList') || 
                document.getElementById('dept-notif-list') || 
                document.getElementById('sidebar-notif-list');
  }
  
  if (!notifList) {
    console.warn('[Notifications] Cannot show empty state - no notification list found');
    return;
  }

  // Different empty state messages for different panels
  const isDeptPanel = notifList.id === 'dept-notif-list';
  const isSidebar = notifList.id === 'sidebar-notif-list';
  
  if (isDeptPanel) {
    notifList.innerHTML = `
      <li class="muted">No active notifications yet.</li>
    `;
  } else {
    notifList.innerHTML = `
      <li class="notif-empty-state">
        <i class="fa-solid fa-bell-slash"></i>
        <p>No activities today</p>
        <span>All departments are quiet for now. Activities will appear here in real-time.</span>
      </li>
    `;
  }
  
  // Update count badge only for header panel
  if (notifList.id === 'notifList') {
    updateNotificationCount(0);
  }
}

// Update notification badge count
function updateNotificationCount(count) {
  const countBadge = document.querySelector('.notif-count');
  if (countBadge) {
    if (count === 0) {
      countBadge.style.display = 'none';
    } else {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = count > 99 ? '99+' : count;
    }
  }
}

// Get icon based on activity type
function getActivityIcon(activityType) {
  const iconMap = {
    'patient_registration': 'fa-user-plus',
    'prescription': 'fa-prescription',
    'payment': 'fa-money-bill',
    'lab_test_request': 'fa-vial',
    'test_result': 'fa-flask',
    'medication_dispensing': 'fa-pills',
    'default': 'fa-bell'
  };
  return iconMap[activityType] || iconMap.default;
}

// Get CSS class for department (for left border colors)
function getDepartmentTypeClass(department) {
  if (!department) return 'notif-info';
  
  // Normalize department name: lowercase, spaces/underscores handled
  const dept = department.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  
  const deptMap = {
    'customer_care': 'notif-success',      // Green
    'doctor': 'notif-info',                // Blue
    'nursing': 'notif-info',               // Blue
    'laboratory': 'notif-warning',         // Yellow/Orange
    'lab': 'notif-warning',
    'diagnostics': 'notif-info',           // Blue
    'inventory': 'notif-warning',          // Yellow/Orange
    'accounts': 'notif-success',           // Green
    'accounting': 'notif-success',
    'it': 'notif-info',                    // Blue
    'admin': 'notif-urgent',               // Red
    'operations': 'notif-urgent',          // Red
    'head_of_operations': 'notif-urgent',  // Red
    'hop': 'notif-urgent',                 // Red
    'default': 'notif-info'                // Blue default
  };
  
  return deptMap[dept] || deptMap.default;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (activitiesChannel && supabaseClient) {
    supabaseClient.removeChannel(activitiesChannel);
  }
});

