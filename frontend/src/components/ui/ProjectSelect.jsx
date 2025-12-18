/**
 * ProjectSelect - A Select component for project selection
 *
 * This component matches the DepartmentSelect design system:
 * - 12px border-radius on dropdown
 * - 8px border-radius on items
 * - Orange checkmark for selected item
 * - Project-specific styling with green theme
 *
 * Usage:
 * <ProjectSelect
 *   value={selectedProjectId}
 *   onValueChange={setSelectedProjectId}
 *   projects={projects}
 *   includeCreate={true}
 *   createLabel="+ Create New Project"
 *   disabled={false}
 *   className="custom-class"
 * />
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, FolderKanban, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import './ProjectSelect.css';

// Custom SelectItem for projects
const ProjectSelectItem = React.forwardRef(({
  className,
  children,
  isCreate = false,
  isCurrent = false,
  ...props
}, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "project-select-item",
        isCreate && "project-select-item-create",
        isCurrent && "project-select-item-current",
        className
      )}
      {...props}
    >
      <span className="project-select-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      {isCreate && <Plus className="h-3.5 w-3.5 project-select-create-icon" />}
      {!isCreate && <FolderKanban className="h-3.5 w-3.5 project-select-icon" />}
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      {isCurrent && <span className="project-select-current-badge">current</span>}
    </SelectPrimitive.Item>
  );
});
ProjectSelectItem.displayName = 'ProjectSelectItem';

export function ProjectSelect({
  value,
  onValueChange,
  projects = [],
  includeCreate = true,
  createLabel = '+ Create New Project',
  currentProjectId = null,
  disabled = false,
  className,
  placeholder = 'Select project',
}) {
  // Get display name for current value
  const selectedProject = value && value !== '__create__' ? projects.find(p => p.id === value) : null;
  const hasSelection = !!selectedProject;

  const getDisplayName = () => {
    if (!value || value === '__create__') {
      return createLabel;
    }
    if (!selectedProject) return createLabel;
    return selectedProject.name;
  };

  // Handle value change - convert __create__ to empty string for parent
  const handleValueChange = (newValue) => {
    onValueChange(newValue === '__create__' ? '' : newValue);
  };

  return (
    <SelectPrimitive.Root value={value || '__create__'} onValueChange={handleValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn("project-select-trigger", hasSelection && "has-selection", className)}
      >
        {hasSelection ? (
          <FolderKanban className="h-3.5 w-3.5 project-select-trigger-icon" />
        ) : (
          <Plus className="h-3.5 w-3.5 project-select-trigger-icon-create" />
        )}
        <SelectPrimitive.Value placeholder={placeholder}>{getDisplayName()}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="project-select-content"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="project-select-viewport">
            {includeCreate && (
              <ProjectSelectItem value="__create__" isCreate>
                {createLabel}
              </ProjectSelectItem>
            )}
            {projects.map(project => (
              <ProjectSelectItem
                key={project.id}
                value={project.id}
                isCurrent={project.id === currentProjectId}
              >
                {project.name}
              </ProjectSelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default ProjectSelect;
