/**
 * Shared constants for MyCompany components
 */

import { ScrollText, Layers, FileText } from 'lucide-react';

// Document type definitions shared across modals
export const DOC_TYPES = [
  { value: 'sop', label: 'SOP', icon: ScrollText },
  { value: 'framework', label: 'Framework', icon: Layers },
  { value: 'policy', label: 'Policy', icon: FileText }
];
