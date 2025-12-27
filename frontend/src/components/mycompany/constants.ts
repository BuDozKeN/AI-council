/**
 * Shared constants for MyCompany components
 */

import { ScrollText, Layers, FileText } from 'lucide-react';

// Document type definitions shared across modals
export const DOC_TYPES = [
  { value: 'sop' as const, label: 'SOP', icon: ScrollText },
  { value: 'framework' as const, label: 'Framework', icon: Layers },
  { value: 'policy' as const, label: 'Policy', icon: FileText }
];
