# DEPRECATED - Legacy Templates

**This folder is NOT used at runtime.** All context and configuration is now stored in the Supabase database.

## What was here

This folder previously contained markdown files for:
- `organisations/` - Company-specific context files
- `departments/` - Department templates
- `outputs/` - Output format templates
- `styles/` - Writing style templates

## Where data lives now

| Old Location | New Location |
|--------------|--------------|
| `organisations/{company}/context.md` | `companies.context_md` column in Supabase |
| `departments/{dept}/context.md` | `departments.context_md` column in Supabase |
| `departments/{dept}/roles/{role}.md` | `roles.system_prompt` column in Supabase |

## How to edit context

1. **Via UI**: Use the My Company interface in the app
2. **Via Database**: Edit the `context_md` or `system_prompt` columns directly in Supabase

## Why we migrated

- Multi-tenant support with Row Level Security (RLS)
- Real-time updates without redeploying
- Proper data isolation between companies
- Easier backup and restore

See the main [README.md](../README.md) for current architecture documentation.
