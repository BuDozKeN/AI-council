"""
Onboarding Router

Endpoints for the Zero Friction onboarding flow:
- LinkedIn profile analysis
- Magic question generation
- Trial status management
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
import re

from ..auth import get_current_user, get_optional_user
from ..security import log_app_event

# Import rate limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class OnboardingDepartment(BaseModel):
    """Department generated for the user's council."""
    id: str
    name: str
    icon: str
    purpose: str


class OnboardingProfile(BaseModel):
    """Complete onboarding profile returned after analysis."""
    full_name: str
    role: str
    company: str
    industry: str
    employees: int
    bio: str
    magic_question: str
    departments: List[OnboardingDepartment]


class AnalyzeProfileRequest(BaseModel):
    """Request to analyze a LinkedIn profile."""
    linkedin_url: str = Field(..., description="LinkedIn profile URL")


class AnalyzeProfileResponse(BaseModel):
    """Response from profile analysis."""
    success: bool
    profile: Optional[OnboardingProfile] = None
    error: Optional[str] = None
    fallback_required: bool = False


class TrialStatusResponse(BaseModel):
    """Trial status for the current user."""
    has_trial_available: bool
    has_api_key: bool
    can_run_council: bool
    trial_used_at: Optional[str] = None


class UseTrialRequest(BaseModel):
    """Request to mark trial as used."""
    pass  # No body needed - uses auth token


# =============================================================================
# LINKEDIN URL VALIDATION
# =============================================================================

LINKEDIN_URL_PATTERN = re.compile(
    r'^https?://(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)/?.*$',
    re.IGNORECASE
)


def validate_linkedin_url(url: str) -> tuple[bool, Optional[str]]:
    """
    Validate LinkedIn URL and extract username.

    Returns:
        (is_valid, username_or_error)
    """
    if not url:
        return False, "LinkedIn URL is required"

    match = LINKEDIN_URL_PATTERN.match(url.strip())
    if not match:
        return False, "Invalid LinkedIn URL format. Expected: linkedin.com/in/username"

    username = match.group(1)
    if len(username) < 2:
        return False, "Invalid LinkedIn username"

    return True, username


# =============================================================================
# DEPARTMENT GENERATION (Rule-Based)
# =============================================================================

# Role keywords mapped to department suggestions
ROLE_DEPARTMENT_MAP = {
    # Founder/CEO roles
    frozenset(["founder", "ceo", "owner", "president", "director", "principal"]): [
        {"name": "Executive Strategy", "icon": "crown", "purpose": "High-level strategic decisions and company direction"},
        {"name": "Business Operations", "icon": "settings", "purpose": "Day-to-day operational efficiency"},
        {"name": "Growth & Revenue", "icon": "rocket", "purpose": "Revenue growth and market expansion"},
    ],
    # Marketing roles
    frozenset(["cmo", "marketing", "growth", "brand", "content"]): [
        {"name": "Brand Strategy", "icon": "crown", "purpose": "Brand positioning and market perception"},
        {"name": "Performance Marketing", "icon": "rocket", "purpose": "Paid acquisition and conversion optimization"},
        {"name": "Content Operations", "icon": "lightbulb", "purpose": "Content creation and distribution"},
    ],
    # Technical roles
    frozenset(["cto", "engineering", "developer", "technical", "architect", "devops"]): [
        {"name": "Engineering Architecture", "icon": "code", "purpose": "System design and technical decisions"},
        {"name": "Product Engineering", "icon": "lightbulb", "purpose": "Feature development and product quality"},
        {"name": "DevOps & Infrastructure", "icon": "server", "purpose": "Deployment, scaling, and reliability"},
    ],
    # Product roles
    frozenset(["product", "pm", "ux", "design"]): [
        {"name": "Product Strategy", "icon": "lightbulb", "purpose": "Product direction and roadmap priorities"},
        {"name": "User Experience", "icon": "crown", "purpose": "User research and experience design"},
        {"name": "Feature Delivery", "icon": "rocket", "purpose": "Feature scoping and delivery"},
    ],
    # Sales roles
    frozenset(["sales", "revenue", "business development", "account", "partnerships"]): [
        {"name": "Sales Strategy", "icon": "rocket", "purpose": "Sales process and pipeline management"},
        {"name": "Account Management", "icon": "crown", "purpose": "Client relationships and retention"},
        {"name": "Deal Operations", "icon": "settings", "purpose": "Deal structuring and negotiations"},
    ],
    # Finance roles
    frozenset(["cfo", "finance", "accounting", "controller"]): [
        {"name": "Financial Strategy", "icon": "crown", "purpose": "Financial planning and analysis"},
        {"name": "Operations Finance", "icon": "settings", "purpose": "Budgeting and cost management"},
        {"name": "Growth Finance", "icon": "rocket", "purpose": "Fundraising and investor relations"},
    ],
    # HR/People roles
    frozenset(["hr", "people", "talent", "recruiting", "culture"]): [
        {"name": "Talent Acquisition", "icon": "rocket", "purpose": "Hiring strategy and recruitment"},
        {"name": "People Operations", "icon": "settings", "purpose": "HR processes and compliance"},
        {"name": "Culture & Development", "icon": "lightbulb", "purpose": "Culture building and employee growth"},
    ],
}

