"""Model performance leaderboard storage and analytics using Supabase."""

from datetime import datetime
from typing import List, Dict, Any, Optional
from functools import lru_cache
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
    except Exception:
        pass  # Non-critical - rankings can be skipped


def _aggregate_leaderboard_data(data: List[Dict]) -> List[Dict[str, Any]]:
    """
    Efficient single-pass aggregation of ranking data.

    Args:
        data: List of ranking rows from database

    Returns:
        Sorted leaderboard list
    """
    if not data:
        return []

    # Single pass: collect all stats
    model_stats: Dict[str, Dict] = {}
    conversation_rankings: Dict[str, List] = {}

    for row in data:
        model = row['model']
        conv_id = row['conversation_id']
        avg_rank = float(row['average_rank'])

        # Initialize model stats
        if model not in model_stats:
            model_stats[model] = {
                "total_rank": 0.0,
                "count": 0,
                "conversations": set(),
                "wins": 0
            }

        # Accumulate stats
        model_stats[model]["total_rank"] += avg_rank
        model_stats[model]["count"] += 1
        model_stats[model]["conversations"].add(conv_id)

        # Track rankings per conversation for win calculation
        if conv_id not in conversation_rankings:
            conversation_rankings[conv_id] = []
        conversation_rankings[conv_id].append((model, avg_rank))

    # Count wins: lowest average_rank in each conversation
    for conv_id, rankings in conversation_rankings.items():
        if rankings:
            # Find minimum rank model
            winner = min(rankings, key=lambda x: x[1])[0]
            if winner in model_stats:
                model_stats[winner]["wins"] += 1

    # Build final leaderboard
    leaderboard = []
    for model, stats in model_stats.items():
        sessions = len(stats["conversations"])
        if sessions > 0:
            avg_rank = stats["total_rank"] / stats["count"]
            win_rate = (stats["wins"] / sessions) * 100
            leaderboard.append({
                "model": model,
                "avg_rank": round(avg_rank, 2),
                "sessions": sessions,
                "wins": stats["wins"],
                "win_rate": round(win_rate, 1)
            })

    # Sort by avg_rank (lower is better)
    leaderboard.sort(key=lambda x: x["avg_rank"])
    return leaderboard


def get_overall_leaderboard() -> List[Dict[str, Any]]:
    """
    Get the overall leaderboard sorted by average rank (lower is better).

    Returns:
        List of {model, avg_rank, sessions, wins, win_rate}
    """
    supabase = get_supabase_service()

    try:
        # Only select needed columns (not *)
        result = supabase.table('model_rankings').select(
            'model, conversation_id, average_rank'
        ).execute()

        return _aggregate_leaderboard_data(result.data or [])

    except Exception:
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
        # Only select needed columns with department filter
        result = supabase.table('model_rankings').select(
            'model, conversation_id, average_rank'
        ).eq('department', department).execute()

        return _aggregate_leaderboard_data(result.data or [])

    except Exception:
        return []


def _is_uuid_like(value: str) -> bool:
    """Check if a string looks like a UUID (including seed UUIDs with letters like D0000...)."""
    import re
    # Match standard UUID format: 8-4-4-4-12 with any alphanumeric characters
    uuid_pattern = re.compile(
        r'^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$'
    )
    return bool(uuid_pattern.match(value))


def _resolve_department_names_batch(supabase, dept_ids: List[str]) -> Dict[str, str]:
    """
    Batch resolve department IDs to display names.

    Args:
        supabase: Supabase client
        dept_ids: List of department IDs (may include UUIDs and legacy names)

    Returns:
        Dict mapping dept_id to display_name
    """
    result = {}
    uuid_ids = []

    for dept_id in dept_ids:
        if _is_uuid_like(dept_id):
            uuid_ids.append(dept_id)
        else:
            # Not a UUID, use as-is
            result[dept_id] = dept_id

    if uuid_ids:
        try:
            # Single batch query for all UUIDs
            dept_result = supabase.table('departments').select('id, name').in_('id', uuid_ids).execute()
            for row in (dept_result.data or []):
                result[row['id']] = row['name']
        except Exception:
            pass  # Fall back to UUID IDs

        # Fall back to ID for any not found
        for uuid_id in uuid_ids:
            if uuid_id not in result:
                result[uuid_id] = uuid_id

    return result


def get_all_department_leaderboards() -> Dict[str, List[Dict[str, Any]]]:
    """
    Get leaderboards for all departments.
    Optimized to fetch all data in one query and aggregate in Python.

    Returns:
        Dict mapping department name to leaderboard list
    """
    supabase = get_supabase_service()

    try:
        # Fetch all ranking data in one query
        result = supabase.table('model_rankings').select(
            'model, conversation_id, average_rank, department'
        ).execute()

        if not result.data:
            return {}

        # Group data by department
        dept_data: Dict[str, List] = {}
        all_dept_ids = set()

        for row in result.data:
            dept = row['department']
            all_dept_ids.add(dept)
            if dept not in dept_data:
                dept_data[dept] = []
            dept_data[dept].append(row)

        # Batch resolve department names
        name_map = _resolve_department_names_batch(supabase, list(all_dept_ids))

        # Build leaderboards using aggregation helper
        leaderboards = {}
        for dept_id, rows in dept_data.items():
            display_name = name_map.get(dept_id, dept_id)
            leaderboards[display_name] = _aggregate_leaderboard_data(rows)

        return leaderboards

    except Exception:
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
