/**
 * Context providers for AI Council frontend
 *
 * These contexts extract state management from App.jsx to reduce complexity
 * and eliminate prop drilling.
 *
 * Usage in main.jsx:
 *   <AuthProvider>
 *     <BusinessProvider>
 *       <ConversationProvider>
 *         <UIProvider>
 *           <App />
 *         </UIProvider>
 *       </ConversationProvider>
 *     </BusinessProvider>
 *   </AuthProvider>
 */

export { BusinessProvider, useBusiness } from './BusinessContext';
export { ConversationProvider, useConversation } from './ConversationContext';
export { UIProvider, useUI } from './UIContext';
