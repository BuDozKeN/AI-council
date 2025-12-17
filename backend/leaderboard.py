"""Model performance leaderboard storage and analytics using Supabase."""

from datetime import datetime
from typing import List, Dict, Any, Optional
from .database import get_supabase_service


def record_session_rankings(
    conversation_id: str,
    department: str,
    business_id: Optional[str],
    aggregate_rankings: List[Dict[str, Any]]
):
    """
    Record rankings from a council session.

    Args:
        conversation_id: The conversation ID
        department: Department/topic (marketing, sales, legal, executive, standard)
        business_id: Optional business context ID
        aggregate_rankings: List of {model, average_rank, rankings_count}
    """
    if not aggregate_rankings:
        return

    supabase = get_supabase_service()

    # Insert each model's ranking as a separate row
    records = []
    for ranking in aggregate_rankings:
        records.append({
            "conversation_id": conversation_id,
            "department": department or "standard",
            "business_id": business_id,
            "model": ranking["model"],
            "average_rank": ranking["average_rank"],
            "rankings_count": ranking.get("rankings_count", 1),
            "created_at": datetime.utcnow().isoformat() + "Z"
        })

    try:
        supabase.table('model_rankings').insert(records).execute()
    except Exception as e:
        print(f"[LEADERBOARD] Error recording rankings: {e}", flush=True)


def get_overall_leaderboard() -> List[Dict[str, Any]]:
    """
    Get the overall leaderboard sorted by average rank (lower is better).

    Returns:
        List of {model, avg_rank, sessions, wins, win_rate}
    """
    supabase = get_supabase_service()

    try:
        # Get all rankings
        result = supabase.table('model_rankings').select('*').execute()

        if not result.data:
            return []

        # Aggregate by model
        model_stats = {}

        # Group by conversation to determine wins
        conversation_rankings = {}
        for row in result.data:
            conv_id = row['conversation_id']
            if conv_id not in conversation_rankings:
                conversation_rankings[conv_id] = []
            conversation_rankings[conv_id].append(row)

        # Calculate stats per model
        for row in result.data:
            model = row['model']
            if model not in model_stats:
                model_stats[model] = {
                    "total_rank": 0,
                    "sessions": 0,
                    "wins": 0
                }
            model_stats[model]["total_rank"] += float(row['average_rank'])
            model_stats[model]["sessions"] += 1

        # Count wins (lowest average_rank in each conversation)
        for conv_id, rankings in conversation_rankings.items():
            if rankings:
                # Sort by average_rank, lowest wins
                sorted_rankings = sorted(rankings, key=lambda x: float(x['average_rank']))
                winner_model = sorted_rankings[0]['model']
                if winner_model in model_stats:
                    model_stats[winner_model]["wins"] += 1

        # Build leaderboard
        leaderboard = []
        for model, stats in model_stats.items():
            if stats["sessions"] > 0:
                # Each conversation counts as 1 session per model
                # Divide sessions by number of times this model appeared
                unique_sessions = len(set(
                    row['conversation_id'] for row in result.data if row['model'] == model
                ))
                avg_rank = stats["total_rank"] / stats["sessions"]
                win_rate = (stats["wins"] / unique_sessions) * 100 if unique_sessions > 0 else 0
                leaderboard.append({
                    "model": model,
                    "avg_rank": round(avg_rank, 2),
                    "sessions": unique_sessions,
                    "wins": stats["wins"],
                    "win_rate": round(win_rate, 1)
                })

        # Sort by avg_rank (lower is better)
        leaderboard.sort(key=lambda x: x["avg_rank"])

        return leaderboard

    except Exception as e:
        print(f"[LEADERBOARD] Error getting overall leaderboard: {e}", flush=True)
        return []


