import { forwardRef } from 'react';
import './FormField.css';

/**
 * FormField - Unified form input component
 *
 * Provides consistent styling for all form inputs across the app.
 * Supports text inputs, textareas, and select elements.
 *
 * Usage:
 *   <FormField label="Name" required>
 *     <input type="text" value={name} onChange={...} placeholder="Enter name" />
 *   </FormField>
 *
 *   <FormField label="Description" hint="Optional context">
 *     <textarea value={desc} onChange={...} rows={3} />
 *   </FormField>
 *
 * Props:
 *   - label: Field label text
 *   - hint: Helper text below the label
 *   - error: Error message to display
 *   - required: Show required indicator
 *   - className: Additional class for the wrapper
 *   - children: The input/textarea/select element
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className = '',
  children
}) {
  return (
    <div className={`form-field ${error ? 'form-field-error' : ''} ${className}`}>
      {label && (
        <label className="form-field-label">
          {label}
          {required && <span className="form-field-required">*</span>}
        </label>
      )}
      {hint && <p className="form-field-hint">{hint}</p>}
      <div className="form-field-input">
        {children}
      </div>
      {error && <p className="form-field-error-text">{error}</p>}
    </div>
  );
}

/**
 * Input - Styled text input
 */
export const Input = forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`form-input ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

/**
 * Textarea - Styled textarea
 */
export const Textarea = forwardRef(({ className = '', rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    className={`form-textarea ${className}`}
    rows={rows}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/**
 * NativeSelect - Styled native select (for simple cases)
 * For complex selects, use the Radix Select component
 */
export const NativeSelect = forwardRef(({ className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`form-select ${className}`}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';

export default FormField;
