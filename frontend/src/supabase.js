import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Auth features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * User Preferences API for Smart Auto context persistence
 */
export const userPreferencesApi = {
  /**
   * Get the current user's preferences.
   * Returns null if no preferences exist yet.
   */
  async get() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error for us)
      console.error('Failed to get user preferences:', error);
    }
    return data || null;
  },

  /**
   * Update the user's preferences (upsert).
   * @param {Object} prefs - Partial preferences to update
   */
  async update(prefs) {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to update user preferences:', error);
      return null;
    }
    return data;
  },

  /**
   * Save the current context as last-used (for Smart Auto).
   */
  async saveLastUsed({ companyId, departmentIds, roleIds, projectId, playbookIds }) {
    return this.update({
      last_company_id: companyId || null,
      last_department_ids: departmentIds || [],
      last_role_ids: roleIds || [],
      last_project_id: projectId || null,
      last_playbook_ids: playbookIds || [],
    });
  },
};
