/**
 * Business-related type definitions
 */

export interface Department {
  id: string;
  name: string;
  slug?: string; // Department slug (e.g., "technology", "sales") - used for conversation grouping
  description?: string;
  context_md?: string; // Department-specific context for AI
  roles?: Role[];
  channels?: Channel[];
}

export interface Role {
  id: string;
  name: string;
  title?: string;
  description?: string;
  system_prompt?: string;
  departmentId?: string;
  departmentName?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
}

export interface Style {
  id: string;
  name: string;
  description?: string;
}

export interface Playbook {
  id: string;
  name?: string;
  title?: string;
  type?: 'sop' | 'framework' | 'policy';
  doc_type?: 'sop' | 'framework' | 'policy';
  content?: string;
  description?: string;
  department_id?: string;
  department_ids?: string[];
  additional_departments?: string[];
  tags?: string[];
  version?: number;
  status?: 'active' | 'archived' | 'draft';
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  context?: string;
  status: 'active' | 'completed' | 'archived';
  company_id: string;
  department_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  departments?: Department[];
  styles?: Style[];
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  last_company_id?: string;
  last_department_ids?: string[];
  last_role_ids?: string[];
  last_project_id?: string;
  last_playbook_ids?: string[];
}