# Default departments when role doesn't match
DEFAULT_DEPARTMENTS = [
    {"name": "Strategic Advisory", "icon": "crown", "purpose": "High-level strategic guidance"},
    {"name": "Operations", "icon": "settings", "purpose": "Operational efficiency and processes"},
    {"name": "Growth", "icon": "rocket", "purpose": "Business growth and expansion"},
]

# Size modifiers for department names
SIZE_BRACKETS = [
    (0, 10, "Startup"),      # 0-10 employees
    (11, 50, "Growth"),      # 11-50 employees
    (51, 200, "Scale-up"),   # 51-200 employees
    (201, 1000, "Mid-Market"),  # 201-1000 employees
    (1001, float('inf'), "Enterprise"),  # 1000+ employees
]


def get_size_modifier(employee_count: int) -> str:
    """Get company size modifier based on employee count."""
    for min_size, max_size, modifier in SIZE_BRACKETS:
        if min_size <= employee_count <= max_size:
            return modifier
    return ""


def generate_departments(role: str, industry: str, employee_count: int) -> List[dict]:
    """
    Generate personalized departments based on role, industry, and company size.

    Uses rule-based logic to map role keywords to relevant departments.
    Falls back to default departments if no match found.
    """
    role_lower = role.lower()

    # Find matching department set
    matched_departments = None
    for keywords, departments in ROLE_DEPARTMENT_MAP.items():
        if any(keyword in role_lower for keyword in keywords):
            matched_departments = departments
            break

    if not matched_departments:
        matched_departments = DEFAULT_DEPARTMENTS

    # Generate unique IDs and optionally add size modifier
    size_modifier = get_size_modifier(employee_count)
    result = []

    for i, dept in enumerate(matched_departments):
        dept_name = dept["name"]
        # Add size modifier for certain department types at larger companies
        if size_modifier in ["Mid-Market", "Enterprise"] and "Strategy" in dept_name:
            dept_name = f"{size_modifier} {dept_name}"

        result.append({
            "id": f"dept-{i+1}",
            "name": dept_name,
            "icon": dept["icon"],
            "purpose": dept["purpose"],
        })

    return result


# =============================================================================
# MAGIC QUESTION GENERATION
# =============================================================================

MAGIC_QUESTION_PROMPT = """You are an expert business consultant who understands the challenges that professionals face.

Based on this person's profile:
- Name: {name}
- Role: {role}
- Company: {company}
- Industry: {industry}
- Company Size: {employees} employees
- Background: {bio}

Generate ONE strategic "Magic Question" - the kind of high-stakes question this person is likely losing sleep over right now.

RULES:
1. It MUST be specific to their role, company, and industry
2. It MUST be high-stakes (a decision that really matters)
3. It MUST be open-ended (not a yes/no question)
4. Reference their company name or industry specifics
5. Maximum 2 sentences
6. Focus on a genuine strategic challenge, not generic advice

Examples of good magic questions:
- "How can Elevate Digital transition from founder-led sales to a scalable outbound system without sacrificing the high-touch consultancy brand?"
- "Should CloudFlow prioritize the enterprise segment requiring SOC2 compliance, or double down on the SMB self-serve motion that's growing 40% MoM?"

Return ONLY the question text, nothing else."""


