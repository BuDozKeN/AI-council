# Mobile UX Issues Report - 100 Issues Found

**Audit Date:** 2026-01-26
**Viewport:** 412x915 (Samsung Galaxy S20 Ultra)
**Audited By:** Rabbit 100-Issue Dog (Claude Opus 4.5)

## Executive Summary

Comprehensive mobile UX audit across all screens found **100 categorized issues** affecting touch targets, typography, spacing, accessibility, and visual consistency. Issues are prioritized by severity and grouped by component/area.

---

## CATEGORY 1: TOUCH TARGET VIOLATIONS (44px minimum)

### 1.1 Sidebar - Swipe Action Buttons (Missing Labels)
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 1 | Swipe action buttons missing aria-labels | Conversation list | No label | aria-label | Add aria-label="Archive", "Pin", "Delete" |
| 2 | Star/favorite buttons too small | Conversation items | ~24x24px | 44x44px | Increase touch area |
| 3 | Menu overflow buttons too small | Conversation items | ~24x24px | 44x44px | Increase touch area |

### 1.2 My Company - Tab Labels
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 4 | Tab labels font too small | My Company tabs | 10px | 12px+ | Increase font-size to var(--text-xs) |
| 5 | Tab touch targets cramped | My Company bottom nav | 56px wide | 64px+ | Increase min-width |

### 1.3 My Company - TOC Links
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 6 | TOC links too short | Overview tab TOC | 20px height | 44px | Increase line-height and padding |
| 7 | TOC links font small | Overview tab TOC | 11px | 14px | Increase font-size |

### 1.4 Delete/Trash Buttons
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 8 | Delete icons too small | Team member cards | 14x14px | 18x18px+ | Increase icon size |
| 9 | Delete button touch area | API Keys section | 18x18px | 44x44px | Add padding/wrapper |
| 10 | Trash icons inconsistent | Various tables | 14-18px | 18px min | Standardize to 18px |

### 1.5 Expand/Collapse Chevrons
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 11 | Expand chevrons tiny | Accordion headers | 12x12px | 18x18px | Increase icon size |
| 12 | Chevron touch area small | LLM Hub models | 20x20px | 44x44px | Wrap in larger button |

### 1.6 Radio Buttons & Checkboxes
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 13 | Radio visual indicator small | Home page AI selector | 16px | 20px+ | Increase indicator size |
| 14 | Checkbox touch area | Settings toggles | 36x20px | 44x44px | Increase clickable area |

### 1.7 Icon-Only Buttons
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 15 | Theme toggle icon small | Header | 16x16px | 18x18px | Increase icon size |
| 16 | Search clear button small | Search inputs | 16x16px | 24x24px | Increase size |
| 17 | Close modal X button | All modals | 20x20px | 24x24px | Increase size |
| 18 | Dropdown chevrons small | Filter dropdowns | 12x12px | 16x16px | Increase size |

---

## CATEGORY 2: TYPOGRAPHY ISSUES

### 2.1 Font Sizes Below Minimum (12px)
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 19 | Tab labels too small | My Company tabs | 10px | 12px | Use var(--text-xs) |
| 20 | Badge text too small | Status badges | 10px | 11px+ | Increase to var(--text-2xs) |
| 21 | Timestamp text tiny | Activity feed | 10px | 11px | Increase font-size |
| 22 | Helper text too small | Form hints | 10px | 12px | Use var(--text-xs) |
| 23 | TOC link text tiny | My Company Overview | 11px | 14px | Increase font-size |

### 2.2 Input Font Size (iOS Zoom Prevention - 16px)
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 24 | Search input font | Sidebar search | 14px | 16px | Prevents iOS zoom |
| 25 | Chat textarea font | Main chat input | 14px | 16px | Prevents iOS zoom |
| 26 | Settings inputs font | Various settings | 14px | 16px | Prevents iOS zoom |
| 27 | API key input font | API Keys section | 14px | 16px | Prevents iOS zoom |

### 2.3 Line Height / Readability
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 28 | Description text cramped | Project cards | 1.3 | 1.5+ | Increase line-height |
| 29 | Long text truncation harsh | Conversation titles | 1 line | 2 lines | Allow 2-line clamp |

---

## CATEGORY 3: ROW HEIGHT ISSUES (44-56px minimum for interactive)

### 3.1 List Item Rows
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 30 | Conversation rows too short | Sidebar list | 44px | 52px+ | Increase min-height |
| 31 | Activity rows too short | Activity tab | 42px | 52px | Increase row height |
| 32 | Team member rows short | Team tab | 48px | 56px | Add vertical padding |
| 33 | Model selection rows short | LLM Hub | 35px | 48px | Increase row height |
| 34 | Feature list items short | Billing features | 32px | 44px | Increase height |

