# First-Time Setup

Run this command when setting up AxCouncil on a new machine or after cloning the repository.

## Steps to Execute

1. **Verify we're in the correct directory**
   - Check that `.claude-workspace` file exists
   - If not, ask user to confirm this is the correct folder

2. **Install frontend dependencies**
   ```bash
   cd frontend && npm install
   ```

3. **Install backend dependencies**
   ```bash
   pip install -e ".[dev]"
   ```

4. **Install pre-commit hooks (optional)**
   ```bash
   pre-commit install
   ```

5. **Check environment variables**
   - Verify `.env` file exists
   - If not, copy from `.env.example`
   - Check that required variables are set:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `OPENROUTER_API_KEY`

6. **Verify GitHub CLI is installed and authenticated**
   ```bash
   gh auth status
   ```
   - If not authenticated, guide user through `gh auth login`

7. **Run a quick validation**
   ```bash
   cd frontend && npm run type-check
   ```

8. **Report setup status**
   - List any missing dependencies or configuration
   - Confirm setup is complete

## Expected Output

```
=== AxCouncil Setup ===
✓ Working directory verified
✓ Frontend dependencies installed
✓ Backend dependencies installed
✓ Pre-commit hooks installed
✓ Environment variables configured
✓ GitHub CLI authenticated
✓ TypeScript validation passed
=== Setup Complete ===
```
