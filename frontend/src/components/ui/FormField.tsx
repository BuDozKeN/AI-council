import { forwardRef, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import './FormField.css';

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * FormField - Unified form input component
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className = '',
  children
}: FormFieldProps) {
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

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/**
 * Input - Styled text input
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`form-input ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
  rows?: number;
}

/**
 * Textarea - Styled textarea
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = '', rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    className={`form-textarea ${className}`}
    rows={rows}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  children?: ReactNode;
}

/**
 * NativeSelect - Styled native select (for simple cases)
 * For complex selects, use the Radix Select component
 */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(({ className = '', children, ...props }, ref) => (
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