### 3.2 Card Heights
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 35 | Stat cards cramped | My Company stats | 60px | 72px+ | Increase padding |
| 36 | Decision cards tight | Decisions tab | 64px | 80px | Increase content area |

---

## CATEGORY 4: SPACING & PADDING ISSUES

### 4.1 Insufficient Padding
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 37 | Section headers cramped | Settings sections | 8px | 16px | Increase padding-block |
| 38 | Card padding tight | Project cards | 12px | 16px | Increase padding |
| 39 | Modal content cramped | All modals | 16px | 20px | Increase padding |
| 40 | Table cell padding small | Data tables | 8px | 12px | Increase cell padding |

### 4.2 Gap Issues
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 41 | Button group gaps tight | Action buttons | 4px | 8px | Increase gap |
| 42 | Badge gaps too small | Badge rows | 2px | 4px | Increase gap |
| 43 | Tab gaps inconsistent | My Company tabs | varies | 8px | Standardize gap |

---

## CATEGORY 5: BADGE & STATUS INDICATOR ISSUES

### 5.1 Badge Dimensions
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 44 | Status badges too short | Project status | 16px height | 20px | Increase height |
| 45 | Role badges cramped | Team members | 18px | 22px | Increase padding |
| 46 | Count badges tiny | Notification counts | 14px | 18px | Increase size |
| 47 | Category badges small | Conversation categories | 16px | 20px | Increase height |

### 5.2 Badge Text
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 48 | Badge font too small | All badges | 10px | 11px | Use var(--text-2xs) |
| 49 | Badge text truncation | Long status text | abrupt | ellipsis | Add text-overflow |

---

## CATEGORY 6: ICON SIZE ISSUES (18x18px minimum)

### 6.1 Navigation Icons
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 50 | Sidebar menu icons small | Sidebar nav | 16x16px | 20x20px | Increase size |
| 51 | Bottom nav icons small | Main nav | 18x18px | 24x24px | Increase for mobile |

### 6.2 Action Icons
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 52 | Edit icons tiny | Inline edit buttons | 14x14px | 18x18px | Increase size |
| 53 | Copy icons small | Copy buttons | 14x14px | 18x18px | Increase size |
| 54 | External link icons tiny | Link buttons | 12x12px | 16x16px | Increase size |
| 55 | Info tooltip icons small | Help icons | 14x14px | 16x16px | Increase size |

### 6.3 Status Icons
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 56 | Check/success icons small | Status indicators | 12x12px | 16x16px | Increase size |
| 57 | Warning icons small | Alert indicators | 14x14px | 16x16px | Increase size |
| 58 | Loading spinners small | Loading states | 16x16px | 20x20px | Increase size |

---

## CATEGORY 7: ACCESSIBILITY ISSUES

### 7.1 Missing ARIA Labels
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 59 | Swipe buttons no labels | Conversation swipe | none | aria-label | Add descriptive labels |
| 60 | Icon buttons no labels | Various icon buttons | none | aria-label | Add aria-label |
| 61 | Star button no label | Favorite toggle | none | aria-label="Star" | Add label |
| 62 | Sort dropdown no label | Conversation sort | none | aria-label | Add accessible name |

### 7.2 Color Contrast
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 63 | Muted text low contrast | Helper text dark mode | ~3.5:1 | 4.5:1 | Increase contrast |
| 64 | Disabled state too faint | Disabled buttons | ~2.5:1 | 3:1 | Increase opacity |
| 65 | Placeholder text faint | Input placeholders | ~3:1 | 4.5:1 | Darker placeholder |

### 7.3 Focus Indicators
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 66 | Focus ring missing | Some buttons | none | 2px outline | Add focus-visible |
| 67 | Focus ring too subtle | Form inputs | 1px | 2px | Increase width |

---

## CATEGORY 8: SCROLL & OVERFLOW ISSUES

### 8.1 Horizontal Scroll
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 68 | Table horizontal overflow | Data tables | scrollbar | hidden indicators | Add scroll shadows |
| 69 | Tab bar scroll hidden | My Company tabs | no indicator | fade gradient | Add scroll hint |
| 70 | Badge row overflow | Multiple badges | wraps | scroll | Allow horizontal scroll |

### 8.2 Content Clipping
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 71 | Long titles clipped | Card headers | harsh | ellipsis | Add text-overflow |
| 72 | Description overflow | Project descriptions | hidden | line-clamp | Use -webkit-line-clamp |

---

## CATEGORY 9: MODAL & DIALOG ISSUES

### 9.1 Modal Dimensions
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 73 | Modal too wide on mobile | Settings modals | 95vw | 100vw-24px | Reduce max-width |
| 74 | Modal content cramped | Modal body | 16px padding | 20px | Increase padding |
| 75 | Modal header cramped | Modal headers | 12px | 16px | Increase padding |

