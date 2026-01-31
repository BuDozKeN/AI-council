"""
Lead Enrichment Service

Enriches leads from corporate emails using:
- Corporate email validation (filtering free email providers)
- Apollo API for company data
- FreshLink API for LinkedIn profile data

This powers the "wow factor" in email-to-council responses by adding
context about who is asking the question.
"""

import os
import re
import httpx
import logging
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

from ..security import log_app_event

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")
FRESHLINK_API_KEY = os.getenv("FRESHLINK_API_KEY")

# Free email providers to reject (corporate emails only)
FREE_EMAIL_PROVIDERS = frozenset([
    # Major providers
    "gmail.com", "googlemail.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it",
    "hotmail.com", "hotmail.co.uk", "hotmail.fr", "hotmail.de",
    "outlook.com", "outlook.co.uk",
    "live.com", "live.co.uk",
    "msn.com",
    "aol.com",
    "icloud.com", "me.com", "mac.com",
    "protonmail.com", "proton.me",
    "zoho.com",
    "mail.com",
    "yandex.com", "yandex.ru",
    "gmx.com", "gmx.de", "gmx.net",
    "fastmail.com", "fastmail.fm",
    "tutanota.com", "tutanota.de",
    "hey.com",

    # Regional providers
    "qq.com", "163.com", "126.com",  # China
    "naver.com", "daum.net",  # Korea
    "rediffmail.com",  # India
    "mail.ru", "inbox.ru", "list.ru", "bk.ru",  # Russia
    "web.de", "t-online.de", "freenet.de",  # Germany
    "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net",  # France
    "libero.it", "virgilio.it", "tin.it", "alice.it",  # Italy
    "terra.com.br", "uol.com.br", "bol.com.br",  # Brazil

    # Disposable/temporary
    "tempmail.com", "guerrillamail.com", "10minutemail.com",
    "mailinator.com", "throwaway.email", "temp-mail.org",
    "fakeinbox.com", "sharklasers.com", "guerrillamail.info",
])

# Suspicious domain patterns
SUSPICIOUS_PATTERNS = [
    r"^test\.",
    r"^example\.",
    r"^localhost",
    r"\.test$",
    r"\.example$",
    r"\.local$",
    r"^mail\d+\.",
    r"\.temp\.",
    r"spam",
]


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class EnrichedLead:
    """Enriched lead data from email + API lookups."""

    # Email info
    email: str
    email_domain: str
    is_corporate: bool

    # Person info (from Apollo/FreshLink)
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    seniority: Optional[str] = None  # e.g., "executive", "manager", "individual"
    linkedin_url: Optional[str] = None

    # Company info (from Apollo)
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    company_industry: Optional[str] = None
    company_size: Optional[int] = None
    company_size_range: Optional[str] = None  # e.g., "51-200"
    company_description: Optional[str] = None
    company_linkedin_url: Optional[str] = None
    company_website: Optional[str] = None
    company_founded_year: Optional[int] = None
    company_funding_stage: Optional[str] = None  # e.g., "Series B"
    company_total_funding: Optional[float] = None

    # Metadata
    enriched_at: Optional[str] = None
    enrichment_source: Optional[str] = None  # e.g., "apollo", "freshlink", "mock"
    enrichment_confidence: Optional[str] = None  # e.g., "high", "medium", "low"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    def get_personalization_context(self) -> str:
        """
        Generate a personalization context string for the council prompt.

        This is injected into the council's system prompt to personalize responses.
        """
        parts = []

        # Person context
        if self.full_name:
            parts.append(f"The person asking this question is {self.full_name}")

        if self.title and self.company_name:
            parts.append(f"who serves as {self.title} at {self.company_name}")
        elif self.title:
            parts.append(f"with the role of {self.title}")
        elif self.company_name:
            parts.append(f"from {self.company_name}")

        # Company context
        company_details = []
        if self.company_industry:
            company_details.append(f"in the {self.company_industry} industry")
        if self.company_size_range:
            company_details.append(f"with {self.company_size_range} employees")
        if self.company_funding_stage:
            company_details.append(f"at {self.company_funding_stage} stage")

        if company_details:
            parts.append(f"({', '.join(company_details)})")

        if parts:
            return ". ".join(parts) + "."

        # Fallback: just domain info
        return f"This question comes from someone at {self.email_domain}."

    def get_greeting_name(self) -> str:
        """Get the appropriate name to use in greeting."""
        if self.first_name:
            return self.first_name
        if self.full_name:
            return self.full_name.split()[0]
        return "there"


