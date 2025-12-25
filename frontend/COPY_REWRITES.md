# AxCouncil Copy Rewrites — UX Psychology Audit Implementation

This document tracks the copy changes made to warm up the product's voice, reduce anxiety, and add personality.

---

## Error Messages (Tier 1: Highest Impact)

| Location | Before | After |
|----------|--------|-------|
| `ConversationContext.tsx:195` | "Failed to load conversation" | "We couldn't load that conversation. Please try again." |
| `ConversationContext.tsx:299` | "Failed to star conversation" | "Couldn't update that conversation. Please try again." |
| `ConversationContext.tsx:331` | "Failed to rename conversation" | "Couldn't rename that conversation. Please try again." |
| `ConversationContext.tsx:344` | "Failed to delete conversation" | "Couldn't delete that conversation. Please try again." |
| `ErrorBoundary.tsx:91-94` | "Something went wrong / We apologize for the inconvenience. An unexpected error occurred." | "Oops, something broke / Don't worry — your work is safe. Let's get you back on track." |
| `Organization.tsx` | "Company not found" | "We couldn't find that company. It may have been removed." |
| `Organization.tsx` | "Failed to load organization structure" | "Couldn't load your team structure. Please try again." |
| `ProjectModal.tsx:70` | "Please describe your project" | "Tell us a bit about your project first" |
| `ProjectModal.tsx:86` | "AI could not structure the content. Please try again or add more detail." | "We couldn't quite understand that. Try adding more detail, or skip AI and enter it manually." |
| `ProjectModal.tsx:90` | "Failed to process with AI. Please try again." | "Something went wrong with AI. You can try again or skip to manual entry." |
| `ProjectModal.tsx:111` | "Project name is required" | "Your project needs a name" |
| `ProjectModal.tsx:134` | "Failed to create project" | "Couldn't create your project. Please try again." |
| `Billing.tsx:32` | "Failed to load billing information" | "Couldn't load your billing info. Please try again." |
| `Billing.tsx:47` | "Failed to start checkout" | "Something went wrong. Please try again." |
| `Billing.tsx:61` | "Failed to open billing portal" | "Couldn't open billing portal. Please try again." |
| `Leaderboard.tsx:28` | "Failed to load leaderboard" | "Couldn't load the leaderboard right now. Please try again." |
| `Sidebar.tsx:103` | "Failed to move conversation" | "Couldn't move that conversation. Please try again." |
| `SaveKnowledgeModal.tsx:276` | "Failed to create project" | "Couldn't create that project. Please try again." |
| `SaveKnowledgeModal.tsx:362` | "Failed to save knowledge entry" | "Couldn't save your decision. Please try again." |
| `Stage3Actions.tsx:49` | "Failed to save. Please try again." | "Couldn't save that. Let's try again." |

---

## Empty States (Tier 2: Encouragement)

| Location | Before | After |
|----------|--------|-------|
| `chat/EmptyState.tsx:15` | "Create a new conversation to get started" | "Your AI council is ready. What decision can we help with?" |
| `chat/EmptyState.tsx:31` | "Get insights from 5 AI models who debate and synthesize the best answer" | "5 AI advisors will debate your question and synthesize the best answer" |
| `Sidebar.tsx:555-556` | "No conversations yet / Click 'New' to start" | "Ready when you are / Start a new conversation to ask your council" |
| `Sidebar.tsx:561` | "No archived conversations" | "Nothing archived yet" |
| `ActivityTab.tsx:77-79` | "No activity yet / Activity will appear here as you use the council..." | "All quiet here / Your team's activity will show up as you use the council..." |
| `PlaybooksTab.tsx:85-86` | "No playbooks yet / Create SOPs, frameworks, and policies for your AI council" | "Build your knowledge base / Create SOPs, frameworks, and policies that your AI council will reference" |
| `ProjectsTab.tsx:113-116` | "No projects yet / Create projects to organize council sessions..." | "Start your first project / Projects help you organize related decisions..." |
| `TeamTab.tsx:31-32` | "No departments yet / Add your first department to organize your AI council" | "Set up your team / Add departments and roles to help your council understand your organization" |
| `TeamTab.tsx:140` | "No roles defined" | "Add roles to this department" |

---

## Loading Messages (Tier 3: Warmth)

| Location | Before | After |
|----------|--------|-------|
| `Stage1.tsx:390` | "Waiting for models to respond..." | "Your council is gathering their thoughts..." |
| `ChatInterface.tsx:407` | "Setting up conversation..." | "Preparing your council..." |
| `ChatInterface.tsx:287` | "Loading conversation..." | "Getting your conversation ready..." |
| `ChatInterface.tsx:358` | "Analyzing your question..." | "Understanding what you need..." |
| `InsightsPanel.tsx:176-177` | "The Council is thinking... / We'll show you anything that needs your attention" | "Your council is deliberating... / We'll surface anything that needs your input" |
| `StageProgress.tsx:67` | "Advisors are checking each other's suggestions..." | "Your advisors are peer-reviewing each other..." |
| `StageProgress.tsx:75` | "Combining the best ideas into your answer..." | "Synthesizing the best insights for you..." |

---

## Celebration Moments (Tier 4: Delight)

| Location | Enhancement |
|----------|-------------|
| `Stage3.css` | Added `save-celebration` keyframe animation (scale bounce 0.95 → 1.02 → 1) to `.save-status-group` |
| `useSaveActions.ts` | Added haptic feedback (`navigator.vibrate([10, 50, 10])`) on successful save |

---

## Voice & Tone Guidelines

### Principles Applied

1. **Use "we" and "your"** — Makes the app feel collaborative, not robotic
2. **Contractions are friendly** — "Couldn't" beats "Could not"
3. **Action-oriented recovery** — Always suggest next steps
4. **Avoid blame** — "We couldn't" rather than "You failed to"
5. **Specific over generic** — "your project" not "the project"
6. **Casual but professional** — Warm without being unprofessional

### Pattern Examples

**Error messages:**
- ❌ "Failed to [action]"
- ✅ "Couldn't [action]. Please try again." or "We couldn't [action]."

**Empty states:**
- ❌ "No [items] yet"
- ✅ "[Encouraging action verb]" + helpful hint

**Loading states:**
- ❌ "Loading..."
- ✅ "[What's happening in human terms]..."

---

## Files Modified

- `frontend/src/contexts/ConversationContext.tsx`
- `frontend/src/components/ErrorBoundary.tsx`
- `frontend/src/components/Organization.tsx`
- `frontend/src/components/ProjectModal.tsx`
- `frontend/src/components/Billing.tsx`
- `frontend/src/components/Leaderboard.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/SaveKnowledgeModal.tsx`
- `frontend/src/components/stage3/Stage3Actions.tsx`
- `frontend/src/components/stage3/hooks/useSaveActions.ts`
- `frontend/src/components/Stage3.css`
- `frontend/src/components/chat/EmptyState.tsx`
- `frontend/src/components/ChatInterface.tsx`
- `frontend/src/components/Stage1.tsx`
- `frontend/src/components/mycompany/tabs/ActivityTab.tsx`
- `frontend/src/components/mycompany/tabs/PlaybooksTab.tsx`
- `frontend/src/components/mycompany/tabs/ProjectsTab.tsx`
- `frontend/src/components/mycompany/tabs/TeamTab.tsx`
- `frontend/src/components/deliberation/InsightsPanel.tsx`
- `frontend/src/components/deliberation/StageProgress.tsx`