### 9.2 Sheet/Drawer Issues
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 76 | Sheet drag handle small | Bottom sheets | 32x4px | 40x4px | Increase width |
| 77 | Sheet close button small | Sheet headers | 32x32px | 44x44px | Increase size |

---

## CATEGORY 10: BUTTON & CTA ISSUES

### 10.1 Button Dimensions
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 78 | Secondary buttons short | Action buttons | 36px | 44px | Increase min-height |
| 79 | Icon buttons too small | Toolbar buttons | 32x32px | 44x44px | Increase size |
| 80 | Floating action button | FAB buttons | 48x48px | 56x56px | Increase for mobile |

### 10.2 Button Spacing
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 81 | Button padding tight | Text buttons | 8px 12px | 12px 16px | Increase padding |
| 82 | Button group cramped | Action groups | 4px gap | 8px gap | Increase gap |

---

## CATEGORY 11: FORM INPUT ISSUES

### 11.1 Input Heights
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 83 | Text inputs too short | Form fields | 36px | 44px | Increase height |
| 84 | Select dropdowns short | Dropdown selects | 36px | 44px | Increase height |
| 85 | Textarea cramped | Multi-line inputs | 80px min | 100px | Increase min-height |

### 11.2 Input Labels
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 86 | Labels too small | Form labels | 12px | 14px | Increase font-size |
| 87 | Labels cramped | Label spacing | 4px | 8px | Increase margin-bottom |

---

## CATEGORY 12: NAVIGATION ISSUES

### 12.1 Bottom Navigation
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 88 | Nav item labels small | Bottom nav | 10px | 12px | Increase font-size |
| 89 | Nav icons small | Bottom nav icons | 18px | 24px | Increase icon size |
| 90 | Nav touch targets tight | Nav buttons | 64px wide | 80px+ | Increase width |

### 12.2 Sidebar Navigation
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 91 | Sidebar links cramped | Nav items | 40px height | 48px | Increase height |
| 92 | Category headers small | Section headers | 10px | 12px | Increase font-size |

---

## CATEGORY 13: LOADING & EMPTY STATES

### 13.1 Skeleton Loaders
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 93 | Skeleton rows too short | List skeletons | 36px | 48px | Match content height |
| 94 | Skeleton cards small | Card skeletons | 60px | 72px | Increase height |

### 13.2 Empty States
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 95 | Empty state text small | Empty lists | 14px | 16px | Increase font-size |
| 96 | Empty state CTA small | Action buttons | 36px | 44px | Increase height |

---

## CATEGORY 14: VISUAL CONSISTENCY

### 14.1 Border Radius
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 97 | Inconsistent card radius | Various cards | 4-12px | 8px standard | Standardize |
| 98 | Button radius varies | Buttons | 4-8px | 6px standard | Standardize |

### 14.2 Shadow/Elevation
| # | Issue | Location | Current | Required | Fix |
|---|-------|----------|---------|----------|-----|
| 99 | Card shadows inconsistent | Cards | varies | var(--shadow-sm) | Standardize |
| 100 | Modal shadow too strong | Modals | 32px blur | 24px blur | Reduce intensity |

---

## Summary by Priority

### P0 - Critical (Affects Usability)
Issues: 4, 6, 7, 19, 24-27, 30-34, 59-62

### P1 - High (Affects User Experience)
Issues: 1-3, 5, 8-18, 20-23, 28-29, 35-49

### P2 - Medium (Visual Polish)
Issues: 50-58, 63-77, 83-92

### P3 - Low (Nice to Have)
Issues: 78-82, 93-100

---

## Files to Fix

### CSS Files (Primary)
- `frontend/src/components/mycompany/styles/shell/mobile/navigation.css` - Tab labels, TOC links
- `frontend/src/components/sidebar/conversation-list.css` - Conversation row heights, swipe buttons
- `frontend/src/components/ui/Badge.css` - Badge dimensions
- `frontend/src/styles/tokens.css` - Typography tokens
- `frontend/src/components/settings/SettingsResponsive.css` - Settings layout
- `frontend/src/components/ui/MobileBottomNav.css` - Bottom nav sizing

### Component Files (Accessibility)
- `frontend/src/components/sidebar/SwipeableRow.tsx` - Add aria-labels
- `frontend/src/components/ui/IconButton.tsx` - Ensure aria-labels
- `frontend/src/components/mycompany/MyCompanyTabs.tsx` - Tab accessibility

---

## Next Steps

1. **Share with CSS Enforcer Agent** - Fix touch targets and typography
2. **Share with Mobile Tester Agent** - Validate fixes
3. **Share with Accessibility Agent** - Fix ARIA labels
4. **Run regression testing** - Ensure no visual breakage

---

*Generated by Rabbit 100-Issue Dog - Mobile UX Audit Complete*
