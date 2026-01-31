# Backend services package

from .trial import TrialService
from .agentmail import (
    AgentMailClient,
    IncomingEmail,
    get_agentmail_client,
    parse_incoming_email,
    is_agentmail_configured,
)
from .lead_enrichment import (
    EnrichedLead,
    enrich_lead,
    is_corporate_email,
    get_mock_lead,
)

__all__ = [
    'TrialService',
    'AgentMailClient',
    'IncomingEmail',
    'get_agentmail_client',
    'parse_incoming_email',
    'is_agentmail_configured',
    'EnrichedLead',
    'enrich_lead',
    'is_corporate_email',
    'get_mock_lead',
]
