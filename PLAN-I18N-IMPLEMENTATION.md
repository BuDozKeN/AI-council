# i18n Implementation Plan - Language-Agnostic Architecture

> **Goal**: Build a complete internationalization infrastructure that supports any language, starting with Spanish.
> **Created**: 2026-01-03
> **Status**: Planning Complete - Ready for Implementation
> **Estimated Effort**: 16-21 days total

---

## Executive Summary

This plan creates a **language-agnostic i18n system** where:
- Adding a new language = adding one JSON file + translating strings
- No code changes required to add languages after Phase 1
- User language preference persisted and auto-detected
- Dates, numbers, and currencies automatically format per locale

---

## Architecture Overview

```
frontend/
├── src/
│   ├── i18n/
│   │   ├── index.ts              # i18n configuration & initialization
│   │   ├── LanguageContext.tsx   # React context for language state
│   │   ├── useTranslation.ts     # Custom hook wrapper (optional)
│   │   └── locales/
│   │       ├── en.json           # English (base/fallback)
│   │       ├── es.json           # Spanish
│   │       └── [future].json     # German, French, etc.
│   ├── components/
│   │   └── settings/
│   │       └── LanguageSwitcher.tsx  # Language selection UI
│   └── lib/
│       └── dateUtils.ts          # Updated for dynamic locale

backend/
├── i18n/
│   ├── __init__.py               # i18n initialization
│   ├── messages.py               # Error message definitions
│   └── locales/
│       ├── en.json               # English error messages
│       └── es.json               # Spanish error messages
```

---

## Phase 1: Foundation (Days 1-3)

### 1.1 Install Frontend i18n Library

**File**: `frontend/package.json`

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

**Dependencies**:
- `i18next` - Core i18n framework
- `react-i18next` - React bindings
- `i18next-browser-languagedetector` - Auto-detect browser language

---

### 1.2 Create i18n Configuration

**File**: `frontend/src/i18n/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import es from './locales/es.json';

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  // Add more languages here as needed
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache user language preference
      caches: ['localStorage'],
      lookupLocalStorage: 'axcouncil_language',
    },
  });

export default i18n;
```

---

### 1.3 Create Base English Translation File

**File**: `frontend/src/i18n/locales/en.json`

