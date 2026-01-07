/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Activities Module
   Activity logging and real-time notifications
   
   Usage:
     import { logActivity, subscribeToActivities } from './supabase/activities.js';
=========================================================== */

import { getSupabaseClient } from './client.js';

let activitiesChannel = null;

/**
 * Log a new activity
 * @param {object} activity - Activity data
 * @returns {Promise<{success: boolean, activity?: object}>}
 */
export async function logActivity(activity) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await logActivityViaBackend(activity);
    }

    const now = new Date().toISOString();

    const record = {
      department: activity.department || 'General',
      activity_type: activity.activity_type || 'action',
      description: activity.description || '',
      patient_name: activity.patient_name || null,
      patient_id: activity.patient_id || null,
      performed_by: activity.performed_by || 'system',
      metadata: activity.metadata || {},
      created_at: now
    };

    const { data, error } = await client
      .from('activities')
      .insert([record])
      .select()
      .single();

    if (error) {
      console.error('[Activities] Log error:', error);
      return { success: false };
    }

    return { success: true, activity: data };

  } catch (error) {
    console.error('[Activities] Log error:', error);
    return { success: false };
  }
}

/**
 * Log activity via backend (fallback)
 */
async function logActivityViaBackend(activity) {
  try {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('[Activities] Backend log error:', error);
    return { success: false };
  }
}

/**
 * Fetch recent activities
 * @param {number} limit - Max activities to fetch
 * @param {string} department - Optional department filter
 * @returns {Promise<{success: boolean, activities: object[]}>}
 */
export async function fetchActivities(limit = 50, department = null) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await fetchActivitiesViaBackend();
    }

    let query = client
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Activities] Fetch error:', error);
      return { success: false, activities: [] };
    }

    return { success: true, activities: data || [] };

  } catch (error) {
    console.error('[Activities] Fetch error:', error);
    return { success: false, activities: [] };
  }
}

/**
 * Fetch activities via backend (fallback)
 */
async function fetchActivitiesViaBackend() {
  try {
    const response = await fetch('/api/activities', { credentials: 'include' });
    const result = await response.json();
    return {
      success: result.success,
      activities: result.activities || []
    };
  } catch (error) {
    console.error('[Activities] Backend fetch error:', error);
    return { success: false, activities: [] };
  }
}

/**
 * Subscribe to real-time activity updates
 * @param {function} callback - Called when new activity arrives
 * @returns {Promise<{success: boolean, unsubscribe: function}>}
 */
export async function subscribeToActivities(callback) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      console.warn('[Activities] Client not available for realtime');
      return { success: false, unsubscribe: () => {} };
    }

    // Clean up existing subscription
    if (activitiesChannel) {
      client.removeChannel(activitiesChannel);
      activitiesChannel = null;
    }

    // Create new subscription with unique channel name
    const channelName = `activities-realtime-${Date.now()}`;
    
    activitiesChannel = client
      .channel(channelName, {
        config: { broadcast: { self: true } }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities'
        },
        (payload) => {
          console.log('[Activities] New activity received:', payload.new);
          if (payload.new && callback) {
            callback(payload.new);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Activities] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Activities] Subscription error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Activities] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.warn('[Activities] Subscription closed');
        }
      });

    const unsubscribe = () => {
      if (activitiesChannel && client) {
        client.removeChannel(activitiesChannel);
        activitiesChannel = null;
      }
    };

    return { success: true, unsubscribe };

  } catch (error) {
    console.error('[Activities] Subscription error:', error);
    return { success: false, unsubscribe: () => {} };
  }
}

/**
 * Unsubscribe from activities
 */
export async function unsubscribeFromActivities() {
  try {
    const client = await getSupabaseClient();
    if (activitiesChannel && client) {
      client.removeChannel(activitiesChannel);
      activitiesChannel = null;
      console.log('[Activities] Unsubscribed from realtime');
    }
  } catch (error) {
    console.warn('[Activities] Unsubscribe error:', error);
  }
}

/**
 * Fetch today's activities
 * @param {string} department - Optional department filter
 * @returns {Promise<{success: boolean, activities: object[]}>}
 */
export async function fetchTodayActivities(department = null) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await fetchActivitiesViaBackend();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    let query = client
      .from('activities')
      .select('*')
      .gte('created_at', todayIso)
      .order('created_at', { ascending: false });

    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Activities] Fetch today error:', error);
      return { success: false, activities: [] };
    }

    return { success: true, activities: data || [] };

  } catch (error) {
    console.error('[Activities] Fetch today error:', error);
    return { success: false, activities: [] };
  }
}

/**
 * Delete old activities (cleanup)
 * @param {number} daysOld - Delete activities older than this many days
 * @returns {Promise<{success: boolean, deleted: number}>}
 */
export async function cleanupOldActivities(daysOld = 30) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { success: false, deleted: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffIso = cutoffDate.toISOString();

    const { data, error } = await client
      .from('activities')
      .delete()
      .lt('created_at', cutoffIso)
      .select('id');

    if (error) {
      console.error('[Activities] Cleanup error:', error);
      return { success: false, deleted: 0 };
    }

    return { success: true, deleted: data?.length || 0 };

  } catch (error) {
    console.error('[Activities] Cleanup error:', error);
    return { success: false, deleted: 0 };
  }
}

// Export for global access
window.SupabaseActivities = {
  logActivity,
  fetchActivities,
  fetchTodayActivities,
  subscribeToActivities,
  unsubscribeFromActivities,
  cleanupOldActivities
};