def get_department_leaderboard(department: str) -> List[Dict[str, Any]]:
    """
    Get the leaderboard for a specific department.

    Args:
        department: The department to filter by

    Returns:
        List of {model, avg_rank, sessions, wins, win_rate}
    """
    supabase = get_supabase_service()

    try:
        # Get rankings for this department
        result = supabase.table('model_rankings').select('*').eq('department', department).execute()

        if not result.data:
            return []

        # Aggregate by model
        model_stats = {}

        # Group by conversation to determine wins
        conversation_rankings = {}
        for row in result.data:
            conv_id = row['conversation_id']
            if conv_id not in conversation_rankings:
                conversation_rankings[conv_id] = []
            conversation_rankings[conv_id].append(row)

        # Calculate stats per model
        for row in result.data:
            model = row['model']
            if model not in model_stats:
                model_stats[model] = {
                    "total_rank": 0,
                    "sessions": 0,
                    "wins": 0
                }
            model_stats[model]["total_rank"] += float(row['average_rank'])
            model_stats[model]["sessions"] += 1

        # Count wins
        for conv_id, rankings in conversation_rankings.items():
            if rankings:
                sorted_rankings = sorted(rankings, key=lambda x: float(x['average_rank']))
                winner_model = sorted_rankings[0]['model']
                if winner_model in model_stats:
                    model_stats[winner_model]["wins"] += 1

        # Build leaderboard
        leaderboard = []
        for model, stats in model_stats.items():
            if stats["sessions"] > 0:
                unique_sessions = len(set(
                    row['conversation_id'] for row in result.data if row['model'] == model
                ))
                avg_rank = stats["total_rank"] / stats["sessions"]
                win_rate = (stats["wins"] / unique_sessions) * 100 if unique_sessions > 0 else 0
                leaderboard.append({
                    "model": model,
                    "avg_rank": round(avg_rank, 2),
                    "sessions": unique_sessions,
                    "wins": stats["wins"],
                    "win_rate": round(win_rate, 1)
                })

        leaderboard.sort(key=lambda x: x["avg_rank"])

        return leaderboard

    except Exception as e:
        print(f"[LEADERBOARD] Error getting department leaderboard: {e}", flush=True)
        return []


def _is_uuid_like(value: str) -> bool:
    """Check if a string looks like a UUID (including seed UUIDs with letters like D0000...)."""
    import re
    # Match standard UUID format: 8-4-4-4-12 with any alphanumeric characters
    uuid_pattern = re.compile(
        r'^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$'
    )
    return bool(uuid_pattern.match(value))


def _resolve_department_name(supabase, dept_id: str) -> str:
    """
    Resolve a department ID (UUID) to its display name.
    Returns the original value if not a UUID or not found.
    """
    if not _is_uuid_like(dept_id):
        return dept_id

    try:
        result = supabase.table('departments').select('name').eq('id', dept_id).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]['name']
    except Exception as e:
        print(f"[LEADERBOARD] Error resolving department name for {dept_id}: {e}", flush=True)

    return dept_id


def get_all_department_leaderboards() -> Dict[str, List[Dict[str, Any]]]:
    """
    Get leaderboards for all departments.

    Returns:
        Dict mapping department name to leaderboard list
    """
    supabase = get_supabase_service()

    try:
        # Get distinct departments
        result = supabase.table('model_rankings').select('department').execute()

        if not result.data:
            return {}

        departments = set(row['department'] for row in result.data)

        # Build result with resolved department names
        leaderboards = {}
        for dept in departments:
            display_name = _resolve_department_name(supabase, dept)
            # Use the original dept ID for querying, but display_name as the key
            leaderboards[display_name] = get_department_leaderboard(dept)

        return leaderboards

    except Exception as e:
        print(f"[LEADERBOARD] Error getting all department leaderboards: {e}", flush=True)
        return {}


def get_leaderboard_summary() -> Dict[str, Any]:
    """
    Get a summary of the leaderboard with overall and per-department winners.

    Returns:
        Dict with overall winner and department winners
    """
    overall = get_overall_leaderboard()
    departments = get_all_department_leaderboards()

    summary = {
        "overall": {
            "leader": overall[0] if overall else None,
            "total_sessions": sum(m["sessions"] for m in overall) // len(overall) if overall else 0,
            "leaderboard": overall
        },
        "departments": {}
    }

    for dept, leaderboard in departments.items():
        summary["departments"][dept] = {
            "leader": leaderboard[0] if leaderboard else None,
            "sessions": sum(m["sessions"] for m in leaderboard) // len(leaderboard) if leaderboard else 0,
            "leaderboard": leaderboard
        }

    return summary