Structure using **namespaced keys** for organization:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "loading": "Loading...",
    "saving": "Saving...",
    "error": "Error",
    "success": "Success",
    "confirm": "Confirm",
    "close": "Close",
    "search": "Search",
    "noResults": "No results found",
    "retry": "Retry"
  },

  "auth": {
    "signIn": "Sign In",
    "signUp": "Sign Up",
    "signOut": "Sign Out",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "forgotPassword": "Forgot password?",
    "resetPassword": "Reset Password",
    "sendResetLink": "Send Reset Link",
    "createAccount": "Create your account",
    "welcomeBack": "Welcome back",
    "continueWithGoogle": "Continue with Google",
    "orContinueWithEmail": "or continue with email",
    "dontHaveAccount": "Don't have an account?",
    "alreadyHaveAccount": "Already have an account?",
    "passwordMismatch": "Passwords do not match",
    "passwordTooShort": "Password must be at least 6 characters"
  },

  "chat": {
    "askCouncil": "Ask the council a question...",
    "askFollowUp": "Ask a follow-up (council will discuss)...",
    "askQuickFollowUp": "Ask a quick follow-up...",
    "newChat": "New Chat",
    "sendMessage": "Send message",
    "stopGeneration": "Stop generation",
    "welcomeTitle": "Welcome to AxCouncil",
    "welcomeSubtitle": "5 AI advisors will debate your question"
  },

  "sidebar": {
    "history": "History",
    "leaderboard": "Leaderboard",
    "settings": "Settings",
    "pinSidebar": "Pin sidebar open",
    "collapseSidebar": "Collapse sidebar",
    "searchConversations": "Search conversations...",
    "clearSearch": "Clear search"
  },

  "settings": {
    "title": "Settings",
    "profile": "Profile",
    "account": "Account",
    "language": "Language",
    "theme": "Theme",
    "notifications": "Notifications",
    "displayName": "Display Name",
    "emailCannotChange": "Email cannot be changed",
    "accountInfo": "Account Information",
    "profileDetails": "Profile Details"
  },

  "company": {
    "overview": "Overview",
    "team": "Team",
    "projects": "Projects",
    "playbooks": "Playbooks",
    "decisions": "Decisions",
    "activity": "Activity",
    "usage": "Usage",
    "noCompany": "No company",
    "companyWide": "Company-wide"
  },

  "context": {
    "selectDepartments": "Select departments...",
    "selectRoles": "Select roles...",
    "selectPlaybooks": "Select playbooks...",
    "addProject": "Add a new project or client",
    "resetSelections": "Reset all selections"
  },

  "stages": {
    "stage1": "Stage 1: Individual Responses",
    "stage2": "Stage 2: Peer Rankings",
    "stage3": "Stage 3: Chairman's Synthesis",
    "loadingResponses": "Loading responses...",
    "lowerIsBetter": "Lower is better",
    "topAnswer": "#1 is the top answer"
  },

  "modals": {
    "createProject": "Create Project",
    "projectCreated": "Project Created!",
    "projectName": "Project Name",
    "confirmDelete": "Confirm Delete",
    "areYouSure": "Are you sure?",
    "cannotBeUndone": "This action cannot be undone",
    "saveKnowledge": "Save Knowledge",
    "createSOP": "Create SOP",
    "createFramework": "Create Framework",
    "createPolicy": "Create Policy"
  },

  "knowledge": {
    "categories": {
      "feature": "Feature",
      "policy": "Policy",
      "process": "Process",
      "general": "General"
    },
    "scopes": {
      "department": "Department-specific",
      "company": "Company-wide",
      "project": "Project-specific"
    }
  },

  "errors": {
    "generic": "Something went wrong",
    "networkError": "Network error. Please check your connection.",
    "authRequired": "Authentication required",
    "accessDenied": "Access denied",
    "notFound": "Resource not found",
    "saveFailed": "Failed to save",
    "loadFailed": "Failed to load",
    "fileTooLarge": "File too large",
    "invalidFormat": "Invalid format"
  },

  "dates": {
    "justNow": "Just now",
    "minutesAgo": "{{count}}m ago",
    "hoursAgo": "{{count}}h ago",
    "daysAgo": "{{count}}d ago",
    "today": "Today",
    "yesterday": "Yesterday"
  },

  "aria": {
    "scrollToTop": "Scroll to top",
    "clearSearch": "Clear search",
    "openSidebar": "Open sidebar",
    "closeSidebar": "Close sidebar",
    "toggleMenu": "Toggle menu"
  }
}
```

---

### 1.4 Create Spanish Translation File

**File**: `frontend/src/i18n/locales/es.json`

```json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "create": "Crear",
    "loading": "Cargando...",
    "saving": "Guardando...",
    "error": "Error",
    "success": "Éxito",
    "confirm": "Confirmar",
    "close": "Cerrar",
    "search": "Buscar",
    "noResults": "No se encontraron resultados",
    "retry": "Reintentar"
  },

  "auth": {
    "signIn": "Iniciar sesión",
    "signUp": "Registrarse",
    "signOut": "Cerrar sesión",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "confirmPassword": "Confirmar contraseña",
    "forgotPassword": "¿Olvidaste tu contraseña?",
    "resetPassword": "Restablecer contraseña",
    "sendResetLink": "Enviar enlace",
    "createAccount": "Crea tu cuenta",
    "welcomeBack": "Bienvenido de nuevo",
    "continueWithGoogle": "Continuar con Google",
    "orContinueWithEmail": "o continuar con correo",
    "dontHaveAccount": "¿No tienes una cuenta?",
    "alreadyHaveAccount": "¿Ya tienes una cuenta?",
    "passwordMismatch": "Las contraseñas no coinciden",
    "passwordTooShort": "La contraseña debe tener al menos 6 caracteres"
  },

  "chat": {
    "askCouncil": "Pregunta al consejo...",
    "askFollowUp": "Pregunta de seguimiento (el consejo discutirá)...",
    "askQuickFollowUp": "Pregunta rápida de seguimiento...",
    "newChat": "Nueva conversación",
    "sendMessage": "Enviar mensaje",
    "stopGeneration": "Detener generación",
    "welcomeTitle": "Bienvenido a AxCouncil",
    "welcomeSubtitle": "5 asesores de IA debatirán tu pregunta"
  },

  "sidebar": {
    "history": "Historial",
    "leaderboard": "Clasificación",
    "settings": "Configuración",
    "pinSidebar": "Fijar barra lateral",
    "collapseSidebar": "Colapsar barra lateral",
    "searchConversations": "Buscar conversaciones...",
    "clearSearch": "Limpiar búsqueda"
  },

  "settings": {
    "title": "Configuración",
    "profile": "Perfil",
    "account": "Cuenta",
    "language": "Idioma",
    "theme": "Tema",
    "notifications": "Notificaciones",
    "displayName": "Nombre para mostrar",
    "emailCannotChange": "El correo no se puede cambiar",
    "accountInfo": "Información de la cuenta",
    "profileDetails": "Detalles del perfil"
  },

  "company": {
    "overview": "Resumen",
    "team": "Equipo",
    "projects": "Proyectos",
    "playbooks": "Manuales",
    "decisions": "Decisiones",
    "activity": "Actividad",
    "usage": "Uso",
    "noCompany": "Sin empresa",
    "companyWide": "Toda la empresa"
  },

  "context": {
    "selectDepartments": "Seleccionar departamentos...",
    "selectRoles": "Seleccionar roles...",
    "selectPlaybooks": "Seleccionar manuales...",
    "addProject": "Agregar un nuevo proyecto o cliente",
    "resetSelections": "Restablecer selecciones"
  },

  "stages": {
    "stage1": "Etapa 1: Respuestas individuales",
    "stage2": "Etapa 2: Rankings de pares",
    "stage3": "Etapa 3: Síntesis del presidente",
    "loadingResponses": "Cargando respuestas...",
    "lowerIsBetter": "Menor es mejor",
    "topAnswer": "#1 es la mejor respuesta"
  },

  "modals": {
    "createProject": "Crear proyecto",
    "projectCreated": "¡Proyecto creado!",
    "projectName": "Nombre del proyecto",
    "confirmDelete": "Confirmar eliminación",
    "areYouSure": "¿Estás seguro?",
    "cannotBeUndone": "Esta acción no se puede deshacer",
    "saveKnowledge": "Guardar conocimiento",
    "createSOP": "Crear SOP",
    "createFramework": "Crear marco",
    "createPolicy": "Crear política"
  },

  "knowledge": {
    "categories": {
      "feature": "Característica",
      "policy": "Política",
      "process": "Proceso",
      "general": "General"
    },
    "scopes": {
      "department": "Específico del departamento",
      "company": "Toda la empresa",
      "project": "Específico del proyecto"
    }
  },

  "errors": {
    "generic": "Algo salió mal",
    "networkError": "Error de red. Verifica tu conexión.",
    "authRequired": "Autenticación requerida",
    "accessDenied": "Acceso denegado",
    "notFound": "Recurso no encontrado",
    "saveFailed": "Error al guardar",
    "loadFailed": "Error al cargar",
    "fileTooLarge": "Archivo demasiado grande",
    "invalidFormat": "Formato inválido"
  },

  "dates": {
    "justNow": "Ahora mismo",
    "minutesAgo": "hace {{count}}m",
    "hoursAgo": "hace {{count}}h",
    "daysAgo": "hace {{count}}d",
    "today": "Hoy",
    "yesterday": "Ayer"
  },

  "aria": {
    "scrollToTop": "Volver arriba",
    "clearSearch": "Limpiar búsqueda",
    "openSidebar": "Abrir barra lateral",
    "closeSidebar": "Cerrar barra lateral",
    "toggleMenu": "Alternar menú"
  }
}
```

---

### 1.5 Initialize i18n in App

**File**: `frontend/src/main.tsx`

Add import at the top:

```typescript
import './i18n'; // Initialize i18n before App renders
```

---

### 1.6 Make Date Locale Dynamic

**File**: `frontend/src/lib/dateUtils.ts`

**Current** (line 8):
```typescript
const DATE_LOCALE = 'en-GB';
```

**Replace with**:
```typescript
import i18n from '../i18n';