async def generate_magic_question(
    name: str,
    role: str,
    company: str,
    industry: str,
    employees: int,
    bio: str
) -> str:
    """
    Generate a personalized "magic question" using LLM.

    Falls back to a template-based question if LLM fails.
    """
    from ..openrouter import query_model, MOCK_LLM
    from .. import model_registry

    # Use a fast, cheap model for this (magic_question -> utility via alias)
    magic_model = await model_registry.get_primary_model('magic_question')
    if not magic_model:
        magic_model = 'google/gemini-2.5-flash'  # Fast, cheap fallback

    if MOCK_LLM:
        # Return mock question based on role
        if "cto" in role.lower() or "engineer" in role.lower() or "tech" in role.lower():
            return f"What's the right balance between addressing technical debt and shipping new features at {company}, given your current growth trajectory?"
        elif "marketing" in role.lower() or "cmo" in role.lower():
            return f"How should {company} allocate marketing budget between brand awareness and performance marketing to maximize ROI in {industry}?"
        else:
            return f"What's the single most important strategic decision {company} needs to make in the next 90 days to accelerate growth?"

    prompt = MAGIC_QUESTION_PROMPT.format(
        name=name,
        role=role,
        company=company,
        industry=industry,
        employees=employees,
        bio=bio[:500]  # Limit bio length
    )

    try:
        messages = [
            {"role": "system", "content": "You are a strategic business consultant. Generate insightful, specific questions."},
            {"role": "user", "content": prompt}
        ]

        result = await query_model(
            model=magic_model,
            messages=messages
        )

        if result and result.get('content'):
            question = result['content'].strip()
            # Clean up any markdown or quotes
            question = question.strip('"\'')
            question = question.replace('**', '').replace('__', '')
            return question

    except Exception as e:
        log_app_event(
            "MAGIC_QUESTION_GENERATION_FAILED",
            level="WARNING",
            error=str(e)
        )

    # Fallback template question
    return f"What's the most important strategic decision {company} needs to make in the next quarter to achieve its growth goals in {industry}?"


# =============================================================================
# FRESHLINK INTEGRATION (LinkedIn Scraping via RapidAPI)
# =============================================================================

def extract_username_from_linkedin_url(url: str) -> Optional[str]:
    """Extract LinkedIn username from profile URL."""
    # Handle various LinkedIn URL formats:
    # https://linkedin.com/in/username
    # https://www.linkedin.com/in/username/
    # https://linkedin.com/in/username?param=value
    import re
    match = re.search(r'linkedin\.com/in/([^/?#]+)', url)
    if match:
        return match.group(1).strip('/')
    return None


