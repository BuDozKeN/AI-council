/**
 * ProjectSelect - A Select component for project selection
 *
 * Uses Radix Select for desktop and BottomSheet for mobile.
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
 *   createLabel="New Project"
 *   disabled={false}
 *   className="custom-class"
 * />
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, FolderKanban, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import type { Project } from '../../types/business';
import './ProjectSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

interface ProjectSelectItemProps extends React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Item
> {
  isCreate?: boolean;
  isCurrent?: boolean;
  currentLabel?: string;
}

// Custom SelectItem for projects
const ProjectSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  ProjectSelectItemProps
>(({ className, children, isCreate = false, isCurrent = false, currentLabel, ...props }, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'project-select-item',
        isCreate && 'project-select-item-create',
        isCurrent && 'project-select-item-current',
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
      {isCurrent && <span className="project-select-current-badge">{currentLabel}</span>}
    </SelectPrimitive.Item>
  );
});
ProjectSelectItem.displayName = 'ProjectSelectItem';

interface ProjectSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  projects?: Project[];
  includeCreate?: boolean;
  createLabel?: string;
  currentProjectId?: string | null;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function ProjectSelect({
  value,
  onValueChange,
  projects = [],
  includeCreate = true,
  createLabel,
  currentProjectId = null,
  disabled = false,
  className,
  placeholder,
}: ProjectSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const actualCreateLabel = createLabel || t('modals.newProject');
  const actualPlaceholder = placeholder || t('stages.selectProject');
  const currentBadgeLabel = t('projects.current');

  // Get display name for current value
  const selectedProject =
    value && value !== '__create__' ? projects.find((p) => p.id === value) : null;
  const hasSelection = !!selectedProject;

  const getDisplayName = () => {
    if (!value || value === '__create__') {
      return actualCreateLabel;
    }
    if (!selectedProject) return actualCreateLabel;
    return selectedProject.name;
  };

  // Handle value change - convert __create__ to empty string for parent
  const handleValueChange = (newValue: string) => {
    onValueChange(newValue === '__create__' ? '' : newValue);
  };

  const handleSelect = (projectValue: string) => {
    handleValueChange(projectValue);
    setOpen(false);
  };

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('project-select-trigger', hasSelection && 'has-selection', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          {hasSelection ? (
            <FolderKanban className="h-3.5 w-3.5 project-select-trigger-icon" />
          ) : (
            <Plus className="h-3.5 w-3.5 project-select-trigger-icon-create" />
          )}
          <span>{getDisplayName()}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>

        <BottomSheet isOpen={open} onClose={() => setOpen(false)} title={t('stages.selectProject')}>
          <div className="project-select-list-mobile">
            {includeCreate && (
              <button
                className={cn(
                  'project-select-item-mobile project-select-item-create-mobile',
                  (!value || value === '__create__') && 'selected'
                )}
                onClick={() => handleSelect('__create__')}
                type="button"
              >
                <div
                  className={cn(
                    'project-select-radio',
                    (!value || value === '__create__') && 'checked'
                  )}
                >
                  {(!value || value === '__create__') && <Check className="h-3 w-3" />}
                </div>
                <Plus className="h-4 w-4 project-select-create-icon-mobile" />
                <span className="project-select-item-label">{actualCreateLabel}</span>
              </button>
            )}
            {projects.map((project) => {
              const isSelected = project.id === value;
              const isCurrent = project.id === currentProjectId;
              return (
                <button
                  key={project.id}
                  className={cn('project-select-item-mobile', isSelected && 'selected')}
                  onClick={() => handleSelect(project.id)}
                  type="button"
                >
                  <div className={cn('project-select-radio', isSelected && 'checked')}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <FolderKanban className="h-4 w-4 project-select-icon-mobile" />
                  <span className="project-select-item-label">{project.name}</span>
                  {isCurrent && <span className="project-select-current-badge">{currentBadgeLabel}</span>}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Radix Select
  return (
    <SelectPrimitive.Root
      value={value || '__create__'}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn('project-select-trigger', hasSelection && 'has-selection', className)}
      >
        {hasSelection ? (
          <FolderKanban className="h-3.5 w-3.5 project-select-trigger-icon" />
        ) : (
          <Plus className="h-3.5 w-3.5 project-select-trigger-icon-create" />
        )}
        <SelectPrimitive.Value placeholder={actualPlaceholder}>{getDisplayName()}</SelectPrimitive.Value>
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
                {actualCreateLabel}
              </ProjectSelectItem>
            )}
            {projects.map((project) => (
              <ProjectSelectItem
                key={project.id}
                value={project.id}
                isCurrent={project.id === currentProjectId}
                currentLabel={currentBadgeLabel}
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
