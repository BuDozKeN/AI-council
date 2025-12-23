/**
 * Business-related type definitions
 */

export interface Department {
  id: string;
  name: string;
  description?: string;
  roles?: Role[];
  channels?: Channel[];
}

export interface Role {
  id: string;
  name: string;
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
  name: string;
  type: 'sop' | 'framework' | 'policy';
  content: string;
  description?: string;
  department_id?: string;
  tags?: string[];
  version?: number;
  created_at: string;
  updated_at: string;
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