# =============================================================================
# EMAIL VALIDATION
# =============================================================================

def extract_domain(email: str) -> str:
    """Extract domain from email address."""
    return email.lower().split("@")[-1] if "@" in email else ""


def is_corporate_email(email: str) -> Tuple[bool, str]:
    """
    Check if an email is a corporate email (not a free provider).

    Args:
        email: Email address to check

    Returns:
        Tuple of (is_corporate, reason)
    """
    if not email or "@" not in email:
        return False, "Invalid email format"

    domain = extract_domain(email)

    # Check against free email providers
    if domain in FREE_EMAIL_PROVIDERS:
        return False, f"Free email provider: {domain}"

    # Check for suspicious patterns
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, domain):
            return False, f"Suspicious domain pattern: {domain}"

    # Basic MX record validation could be added here
    # For now, assume corporate if not in blocklist

    return True, "Corporate email"


def validate_email_format(email: str) -> bool:
    """Basic email format validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


# =============================================================================
# APOLLO ENRICHMENT
# =============================================================================

async def enrich_with_apollo(email: str) -> Optional[Dict[str, Any]]:
    """
    Enrich lead data using Apollo API.

    Apollo provides:
    - Person data (name, title, seniority)
    - Company data (industry, size, funding)

    Args:
        email: Email address to look up

    Returns:
        Dict with person and company data, or None
    """
    if not APOLLO_API_KEY:
        log_app_event(
            "APOLLO: Not configured",
            level="DEBUG",
            message="APOLLO_API_KEY not set",
        )
        return None

    try:
        async with httpx.AsyncClient() as client:
            # Apollo People Enrichment API
            response = await client.post(
                "https://api.apollo.io/api/v1/people/match",
                json={
                    "email": email,
                    "reveal_personal_emails": False,
                },
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": APOLLO_API_KEY,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            data = response.json()

            person = data.get("person")
            if not person:
                log_app_event(
                    "APOLLO: No person found",
                    level="DEBUG",
                    email_domain=extract_domain(email),
                )
                return None

            org = person.get("organization", {})

            result = {
                # Person data
                "full_name": person.get("name"),
                "first_name": person.get("first_name"),
                "last_name": person.get("last_name"),
                "title": person.get("title"),
                "seniority": person.get("seniority"),
                "linkedin_url": person.get("linkedin_url"),

                # Company data
                "company_name": org.get("name"),
                "company_domain": org.get("primary_domain"),
                "company_industry": org.get("industry"),
                "company_size": org.get("estimated_num_employees"),
                "company_size_range": _format_size_range(org.get("estimated_num_employees")),
                "company_description": org.get("short_description"),
                "company_linkedin_url": org.get("linkedin_url"),
                "company_website": org.get("website_url"),
                "company_founded_year": org.get("founded_year"),
                "company_funding_stage": org.get("latest_funding_stage"),
                "company_total_funding": org.get("total_funding"),
            }

            log_app_event(
                "APOLLO: Lead enriched",
                email_domain=extract_domain(email),
                has_person=bool(person.get("name")),
                has_company=bool(org.get("name")),
            )

            return result

    except httpx.HTTPStatusError as e:
        log_app_event(
            "APOLLO: HTTP error",
            level="WARNING",
            status_code=e.response.status_code,
            error=str(e),
        )
        return None

    except Exception as e:
        log_app_event(
            "APOLLO: Enrichment error",
            level="WARNING",
            error=str(e),
        )
        return None


# =============================================================================
# FRESHLINK ENRICHMENT (LinkedIn)
# =============================================================================

async def enrich_with_freshlink(linkedin_url: str) -> Optional[Dict[str, Any]]:
    """
    Enrich lead data using FreshLink API (LinkedIn scraping).

    Args:
        linkedin_url: LinkedIn profile URL

    Returns:
        Dict with profile data, or None
    """
    if not FRESHLINK_API_KEY:
        log_app_event(
            "FRESHLINK: Not configured",
            level="DEBUG",
            message="FRESHLINK_API_KEY not set",
        )
        return None

    if not linkedin_url:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile",
                params={"linkedin_url": linkedin_url},
                headers={
                    "x-rapidapi-key": FRESHLINK_API_KEY,
                    "x-rapidapi-host": "fresh-linkedin-profile-data.p.rapidapi.com",
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()

            profile_data = data.get("data", {})
            if not profile_data:
                return None

            result = {
                "full_name": profile_data.get("full_name"),
                "headline": profile_data.get("headline"),
                "summary": profile_data.get("summary"),
                "location": profile_data.get("location"),
                "company": profile_data.get("company"),
                "title": profile_data.get("title"),
                "experience": profile_data.get("experiences", []),
                "education": profile_data.get("educations", []),
            }

            log_app_event(
                "FRESHLINK: Profile enriched",
                has_name=bool(profile_data.get("full_name")),
            )

            return result

    except Exception as e:
        log_app_event(
            "FRESHLINK: Enrichment error",
            level="WARNING",
            error=str(e),
        )
        return None


# =============================================================================
# COMBINED ENRICHMENT
# =============================================================================

async def enrich_lead(email: str) -> EnrichedLead:
    """
    Full lead enrichment pipeline.

    1. Validate corporate email
    2. Enrich with Apollo (person + company)
    3. Optionally enrich with FreshLink (LinkedIn details)

    Args:
        email: Email address to enrich

    Returns:
        EnrichedLead with all available data
    """
    email = email.lower().strip()
    domain = extract_domain(email)

    # Check if corporate email
    is_corporate, reason = is_corporate_email(email)

    # Start with basic lead data
    lead = EnrichedLead(
        email=email,
        email_domain=domain,
        is_corporate=is_corporate,
        enriched_at=datetime.utcnow().isoformat(),
    )

    if not is_corporate:
        log_app_event(
            "LEAD_ENRICHMENT: Non-corporate email",
            level="INFO",
            domain=domain,
            reason=reason,
        )
        lead.enrichment_source = "none"
        lead.enrichment_confidence = "low"
        return lead

    # Try Apollo enrichment
    apollo_data = await enrich_with_apollo(email)

    if apollo_data:
        # Merge Apollo data into lead
        lead.full_name = apollo_data.get("full_name")
        lead.first_name = apollo_data.get("first_name")
        lead.last_name = apollo_data.get("last_name")
        lead.title = apollo_data.get("title")
        lead.seniority = apollo_data.get("seniority")
        lead.linkedin_url = apollo_data.get("linkedin_url")
        lead.company_name = apollo_data.get("company_name")
        lead.company_domain = apollo_data.get("company_domain")
        lead.company_industry = apollo_data.get("company_industry")
        lead.company_size = apollo_data.get("company_size")
        lead.company_size_range = apollo_data.get("company_size_range")
        lead.company_description = apollo_data.get("company_description")
        lead.company_linkedin_url = apollo_data.get("company_linkedin_url")
        lead.company_website = apollo_data.get("company_website")
        lead.company_founded_year = apollo_data.get("company_founded_year")
        lead.company_funding_stage = apollo_data.get("company_funding_stage")
        lead.company_total_funding = apollo_data.get("company_total_funding")
        lead.enrichment_source = "apollo"
        lead.enrichment_confidence = "high" if lead.full_name else "medium"

        # If we have LinkedIn URL, try FreshLink for more details
        if lead.linkedin_url and FRESHLINK_API_KEY:
            freshlink_data = await enrich_with_freshlink(lead.linkedin_url)
            if freshlink_data:
                # Merge additional FreshLink data (don't overwrite Apollo data)
                if not lead.full_name and freshlink_data.get("full_name"):
                    lead.full_name = freshlink_data["full_name"]
                lead.enrichment_source = "apollo+freshlink"

    else:
        # Fallback: Try company enrichment by domain
        company_data = await enrich_company_by_domain(domain)
        if company_data:
            lead.company_name = company_data.get("name")
            lead.company_industry = company_data.get("industry")
            lead.company_size = company_data.get("employees")
            lead.company_size_range = company_data.get("size_range")
            lead.company_description = company_data.get("description")
            lead.company_website = company_data.get("website")
            lead.enrichment_source = "apollo_company"
            lead.enrichment_confidence = "medium"
        else:
            lead.enrichment_source = "domain_only"
            lead.enrichment_confidence = "low"

    log_app_event(
        "LEAD_ENRICHMENT: Complete",
        domain=domain,
        source=lead.enrichment_source,
        confidence=lead.enrichment_confidence,
        has_name=bool(lead.full_name),
        has_company=bool(lead.company_name),
    )

    return lead


async def enrich_company_by_domain(domain: str) -> Optional[Dict[str, Any]]:
    """
    Enrich company data by domain using Apollo.

    Fallback when person lookup fails.
    """
    if not APOLLO_API_KEY:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.apollo.io/api/v1/organizations/enrich",
                params={"domain": domain},
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": APOLLO_API_KEY,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            data = response.json()

            org = data.get("organization", {})
            if not org:
                return None

            return {
                "name": org.get("name"),
                "industry": org.get("industry"),
                "employees": org.get("estimated_num_employees"),
                "size_range": _format_size_range(org.get("estimated_num_employees")),
                "description": org.get("short_description"),
                "website": org.get("website_url"),
            }

    except Exception as e:
        log_app_event(
            "APOLLO: Company enrichment error",
            level="WARNING",
            domain=domain,
            error=str(e),
        )
        return None


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def _format_size_range(employee_count: Optional[int]) -> Optional[str]:
    """Format employee count into a range string."""
    if not employee_count:
        return None

    ranges = [
        (1, 10, "1-10"),
        (11, 50, "11-50"),
        (51, 200, "51-200"),
        (201, 500, "201-500"),
        (501, 1000, "501-1000"),
        (1001, 5000, "1001-5000"),
        (5001, 10000, "5001-10000"),
        (10001, float('inf'), "10000+"),
    ]

    for min_size, max_size, label in ranges:
        if min_size <= employee_count <= max_size:
            return label

    return str(employee_count)


def get_mock_lead(email: str) -> EnrichedLead:
    """
    Generate mock lead data for development/testing.

    Used when APIs are not configured.
    """
    domain = extract_domain(email)
    local_part = email.split("@")[0]

    # Generate plausible name from email local part
    name_parts = re.split(r'[._-]', local_part)
    first_name = name_parts[0].title() if name_parts else "Demo"
    last_name = name_parts[1].title() if len(name_parts) > 1 else "User"
    full_name = f"{first_name} {last_name}"

    return EnrichedLead(
        email=email,
        email_domain=domain,
        is_corporate=domain not in FREE_EMAIL_PROVIDERS,
        full_name=full_name,
        first_name=first_name,
        last_name=last_name,
        title="Director of Strategy",
        seniority="manager",
        company_name=domain.split(".")[0].title() + " Inc",
        company_domain=domain,
        company_industry="Technology",
        company_size=150,
        company_size_range="51-200",
        company_description="A growing technology company.",
        enriched_at=datetime.utcnow().isoformat(),
        enrichment_source="mock",
        enrichment_confidence="mock",
    )
