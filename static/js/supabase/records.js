/* ===========================================================
   EPICONSULT e-CLINIC — Supabase Records Module
   Patient records management and services
   
   Usage:
     import { fetchPatientRecords, savePatientRecord } from './supabase/records.js';
=========================================================== */

import { getSupabaseClient } from './client.js';

/**
 * Fetch patient records for a specific patient
 * @param {string} patientId - Patient ID or file number
 * @returns {Promise<{success: boolean, records: object[]}>}
 */
export async function fetchPatientRecords(patientId) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await fetchPatientRecordsViaBackend(patientId);
    }

    const { data, error } = await client
      .from('patient_records')
      .select('*')
      .or(`patient_id.eq.${patientId},file_no.eq.${patientId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Records] Fetch error:', error);
      return { success: false, records: [] };
    }

    return { success: true, records: data || [] };

  } catch (error) {
    console.error('[Records] Fetch error:', error);
    return { success: false, records: [] };
  }
}

/**
 * Fetch records via backend (fallback)
 */
async function fetchPatientRecordsViaBackend(patientId) {
  try {
    const response = await fetch(`/records/patient/${encodeURIComponent(patientId)}`, {
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
    console.error('[Records] Backend fetch error:', error);
    return { success: false, records: [] };
  }
}

/**
 * Save a new patient record (visit record)
 * @param {object} recordData - Record data including patient_id, services, notes, etc.
 * @param {string} dataEntry - Username of person entering data
 * @returns {Promise<{success: boolean, record?: object, message?: string}>}
 */
export async function savePatientRecord(recordData, dataEntry) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Supabase client not available' };
    }

    const now = new Date().toISOString();

    const record = {
      patient_id: recordData.patient_id,
      file_no: recordData.file_no,
      record_type: recordData.record_type || 'visit',
      description: recordData.description || '',
      notes: recordData.notes || '',
      services: recordData.services || [],
      data_entry: dataEntry || 'system',
      created_at: now,
      updated_at: now
    };

    const { data, error } = await client
      .from('patient_records')
      .insert([record])
      .select()
      .single();

    if (error) {
      console.error('[Records] Save error:', error);
      return { success: false, message: error.message };
    }

    // Log activity
    await logRecordActivity(client, data, dataEntry);

    return {
      success: true,
      record: data,
      message: 'Record saved successfully'
    };

  } catch (error) {
    console.error('[Records] Save error:', error);
    return { success: false, message: 'Failed to save record' };
  }
}

/**
 * Log record save activity
 */
async function logRecordActivity(client, record, performedBy) {
  try {
    const now = new Date().toISOString();
    await client.from('activities').insert([{
      department: 'Records',
      activity_type: 'patient_record',
      description: `Patient record saved: ${record.record_type}`,
      patient_id: record.patient_id,
      performed_by: performedBy || 'system',
      metadata: { record_id: record.id, file_no: record.file_no },
      created_at: now
    }]);
  } catch (error) {
    console.warn('[Records] Activity logging failed:', error);
  }
}

/**
 * Fetch available services from services table
 * @param {string} category - Optional category filter
 * @returns {Promise<{success: boolean, services: object[]}>}
 */
export async function fetchServices(category = null) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return await fetchServicesViaBackend();
    }

    let query = client
      .from('services')
      .select('*')
      .order('category');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Records] Services fetch error:', error);
      return { success: false, services: [] };
    }

    return { success: true, services: data || [] };

  } catch (error) {
    console.error('[Records] Services fetch error:', error);
    return { success: false, services: [] };
  }
}

/**
 * Fetch services via backend (fallback)
 */
async function fetchServicesViaBackend() {
  try {
    const response = await fetch('/records/services', { credentials: 'include' });
    return await response.json();
  } catch (error) {
    console.error('[Records] Backend services error:', error);
    return { success: false, services: [] };
  }
}

/**
 * Get unique service categories
 * @returns {Promise<string[]>}
 */
export async function getServiceCategories() {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('services')
      .select('category')
      .order('category');

    if (error) {
      return [];
    }

    // Get unique categories
    const categories = [...new Set(data.map(s => s.category).filter(Boolean))];
    return categories;

  } catch (error) {
    console.error('[Records] Categories error:', error);
    return [];
  }
}

/**
 * Search services by name
 * @param {string} query
 * @returns {Promise<{success: boolean, services: object[]}>}
 */
export async function searchServices(query) {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, services: [] };
    }

    const client = await getSupabaseClient();
    if (!client) {
      return { success: false, services: [] };
    }

    const { data, error } = await client
      .from('services')
      .select('*')
      .ilike('name', `%${query.trim()}%`)
      .limit(20);

    if (error) {
      return { success: false, services: [] };
    }

    return { success: true, services: data || [] };

  } catch (error) {
    return { success: false, services: [] };
  }
}

/**
 * Update a patient record
 * @param {number} recordId
 * @param {object} updates
 * @returns {Promise<{success: boolean, record?: object}>}
 */
export async function updatePatientRecord(recordId, updates) {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Client not available' };
    }

    const { data, error } = await client
      .from('patient_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, record: data };

  } catch (error) {
    return { success: false, message: 'Update failed' };
  }
}

// Export for global access
window.SupabaseRecords = {
  fetchPatientRecords,
  savePatientRecord,
  fetchServices,
  getServiceCategories,
  searchServices,
  updatePatientRecord
};


