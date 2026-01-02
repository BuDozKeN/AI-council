import { forwardRef, useId, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, isValidElement, cloneElement, Children, ReactElement } from 'react';
import './FormField.css';

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children?: ReactNode;
  /** Optional explicit ID for the input. If not provided, one will be generated. */
  inputId?: string;
}

/**
 * FormField - Unified form input component
 *
 * Accessibility: Automatically associates labels with inputs via htmlFor/id.
 * The component generates a unique ID for the input if one is not provided.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className = '',
  children,
  inputId: explicitInputId
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = explicitInputId || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  // Clone the child input element to inject accessibility attributes
  const enhancedChildren = Children.map(children, (child) => {
    if (isValidElement(child)) {
      // Build aria-describedby from hint and error IDs
      const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

      const additionalProps: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean } = {
        id: inputId,
      };
      if (describedBy) {
        additionalProps['aria-describedby'] = describedBy;
      }
      if (error) {
        additionalProps['aria-invalid'] = true;
      }
      return cloneElement(child as ReactElement<typeof additionalProps>, additionalProps);
    }
    return child;
  });

  return (
    <div className={`form-field ${error ? 'form-field-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-field-label">
          {label}
          {required && <span className="form-field-required" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </label>
      )}
      {hint && <p id={hintId} className="form-field-hint">{hint}</p>}
      <div className="form-field-input">
        {enhancedChildren}
      </div>
      {error && <p id={errorId} className="form-field-error-text" role="alert">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  /**
   * Optimizes mobile keyboard for specific input types.
   * Common values: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal' | 'search'
   */
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  /**
   * Enables browser autofill. Common values:
   * - 'email', 'tel', 'name', 'given-name', 'family-name'
   * - 'street-address', 'postal-code', 'country'
   * - 'username', 'current-password', 'new-password'
   * - 'one-time-code' (for OTP inputs)
   */
  autoComplete?: string;
}

/**
 * Input - Styled text input with mobile keyboard optimization
 *
 * @example
 * // Email input with proper keyboard
 * <Input type="email" inputMode="email" autoComplete="email" />
 *
 * // Phone input
 * <Input type="tel" inputMode="tel" autoComplete="tel" />
 *
 * // Numeric input (no decimals)
 * <Input inputMode="numeric" pattern="[0-9]*" />
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