// Get current locale from i18n, with fallback
const getDateLocale = (): string => {
  const lang = i18n.language || 'en';
  // Map i18n language codes to Intl locale codes
  const localeMap: Record<string, string> = {
    'en': 'en-GB',
    'es': 'es-ES',
    'de': 'de-DE',
    'fr': 'fr-FR',
    'pt': 'pt-BR',
    'ja': 'ja-JP',
  };
  return localeMap[lang] || 'en-GB';
};
```

Then update all `DATE_LOCALE` usages to call `getDateLocale()`.

**Also update relative date strings** (lines 79-82):
```typescript
// Before
if (diffMins < 1) return 'Just now';
if (diffMins < 60) return `${diffMins}m ago`;

// After
import { t } from 'i18next';
if (diffMins < 1) return t('dates.justNow');
if (diffMins < 60) return t('dates.minutesAgo', { count: diffMins });
```

---

### 1.7 Create Language Switcher Component

**File**: `frontend/src/components/settings/LanguageSwitcher.tsx`

```typescript
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    // Language preference is auto-saved to localStorage by i18next
  };

  return (
    <div className="language-switcher">
      <label htmlFor="language-select">{t('settings.language')}</label>
      <select
        id="language-select"
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## Phase 2: Core UI Components (Days 4-8)

### 2.1 Component Migration Order (Priority)

Migrate components in this order for maximum impact:

| Order | Component | Strings | Impact | File |
|-------|-----------|---------|--------|------|
| 1 | Login.tsx | 15+ | Auth flow (first impression) | `components/Login.tsx` |
| 2 | ChatInput.tsx | 12+ | Primary UX | `components/chat/ChatInput.tsx` |
| 3 | EmptyState.tsx | 4 | Welcome screen | `components/chat/EmptyState.tsx` |
| 4 | Sidebar.tsx | 8+ | Navigation | `components/Sidebar.tsx` |
| 5 | ContextBar.tsx | 12+ | Context selection | `components/chat/ContextBar.tsx` |
| 6 | ProfileSection.tsx | 8+ | Settings | `components/settings/ProfileSection.tsx` |
| 7 | Stage1.tsx | 8+ | Results display | `components/Stage1.tsx` |
| 8 | Stage2.tsx | 5+ | Results display | `components/Stage2.tsx` |
| 9 | Stage3.tsx | 3+ | Results display | `components/Stage3.tsx` |

### 2.2 Migration Pattern

For each component:

```typescript
// 1. Add import
import { useTranslation } from 'react-i18next';

// 2. Get t function in component
const { t } = useTranslation();

// 3. Replace hardcoded strings
// Before:
<Button>Save</Button>

// After:
<Button>{t('common.save')}</Button>

// 4. For interpolation:
// Before:
`${count} items`

// After:
t('items.count', { count })
```

### 2.3 Checklist for Each Component

For each component being migrated:

- [ ] Import `useTranslation`
- [ ] Replace all hardcoded strings with `t()` calls
- [ ] Update placeholders
- [ ] Update aria-labels
- [ ] Update error messages
- [ ] Update success messages
- [ ] Test in both English and Spanish

---

## Phase 3: Full Frontend Coverage (Days 9-13)

### 3.1 Remaining Components

After core components, migrate these:

| Category | Components | Est. Strings |
|----------|------------|--------------|
| Modals | ProjectModal, SaveKnowledgeModal, DeleteModal, MyCompanyModals | 25+ |
| Settings | All settings components | 15+ |
| MyCompany | All tabs (Overview, Team, Projects, etc.) | 30+ |
| UI | FormField, Select, MultiSelect, etc. | 20+ |
| Misc | Leaderboard, Billing, ErrorBoundary | 15+ |

### 3.2 Number & Currency Formatting

**File**: Create `frontend/src/lib/formatUtils.ts`

```typescript
import i18n from '../i18n';

export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(value: number): string {
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number): string {
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
  }).format(value / 100);
}
```

Then update:
- `components/mycompany/tabs/UsageTab.tsx` - currency display
- `components/ui/TokenUsageDisplay.tsx` - number formatting
- `components/stage3/Stage3Content.tsx` - cost display

---

## Phase 4: Backend Error Messages (Days 14-17)

### 4.1 Install Python i18n Library

**File**: `backend/requirements.txt`

Add:
```
python-i18n>=0.3.9
```

### 4.2 Create Backend i18n Structure

**File**: `backend/i18n/__init__.py`

```python
"""Backend internationalization support."""

import i18n
import os

# Configure i18n
i18n.set('load_path', [os.path.join(os.path.dirname(__file__), 'locales')])
i18n.set('fallback', 'en')
i18n.set('file_format', 'json')

def t(key: str, locale: str = 'en', **kwargs) -> str:
    """Translate a message key."""
    return i18n.t(key, locale=locale, **kwargs)

def get_locale_from_request(request) -> str:
    """Extract locale from Accept-Language header or user preferences."""
    # Check Accept-Language header
    accept_lang = request.headers.get('Accept-Language', 'en')
    # Parse first language preference
    lang = accept_lang.split(',')[0].split('-')[0].lower()
    # Validate it's a supported locale
    if lang in ['en', 'es', 'de', 'fr', 'pt', 'ja']:
        return lang
    return 'en'
```

### 4.3 Create Backend Translation Files

**File**: `backend/i18n/locales/en.json`

```json
{
  "errors": {
    "auth_required": "Authentication required",
    "access_denied": "Access denied",
    "resource_not_found": "Resource not found",
    "conversation_not_found": "Conversation not found",
    "company_not_found": "Company not found",
    "invalid_uuid": "Invalid %{field}: must be a valid UUID",
    "invalid_format": "Invalid %{field}: must contain only letters, numbers, underscores, and hyphens",
    "save_failed": "Failed to save",
    "update_failed": "Failed to update",
    "delete_failed": "Failed to delete",
    "request_too_large": "Request too large",
    "service_unavailable": "Service is shutting down",
    "database_error": "Database error",
    "query_too_long": "Query too long: %{count} chars exceeds limit of %{max}",
    "doc_type_invalid": "doc_type must be 'sop', 'framework', or 'policy'"
  }
}
```

**File**: `backend/i18n/locales/es.json`

```json
{
  "errors": {
    "auth_required": "Autenticación requerida",
    "access_denied": "Acceso denegado",
    "resource_not_found": "Recurso no encontrado",
    "conversation_not_found": "Conversación no encontrada",
    "company_not_found": "Empresa no encontrada",
    "invalid_uuid": "%{field} inválido: debe ser un UUID válido",
    "invalid_format": "%{field} inválido: solo debe contener letras, números, guiones bajos y guiones",
    "save_failed": "Error al guardar",
    "update_failed": "Error al actualizar",
    "delete_failed": "Error al eliminar",
    "request_too_large": "Solicitud demasiado grande",
    "service_unavailable": "El servicio se está apagando",
    "database_error": "Error de base de datos",
    "query_too_long": "Consulta demasiado larga: %{count} caracteres excede el límite de %{max}",
    "doc_type_invalid": "doc_type debe ser 'sop', 'framework' o 'policy'"
  }
}
```

### 4.4 Update Error Handlers

**File**: `backend/main.py`

Update exception handlers to use translated messages:

```python
from i18n import t, get_locale_from_request

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    locale = get_locale_from_request(request)

    # Map exception detail to translation key
    message_key = ERROR_KEY_MAP.get(exc.detail, 'errors.generic')
    translated_message = t(message_key, locale=locale)

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": translated_message}
    )
```

### 4.5 Files to Update

| File | Error Messages | Priority |
|------|----------------|----------|
| `backend/routers/conversations.py` | 10 | High |
| `backend/routers/company/decisions.py` | 11 | High |
| `backend/routers/company/llm_ops.py` | 9 | High |
| `backend/auth.py` | 3 | High |
| `backend/main.py` | 5 | High |
| `backend/routers/attachments.py` | 3 | Medium |
| `backend/routers/profile.py` | 1 | Medium |
| `backend/routers/settings.py` | 2 | Medium |

---

## Phase 5: Testing & Polish (Days 18-21)

### 5.1 Create Language Testing Checklist

Test each language with:

- [ ] Login/signup flow
- [ ] Main chat interface
- [ ] All modals open correctly
- [ ] Settings page displays correctly
- [ ] Date formatting (check format and month names)
- [ ] Number/currency formatting
- [ ] Error messages display correctly
- [ ] Toast notifications
- [ ] Placeholder text
- [ ] ARIA labels (screen reader testing)

### 5.2 Visual Regression Testing

Check for:
- [ ] Text overflow (German is ~30% longer than English)
- [ ] Button text fitting
- [ ] Modal sizing
- [ ] Sidebar width
- [ ] Mobile responsive layouts

### 5.3 Add Language to User Profile

**Database**: Add `preferred_language` column to user profile if persisting server-side.

**API**: Return user's language preference on login.

---

## Implementation Checklist

### Phase 1: Foundation (Days 1-3) ✅ COMPLETE (2026-01-03)
- [x] Install i18next packages
- [x] Create `frontend/src/i18n/index.ts`
- [x] Create `frontend/src/i18n/locales/en.json`
- [x] Create `frontend/src/i18n/locales/es.json`
- [x] Import i18n in `main.tsx`
- [x] Update `dateUtils.ts` for dynamic locale
- [x] Create `LanguageSwitcher.tsx` component
- [x] Add language switcher to Settings page (Profile tab)
- [x] Build successful - all TypeScript compiles

### Phase 2: Core UI (Days 4-8) ✅ COMPLETE (2026-01-04)
- [x] Migrate `Login.tsx`
- [x] Migrate `ChatInput.tsx`
- [x] Migrate `EmptyState.tsx`
- [x] Migrate `Sidebar.tsx`
- [x] Migrate `ContextBar.tsx`
- [x] Migrate `ProfileSection.tsx`
- [x] Migrate `Stage1.tsx`
- [x] Migrate `Stage2.tsx`
- [x] Migrate `Stage3Content.tsx` and `Stage3Actions.tsx`

### Phase 3: Full Frontend (Days 9-13) - IN PROGRESS (2026-01-04)
- [x] Migrate modal components (ProjectModal, SaveKnowledgeModal, AlertModal, ConfirmModal, DeleteModal)
- [x] Add TypeScript type safety for i18n keys (compile-time checking)
- [ ] Migrate all settings components
- [ ] Migrate all MyCompany tabs
- [ ] Migrate UI components
- [ ] Create `formatUtils.ts` for numbers/currency
- [ ] Update currency formatting across app
- [ ] Update number formatting across app

### Phase 4: Backend (Days 14-17)
- [ ] Install python-i18n
- [ ] Create `backend/i18n/__init__.py`
- [ ] Create `backend/i18n/locales/en.json`
- [ ] Create `backend/i18n/locales/es.json`
- [ ] Update error handlers in `main.py`
- [ ] Update router error messages
- [ ] Add Accept-Language header parsing

### Phase 5: Testing (Days 18-21)
- [ ] Test complete Spanish flow
- [ ] Test language switching
- [ ] Visual regression check
- [ ] Mobile testing
- [ ] Screen reader testing
- [ ] Fix any text overflow issues
- [ ] Update documentation

---

## Adding Future Languages

Once this infrastructure is in place, adding a new language (e.g., German):

1. **Create translation file**: Copy `en.json` to `de.json`
2. **Translate all strings** (or hire translator)
3. **Register in config**: Add to `supportedLanguages` array in `i18n/index.ts`:
   ```typescript
   { code: 'de', name: 'German', nativeName: 'Deutsch' }
   ```
4. **Import in config**:
   ```typescript
   import de from './locales/de.json';
   // In resources:
   de: { translation: de }
   ```
5. **Update locale mapping** in `dateUtils.ts` and `formatUtils.ts`
6. **Create backend translation**: `backend/i18n/locales/de.json`
7. **Test**

**Estimated effort per new language**: 2-3 days (translation time)

---

## Notes for Future Sessions

- **Always check** `frontend/src/i18n/locales/en.json` for the current translation keys
- **Never hardcode** new strings - always add to translation files first
- **Test in Spanish** after any UI changes
- **Keep translation files in sync** - if you add a key to `en.json`, add it to `es.json` too
- **Use namespaced keys** - `section.subsection.key` format

---

## Related Files

- [AUDIT_DASHBOARD.md](AUDIT_DASHBOARD.md) - i18n section with issue tracking
- [.claude/commands/audit-i18n.md](.claude/commands/audit-i18n.md) - Full audit checklist
