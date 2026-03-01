/**
 * RFE Foam Pro — Supabase API Service
 * Replaces the Google Apps Script backend with direct Supabase queries.
 * RLS policies enforce multi-tenant isolation automatically.
 */

import { supabase } from '../lib/supabase';
import {
  CalculatorState,
  EstimateRecord,
  CustomerProfile,
  WarehouseItem,
  MaterialUsageLogEntry,
  UserSession,
  CrewProfile,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────

/** Get the current user's company_id from their profile */
const getCompanyId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (error || !data) throw new Error('Profile not found');
  return data.company_id;
};

// ─── Auth ─────────────────────────────────────────────────

/**
 * Sign up a new admin user + company.
 * The DB trigger `handle_new_user` auto-creates company, profile, and settings.
 */
export const signupUser = async (
  email: string,
  password: string,
  companyName: string
): Promise<UserSession> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_name: companyName,
        display_name: email.split('@')[0],
        role: 'admin',
      },
    },
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Signup failed — no user returned');

  // Fetch the profile that the trigger created
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, display_name')
    .eq('id', data.user.id)
    .single();

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', profile?.company_id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email || email,
    companyId: profile?.company_id || '',
    companyName: company?.name || companyName,
    role: (profile?.role as 'admin' | 'crew') || 'admin',
    displayName: profile?.display_name || email,
  };
};

/**
 * Log in an existing admin user.
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<UserSession> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login failed');

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, display_name')
    .eq('id', data.user.id)
    .single();

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', profile?.company_id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email || email,
    companyId: profile?.company_id || '',
    companyName: company?.name || '',
    role: (profile?.role as 'admin' | 'crew') || 'admin',
    displayName: profile?.display_name || email,
  };
};

/**
 * Log in a crew member.
 * Crew members are Supabase Auth users with role='crew' in profiles.
 */
export const loginCrew = async (
  email: string,
  password: string
): Promise<UserSession> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Crew login failed');

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, display_name, crew_metadata')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'crew') {
    throw new Error('This account is not a crew account. Use admin login.');
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', profile?.company_id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email || email,
    companyId: profile?.company_id || '',
    companyName: company?.name || '',
    role: 'crew',
    displayName: profile?.display_name || email,
    crewId: data.user.id,
    crewName: profile?.display_name || email,
  };
};

/**
 * Log out the current user.
 */
export const logoutUser = async (): Promise<void> => {
  await supabase.auth.signOut();
};

/**
 * Invite a crew member (admin creates an account for them).
 * Uses the invite-crew Edge Function so the admin's session is not replaced.
 */