async def scrape_linkedin_profile(linkedin_url: str) -> Optional[dict]:
    """
    Scrape LinkedIn profile using Fresh LinkedIn Profile Data API via RapidAPI.

    Returns profile data or None if scraping fails.
    """
    import os
    import httpx

    rapidapi_key = os.getenv("FRESHLINK_API_KEY")

    if not rapidapi_key:
        log_app_event(
            "FRESHLINK_NOT_CONFIGURED",
            level="WARNING",
            message="FRESHLINK_API_KEY not set, using mock data"
        )
        return None

    # Extract username from URL
    username = extract_username_from_linkedin_url(linkedin_url)
    if not username:
        log_app_event(
            "LINKEDIN_URL_INVALID",
            level="WARNING",
            message=f"Could not extract username from URL: {linkedin_url}"
        )
        return None

    try:
        async with httpx.AsyncClient() as client:
            # RapidAPI Fresh LinkedIn Profile Data endpoint
            response = await client.get(
                "https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile",
                params={"linkedin_url": linkedin_url},
                headers={
                    "x-rapidapi-key": rapidapi_key,
                    "x-rapidapi-host": "fresh-linkedin-profile-data.p.rapidapi.com"
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            # Map FreshLink response to our expected format
            if data and data.get("data"):
                profile_data = data.get("data", {})
                return {
                    "full_name": profile_data.get("full_name", ""),
                    "headline": profile_data.get("headline", ""),
                    "summary": profile_data.get("summary", ""),
                    "location": profile_data.get("location", ""),
                    "company": profile_data.get("company", ""),
                    "title": profile_data.get("title", ""),
                    "experience": profile_data.get("experiences", []),
                    "education": profile_data.get("educations", []),
                }
            return None

    except httpx.HTTPStatusError as e:
        log_app_event(
            "FRESHLINK_HTTP_ERROR",
            level="WARNING",
            status_code=e.response.status_code,
            error=str(e)
        )
        return None
    except Exception as e:
        log_app_event(
            "FRESHLINK_SCRAPE_FAILED",
            level="WARNING",
            error=str(e)
        )
        return None


# =============================================================================
# APOLLO INTEGRATION (Company Enrichment)
# =============================================================================

async def enrich_company_data(company_name: str, domain: Optional[str] = None) -> Optional[dict]:
    """
    Enrich company data using Apollo API.

    Returns company data (industry, employee count, description) or None.
    """
    import os
    import httpx

    apollo_api_key = os.getenv("APOLLO_API_KEY")

    if not apollo_api_key:
        log_app_event(
            "APOLLO_NOT_CONFIGURED",
            level="WARNING",
            message="APOLLO_API_KEY not set, using mock data"
        )
        return None

    try:
        async with httpx.AsyncClient() as client:
            # Apollo Organization Enrichment API
            # See: https://docs.apollo.io/reference/organization-enrichment
            params = {}
            if domain:
                params["domain"] = domain
            else:
                params["name"] = company_name

            response = await client.get(
                "https://api.apollo.io/api/v1/organizations/enrich",
                params=params,
                headers={
                    "Cache-Control": "no-cache",
                    "Content-Type": "application/json",
                    "X-Api-Key": apollo_api_key
                },
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()

            # Extract organization data from response
            org = data.get("organization", {})
            if org:
                return {
                    "name": org.get("name", company_name),
                    "industry": org.get("industry"),
                    "employees": org.get("estimated_num_employees"),
                    "description": org.get("short_description"),
                    "website": org.get("website_url"),
                    "linkedin_url": org.get("linkedin_url"),
                }
            return None

    except httpx.HTTPStatusError as e:
        log_app_event(
            "APOLLO_HTTP_ERROR",
            level="WARNING",
            status_code=e.response.status_code,
            error=str(e)
        )
        return None
    except Exception as e:
        log_app_event(
            "APOLLO_ENRICH_FAILED",
            level="WARNING",
            error=str(e)
        )
        return None


# =============================================================================
# MOCK DATA (For Development)
# =============================================================================

def get_mock_profile_data(linkedin_username: str) -> dict:
    """
    Generate mock profile data for development.

    In production, this is replaced by FreshLink + Apollo data.
    """
    # Simple variation based on username
    if "david" in linkedin_username.lower() or "tech" in linkedin_username.lower():
        return {
            "full_name": "David Chen",
            "role": "CTO",
            "company": "CloudFlow",
            "industry": "SaaS / Logistics",
            "employees": 150,
            "bio": "Technical leader managing a team of 40. Focused on reducing technical debt while shipping features for Series C prep.",
        }
    elif "sarah" in linkedin_username.lower() or "market" in linkedin_username.lower():
        return {
            "full_name": "Sarah Jenkins",
            "role": "Founder & CEO",
            "company": "Elevate Digital",
            "industry": "Marketing Services",
            "employees": 12,
            "bio": "Founder of a boutique SEO agency focused on FinTech. 10 years experience. Struggling to scale beyond founder-led sales.",
        }
    else:
        # Generic profile based on username
        name_parts = linkedin_username.replace("-", " ").replace("_", " ").title().split()
        full_name = " ".join(name_parts[:2]) if len(name_parts) >= 2 else linkedin_username.title()

        return {
            "full_name": full_name,
            "role": "Founder",
            "company": f"{name_parts[0] if name_parts else 'Acme'} Ventures",
            "industry": "Technology",
            "employees": 25,
            "bio": "Entrepreneur building innovative solutions. Looking for strategic guidance on growth and operations.",
        }


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/analyze-profile", response_model=AnalyzeProfileResponse)
@limiter.limit("10/minute;50/hour")
async def analyze_linkedin_profile(
    request: Request,
    body: AnalyzeProfileRequest,
    user: Optional[dict] = Depends(get_optional_user)
):
    """
    Analyze a LinkedIn profile to generate a personalized council.

    This endpoint:
    1. Validates the LinkedIn URL
    2. Scrapes profile data via FreshLink (or mock data)
    3. Enriches company data via Apollo (or mock data)
    4. Generates personalized departments (rule-based)
    5. Generates a "magic question" (LLM-powered)

    Authentication is optional - unauthenticated users can analyze profiles
    to see their council preview before signing up.
    """
    # Validate URL
    is_valid, result = validate_linkedin_url(body.linkedin_url)
    if not is_valid:
        return AnalyzeProfileResponse(
            success=False,
            error=result,
            fallback_required=False
        )

    linkedin_username = result

    log_app_event(
        "ONBOARDING_PROFILE_ANALYSIS_START",
        level="INFO",
        username=linkedin_username[:20],  # Truncate for privacy
        authenticated=user is not None
    )

    # Try to scrape LinkedIn profile
    linkedin_data = await scrape_linkedin_profile(body.linkedin_url)

    # Try to enrich company data
    company_data = None
    if linkedin_data and linkedin_data.get("company"):
        company_data = await enrich_company_data(linkedin_data["company"])

    # Use scraped data or fall back to mock
    if linkedin_data and linkedin_data.get("full_name"):
        profile_data = {
            "full_name": linkedin_data.get("full_name", ""),
            "role": linkedin_data.get("title", "Professional"),
            "company": linkedin_data.get("company", ""),
            "industry": company_data.get("industry", "Technology") if company_data else "Technology",
            "employees": company_data.get("employees", 50) if company_data else 50,
            "bio": linkedin_data.get("summary", "")[:500],
        }
        fallback_required = False
    else:
        # Use mock data for development or when scraping fails
        profile_data = get_mock_profile_data(linkedin_username)
        fallback_required = not bool(linkedin_data)  # True if scraping failed (not just missing API key)

    # Check if profile data is too thin (needs manual input)
    if len(profile_data.get("bio", "")) < 50:
        fallback_required = True

    # Generate departments
    departments = generate_departments(
        role=profile_data["role"],
        industry=profile_data["industry"],
        employee_count=profile_data["employees"]
    )

    # Generate magic question
    magic_question = await generate_magic_question(
        name=profile_data["full_name"],
        role=profile_data["role"],
        company=profile_data["company"],
        industry=profile_data["industry"],
        employees=profile_data["employees"],
        bio=profile_data["bio"]
    )

    # Build response profile
    profile = OnboardingProfile(
        full_name=profile_data["full_name"],
        role=profile_data["role"],
        company=profile_data["company"],
        industry=profile_data["industry"],
        employees=profile_data["employees"],
        bio=profile_data["bio"],
        magic_question=magic_question,
        departments=[OnboardingDepartment(**d) for d in departments]
    )

    log_app_event(
        "ONBOARDING_PROFILE_ANALYSIS_SUCCESS",
        level="INFO",
        company=profile_data["company"][:30],
        departments_count=len(departments),
        fallback_required=fallback_required
    )

    return AnalyzeProfileResponse(
        success=True,
        profile=profile,
        fallback_required=fallback_required
    )


@router.get("/trial-status", response_model=TrialStatusResponse)
@limiter.limit("100/minute;500/hour")
async def get_trial_status(request: Request, user: dict = Depends(get_current_user)):
    """
    Get the current user's trial status.

    Returns whether they have a free trial available and/or their own API key.
    """
    from ..services.trial import TrialService

    user_id = user.get("id")
    trial_service = TrialService()

    has_trial = await trial_service.check_trial_available(user_id)
    has_api_key = await trial_service.check_has_api_key(user_id)
    trial_info = await trial_service.get_trial_info(user_id)

    return TrialStatusResponse(
        has_trial_available=has_trial,
        has_api_key=has_api_key,
        can_run_council=has_trial or has_api_key,
        trial_used_at=trial_info.get("used_at") if trial_info else None
    )


@router.post("/use-trial")
@limiter.limit("10/minute;30/hour")
async def use_trial(
    request: Request,
    user: dict = Depends(get_current_user)
):
    """
    Mark the user's trial as used.

    Called after a successful council run using the trial.
    This is typically called by the council execution flow, not directly by frontend.
    """
    from ..services.trial import TrialService
    from ..security import get_client_ip

    user_id = user.get("id")
    trial_service = TrialService()

    # Check if trial is still available
    if not await trial_service.check_trial_available(user_id):
        raise HTTPException(
            status_code=400,
            detail="Trial has already been used"
        )

    # Mark trial as used
    ip_address = get_client_ip(request)
    await trial_service.use_trial(user_id, ip_address)

    log_app_event(
        "ONBOARDING_TRIAL_USED",
        level="INFO",
        user_id=user_id[:8] + "..."  # Truncate for privacy
    )

    return {"success": True, "message": "Trial marked as used"}


@router.delete("/reset-trial")
@limiter.limit("20/minute;50/hour")
async def reset_trial(request: Request, user: dict = Depends(get_current_user)):
    """
    Reset the user's trial status (DEV ONLY).

    Deletes the user's trial record so they can test onboarding again.
    Only available in development environment.
    """
    import os

    # Only allow in development
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(
            status_code=403,
            detail="Trial reset is only available in development"
        )

    from ..services.trial import TrialService

    user_id = user.get("id")
    trial_service = TrialService()

    # Reset the trial
    success = await trial_service.reset_trial(user_id)

    if success:
        log_app_event(
            "ONBOARDING_TRIAL_RESET",
            level="INFO",
            user_id=user_id[:8] + "..."
        )
        return {"success": True, "message": "Trial reset successfully"}
    else:
        return {"success": True, "message": "No trial record found to reset"}
