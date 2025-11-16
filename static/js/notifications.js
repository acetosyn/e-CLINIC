// ============================================================
// EPICONSULT e-CLINIC — Real-time Notifications
// Displays activities from Supabase activities table
// ============================================================

let supabaseClient = null;
let activitiesChannel = null;
const MAX_VISIBLE_NOTIFICATIONS = 5;

// Initialize Supabase client
function initSupabase() {
  const supabaseUrlEl = document.getElementById('supabase-url');
  const supabaseKeyEl = document.getElementById('supabase-anon-key');
  
  const supabaseUrl = supabaseUrlEl?.getAttribute('data-url');
  const supabaseAnonKey = supabaseKeyEl?.getAttribute('data-key');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found in page');
    // Still load notifications from API
    loadInitialNotifications();
    return null;
  }

  // Load Supabase client library dynamically
  if (typeof supabase === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = () => {
      supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
      setupRealtimeNotifications();
      loadInitialNotifications();
    };
    script.onerror = () => {
      console.error('Failed to load Supabase library');
      loadInitialNotifications();
    };
    document.head.appendChild(script);
  } else {
    supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    setupRealtimeNotifications();
    loadInitialNotifications();
  }
}

// Load initial notifications from API (all for today)
async function loadInitialNotifications() {
  try {
    const response = await fetch('/api/activities');
    const result = await response.json();
    
    if (result.success && result.activities) {
      updateNotificationsList(result.activities);
      updateNotificationCount(result.activities.length);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading initial notifications:', error);
    showEmptyState();
  }
}

// Setup Supabase Realtime subscription
function setupRealtimeNotifications() {
  if (!supabaseClient) return;

  // Subscribe to activities table changes
  activitiesChannel = supabaseClient
    .channel('public:activities')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activities'
      },
      (payload) => {
        console.log('New activity:', payload.new);
        addNotification(payload.new);
      }
    )
    .subscribe();
}

// Add single notification to list
function addNotification(activity) {
  // Update both header and sidebar panels
  const notifList = document.getElementById('notifList');
  const sidebarNotifList = document.getElementById('sidebar-notif-list');
  
  [notifList, sidebarNotifList].forEach(list => {
    if (!list) return;
    
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

    // Check if this is sidebar (has <time> element) or header panel
    const isSidebar = list.id === 'sidebar-notif-list';
    
    if (isSidebar) {
      // Sidebar format with <time> element and department class for border colors
      const deptClass = getDepartmentTypeClass(activity.department);
      li.className = `notif-item ${deptClass}`;
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

    // Make scrollable if exceeds max visible (only for header)
    if (!isSidebar) {
      const items = list.querySelectorAll('.notif-item');
      if (items.length > MAX_VISIBLE_NOTIFICATIONS) {
        const notifBody = document.getElementById('notifBody');
        if (notifBody) {
          notifBody.style.maxHeight = '400px';
          notifBody.style.overflowY = 'auto';
        }
      }
    }

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
  // Update header notification panel
  const notifList = document.getElementById('notifList');
  updateNotificationsPanel(notifList, activities);
  
  // Update sidebar notification panel (if exists)
  const sidebarNotifList = document.getElementById('sidebar-notif-list');
  if (sidebarNotifList) {
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

  // Filter to only today's activities and add all (newest first)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayActivities = activities.filter(activity => {
    if (!activity.created_at) return false;
    const activityDate = new Date(activity.created_at);
    activityDate.setHours(0, 0, 0, 0);
    return activityDate.getTime() === today.getTime();
  });

  if (todayActivities.length === 0) {
    showEmptyState(notifList);
    return;
  }

  // Add all today's notifications
  todayActivities.forEach(activity => {
    const li = document.createElement('li');
    const icon = getActivityIcon(activity.activity_type);
    const deptClass = getDepartmentTypeClass(activity.department);
    const time = activity.created_at 
      ? new Date(activity.created_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : 'Just now';

    // Check if this is sidebar (has <time> element) or header panel
    const isSidebar = notifList.id === 'sidebar-notif-list';
    
    if (isSidebar) {
      // Sidebar format with <time> element and department class for border colors
      li.className = `notif-item ${deptClass}`;
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

  // Make scrollable if more than MAX_VISIBLE_NOTIFICATIONS (only for header panel)
  const notifBody = document.getElementById('notifBody');
  if (todayActivities.length > MAX_VISIBLE_NOTIFICATIONS && notifBody) {
    notifBody.style.maxHeight = '400px';
    notifBody.style.overflowY = 'auto';
  }

  // Update count badge (only for header)
  if (notifList.id === 'notifList') {
    updateNotificationCount(todayActivities.length);
  }
}

// Show empty state when no notifications
function showEmptyState(notifListElement) {
  const notifList = notifListElement || document.getElementById('notifList');
  if (!notifList) return;

  notifList.innerHTML = `
    <li class="notif-empty-state">
      <i class="fa-solid fa-bell-slash"></i>
      <p>No activities today</p>
      <span>All departments are quiet for now. Activities will appear here in real-time.</span>
    </li>
  `;
  
  // Update count badge only for header panel
  if (!notifListElement || notifList.id === 'notifList') {
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