export const inviteCrewMember = async (
  email: string,
  password: string,
  crewProfile: Partial<CrewProfile>
): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('invite-crew', {
    body: { email, password, crewProfile },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
};

// ─── Sync Down (Read All) ─────────────────────────────────

/**
 * Fetches the full application state from Supabase (replaces SYNC_DOWN).
 */
export const syncDown = async (): Promise<Partial<CalculatorState> | null> => {
  try {
    const companyId = await getCompanyId();

    // Parallel fetches — all filtered by RLS automatically
    const [settingsRes, customersRes, estimatesRes, warehouseRes, logsRes, crewsRes] =
      await Promise.all([
        supabase.from('company_settings').select('*').eq('company_id', companyId).single(),
        supabase.from('customers').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('estimates').select('*').eq('company_id', companyId).order('date', { ascending: false }),
        supabase.from('warehouse_items').select('*').eq('company_id', companyId),
        supabase.from('material_logs').select('*').eq('company_id', companyId).order('date', { ascending: false }).limit(500),
        supabase.from('profiles').select('*').eq('company_id', companyId).eq('role', 'crew'),
      ]);

    const settings = settingsRes.data;
    const customers = customersRes.data || [];
    const estimates = estimatesRes.data || [];
    const warehouseItems = warehouseRes.data || [];
    const materialLogs = logsRes.data || [];
    const crewProfiles = crewsRes.data || [];

    // Map DB rows to app types
    const mappedCustomers: CustomerProfile[] = customers.map((c: any) => ({
      id: c.id,
      name: c.name,
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zip: c.zip || '',
      email: c.email || '',
      phone: c.phone || '',
      notes: c.notes || '',
      status: c.status || 'Active',
      createdAt: c.created_at,
    }));

    const mappedEstimates: EstimateRecord[] = estimates.map((e: any) => ({
      id: e.id,
      customerId: e.customer_id,
      status: e.status,
      executionStatus: e.execution_status,
      date: e.date,
      scheduledDate: e.scheduled_date || '',
      assignedCrewId: e.assigned_crew_id || '',
      customer: e.customer_snapshot || {},
      inputs: e.inputs || {},
      results: e.results || {},
      materials: e.materials || {},
      wallSettings: e.wall_settings || {},
      roofSettings: e.roof_settings || {},
      actuals: e.actuals || undefined,
      notes: e.notes || '',
      workOrderSheetUrl: e.work_order_url || e.pdf_url || '',
    }));

    const mappedWarehouseItems: WarehouseItem[] = warehouseItems.map((w: any) => ({
      id: w.id,
      name: w.name,
      quantity: Number(w.quantity) || 0,
      unit: w.unit || '',
      unitCost: Number(w.unit_cost) || 0,
      minLevel: w.min_level != null ? Number(w.min_level) : undefined,
    }));

    const mappedLogs: MaterialUsageLogEntry[] = materialLogs.map((l: any) => ({
      id: l.id,
      date: l.date,
      jobId: l.estimate_id || '',
      customerName: l.customer_name || '',
      materialName: l.material_name,
      quantity: Number(l.quantity),
      unit: l.unit || '',
      loggedBy: l.logged_by || '',
    }));

    const mappedCrews: CrewProfile[] = crewProfiles.map((p: any) => ({
      id: p.id,
      name: p.display_name || '',
      username: p.display_name || '',
      leadName: p.crew_metadata?.leadName || '',
      phone: p.crew_metadata?.phone || '',
      truckInfo: p.crew_metadata?.truckInfo || '',
      status: p.crew_metadata?.status || 'Active',
    }));

    const foamCounts = settings?.foam_counts || { openCellSets: 0, closedCellSets: 0 };

    return {
      companyProfile: settings?.profile || {},
      costs: settings?.costs,
      yields: settings?.yields || {},
      warehouse: {
        openCellSets: foamCounts.openCellSets || 0,
        closedCellSets: foamCounts.closedCellSets || 0,
        items: mappedWarehouseItems,
      },
      customers: mappedCustomers,
      savedEstimates: mappedEstimates,
      materialLogs: mappedLogs,
      crews: mappedCrews,
    } as Partial<CalculatorState>;
  } catch (error) {
    console.error('syncDown error:', error);
    return null;
  }
};

// ─── Sync Up (Write All) ─────────────────────────────────

/**
 * Pushes updated application state to Supabase (replaces SYNC_UP).
 * Uses per-table upserts instead of full-state overwrite.
 */
export const syncUp = async (state: CalculatorState): Promise<boolean> => {
  try {
    const companyId = await getCompanyId();

    // 1. Update company settings
    await supabase
      .from('company_settings')
      .update({
        profile: state.companyProfile,
        costs: state.costs ?? null,
        yields: state.yields,
        foam_counts: {
          openCellSets: state.warehouse.openCellSets,
          closedCellSets: state.warehouse.closedCellSets,
        },
        crews: state.crews,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId);

    // 2. Upsert customers
    if (state.customers.length > 0) {
      const customerRows = state.customers.map((c) => ({
        id: c.id,
        company_id: companyId,
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        address: c.address || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
        notes: c.notes || null,
        status: c.status || 'Active',
      }));

      await supabase.from('customers').upsert(customerRows, { onConflict: 'id' });
    }

    // 3. Upsert estimates
    if (state.savedEstimates.length > 0) {
      const estimateRows = state.savedEstimates.map((e) => ({
        id: e.id,
        company_id: companyId,
        customer_id: e.customerId || null,
        status: e.status,
        execution_status: e.executionStatus || 'Not Started',
        date: e.date,
        scheduled_date: e.scheduledDate || null,
        assigned_crew_id: e.assignedCrewId || null,
        customer_snapshot: e.customer,
        inputs: e.inputs,
        results: e.results,
        materials: e.materials,
        wall_settings: e.wallSettings,
        roof_settings: e.roofSettings,
        actuals: e.actuals || null,
        notes: e.notes || null,
        pdf_url: e.workOrderSheetUrl || null,
        work_order_url: e.workOrderSheetUrl || null,
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('estimates').upsert(estimateRows, { onConflict: 'id' });
    }

    // 4. Upsert warehouse items
    // Delete items no longer in state, then upsert current
    const { data: existingItems } = await supabase
      .from('warehouse_items')
      .select('id')
      .eq('company_id', companyId);

    const currentIds = new Set(state.warehouse.items.map((i) => i.id));
    const toDelete = (existingItems || []).filter((i: any) => !currentIds.has(i.id)).map((i: any) => i.id);

    if (toDelete.length > 0) {
      await supabase.from('warehouse_items').delete().in('id', toDelete);
    }

    if (state.warehouse.items.length > 0) {
      const warehouseRows = state.warehouse.items.map((w) => ({
        id: w.id,
        company_id: companyId,
        name: w.name,
        quantity: w.quantity,
        unit: w.unit || null,
        unit_cost: w.unitCost || 0,
        min_level: w.minLevel != null ? w.minLevel : null,
      }));

      await supabase.from('warehouse_items').upsert(warehouseRows, { onConflict: 'id' });
    }

    return true;
  } catch (error) {
    console.error('syncUp error:', error);
    return false;
  }
};

// ─── Individual Operations ────────────────────────────────

/**
 * Deletes an estimate.
 */
export const deleteEstimate = async (estimateId: string): Promise<boolean> => {
  const { error } = await supabase.from('estimates').delete().eq('id', estimateId);
  return !error;
};

/**
 * Marks job as complete and logs material usage.
 */
export const completeJob = async (
  estimateId: string,
  actuals: any
): Promise<boolean> => {
  try {
    const companyId = await getCompanyId();

    // 1. Update estimate
    await supabase
      .from('estimates')
      .update({
        execution_status: 'Completed',
        actuals,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId);

    // 2. Get the estimate for material log context
    const { data: estimate } = await supabase
      .from('estimates')
      .select('customer_snapshot, materials')
      .eq('id', estimateId)
      .single();

    const customerName = estimate?.customer_snapshot?.name || 'Unknown';

    // 3. Log material usage
    const logs: any[] = [];
    const ts = new Date().toISOString();

    if (actuals.openCellSets > 0) {
      logs.push({
        company_id: companyId,
        estimate_id: estimateId,
        date: ts,
        customer_name: customerName,
        material_name: 'Open Cell',
        quantity: actuals.openCellSets,
        unit: 'Sets',
        logged_by: actuals.completedBy,
      });
    }
    if (actuals.closedCellSets > 0) {
      logs.push({
        company_id: companyId,
        estimate_id: estimateId,
        date: ts,
        customer_name: customerName,
        material_name: 'Closed Cell',
        quantity: actuals.closedCellSets,
        unit: 'Sets',
        logged_by: actuals.completedBy,
      });
    }
    if (actuals.inventory?.length > 0) {
      actuals.inventory.forEach((item: any) => {
        if (Number(item.quantity) > 0) {
          logs.push({
            company_id: companyId,
            estimate_id: estimateId,
            date: ts,
            customer_name: customerName,
            material_name: item.name,
            quantity: item.quantity,
            unit: item.unit || 'Units',
            logged_by: actuals.completedBy,
          });
        }
      });
    }

    if (logs.length > 0) {
      await supabase.from('material_logs').insert(logs);
    }

    // 4. Update foam counts in settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('foam_counts')
      .eq('company_id', companyId)
      .single();

    if (settings) {
      const counts = settings.foam_counts || { openCellSets: 0, closedCellSets: 0 };
      const estMaterials = estimate?.materials || {};
      const deltaOc = (Number(actuals.openCellSets) || 0) - (Number(estMaterials.openCellSets) || 0);
      const deltaCc = (Number(actuals.closedCellSets) || 0) - (Number(estMaterials.closedCellSets) || 0);

      await supabase
        .from('company_settings')
        .update({
          foam_counts: {
            openCellSets: (counts.openCellSets || 0) - deltaOc,
            closedCellSets: (counts.closedCellSets || 0) - deltaCc,
          },
        })
        .eq('company_id', companyId);
    }

    return true;
  } catch (error) {
    console.error('completeJob error:', error);
    return false;
  }
};

/**
 * Logs crew time for a job.
 */
export const logCrewTime = async (
  estimateId: string,
  startTime: string,
  endTime: string | null,
  user: string
): Promise<boolean> => {
  try {
    const companyId = await getCompanyId();

    await supabase.from('material_logs').insert({
      company_id: companyId,
      estimate_id: estimateId,
      date: new Date().toISOString(),
      material_name: 'Crew Time',
      quantity: endTime
        ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60)
        : 0,
      unit: 'Hours',
      logged_by: user,
    });

    return true;
  } catch (error) {
    console.error('logCrewTime error:', error);
    return false;
  }
};

/**
 * Uploads a PDF to Supabase Storage.
 */
export const savePdfToStorage = async (
  fileName: string,
  base64Data: string,
  estimateId?: string
): Promise<string | null> => {
  try {
    const companyId = await getCompanyId();

    // Convert base64 to Blob
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(base64Content);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    const filePath = `${companyId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const publicUrl = urlData?.signedUrl || '';

    // Update estimate with PDF link
    if (estimateId && publicUrl) {
      await supabase
        .from('estimates')
        .update({ pdf_url: publicUrl })
        .eq('id', estimateId);
    }

    // Track in documents table
    await supabase.from('documents').insert({
      company_id: companyId,
      estimate_id: estimateId || null,
      file_name: fileName,
      file_path: filePath,
      file_type: 'application/pdf',
      file_size: blob.size,
    });

    return publicUrl;
  } catch (error) {
    console.error('savePdfToStorage error:', error);
    return null;
  }
};

/**
 * Get current authenticated session (for restoring on page load).
 */
export const getCurrentSession = async (): Promise<UserSession | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, display_name, crew_metadata')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', profile.company_id)
    .single();

  return {
    id: user.id,
    email: user.email || '',
    companyId: profile.company_id,
    companyName: company?.name || '',
    role: profile.role as 'admin' | 'crew',
    displayName: profile.display_name || user.email || '',
    crewId: profile.role === 'crew' ? user.id : undefined,
    crewName: profile.role === 'crew' ? profile.display_name : undefined,
  };
};
