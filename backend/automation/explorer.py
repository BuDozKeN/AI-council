"""
Autonomous App Explorer using browser-use

This script uses AI agents to autonomously explore the AxCouncil application,
interact with every element, and report any issues found.

Usage:
    python -m backend.automation.explorer
    python -m backend.automation.explorer --viewport mobile
    python -m backend.automation.explorer --screen /settings
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Conditional imports for browser-use
try:
    from browser_use import Agent, Browser, BrowserConfig
    from langchain_anthropic import ChatAnthropic
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("Warning: browser-use not installed. Run: pip install browser-use langchain-anthropic")


# Configuration
APP_URL = os.getenv("APP_URL", "http://localhost:5173")
SCREENSHOT_DIR = Path("screenshots/exploration")
REPORT_DIR = Path("reports")

VIEWPORTS = {
    "desktop": {"width": 1280, "height": 800},
    "tablet": {"width": 768, "height": 1024},
    "mobile": {"width": 390, "height": 844},
}

SCREENS_TO_TEST = [
    "/",
    "/mycompany",
    "/mycompany?tab=team",
    "/mycompany?tab=projects",
    "/mycompany?tab=knowledge",
    "/settings",
    "/settings/account",
    "/settings/company",
    "/settings/billing",
]


class ExplorationReport:
    """Collects and formats exploration results."""

    def __init__(self):
        self.start_time = datetime.now()
        self.issues: list[dict[str, Any]] = []
        self.screens_tested: list[str] = []
        self.elements_interacted: int = 0
        self.console_errors: list[dict[str, Any]] = []
        self.network_errors: list[dict[str, Any]] = []

    def add_issue(
        self,
        screen: str,
        element: str,
        severity: str,
        category: str,
        expected: str,
        actual: str,
        screenshot: str | None = None,
    ) -> None:
        """Record an issue found during exploration."""
        issue_id = f"EXP-{len(self.issues) + 1:03d}"
        self.issues.append({
            "id": issue_id,
            "timestamp": datetime.now().isoformat(),
            "screen": screen,
            "element": element,
            "severity": severity,
            "category": category,
            "expected": expected,
            "actual": actual,
            "screenshot": screenshot,
        })

    def to_markdown(self) -> str:
        """Generate markdown report."""
        duration = datetime.now() - self.start_time

        p0_count = sum(1 for i in self.issues if i["severity"] == "P0")
        p1_count = sum(1 for i in self.issues if i["severity"] == "P1")
        p2_count = sum(1 for i in self.issues if i["severity"] == "P2")
        p3_count = sum(1 for i in self.issues if i["severity"] == "P3")

        report = f"""# Autonomous App Exploration Report

**Date:** {self.start_time.strftime("%Y-%m-%d %H:%M:%S")}
**Duration:** {duration.total_seconds() / 60:.1f} minutes
**Screens Tested:** {len(self.screens_tested)}
**Elements Interacted:** {self.elements_interacted}
**Total Issues:** {len(self.issues)}

## Summary

| Severity | Count |
|----------|-------|
| P0 Blocker | {p0_count} |
| P1 Critical | {p1_count} |
| P2 Major | {p2_count} |
| P3 Minor | {p3_count} |

## Issues Found

"""
        for severity in ["P0", "P1", "P2", "P3"]:
            severity_issues = [i for i in self.issues if i["severity"] == severity]
            if severity_issues:
                report += f"### {severity} Issues\n\n"
                for issue in severity_issues:
                    report += f"""#### {issue['id']}: {issue['category']}
- **Screen:** {issue['screen']}
- **Element:** {issue['element']}
- **Expected:** {issue['expected']}
- **Actual:** {issue['actual']}
- **Screenshot:** {issue['screenshot'] or 'N/A'}

"""
        return report

    def save(self, filename: str | None = None) -> Path:
        """Save report to file."""
        REPORT_DIR.mkdir(parents=True, exist_ok=True)

        if filename is None:
            filename = f"exploration-{self.start_time.strftime('%Y%m%d-%H%M%S')}"

        # Save markdown
        md_path = REPORT_DIR / f"{filename}.md"
        md_path.write_text(self.to_markdown())

        # Save JSON
        json_path = REPORT_DIR / f"{filename}.json"
        json_path.write_text(json.dumps({
            "start_time": self.start_time.isoformat(),
            "duration_seconds": (datetime.now() - self.start_time).total_seconds(),
            "screens_tested": self.screens_tested,
            "elements_interacted": self.elements_interacted,
            "issues": self.issues,
            "console_errors": self.console_errors,
            "network_errors": self.network_errors,
        }, indent=2))

        return md_path


async def explore_app(
    viewport: str = "desktop",
    screens: list[str] | None = None,
    headless: bool = False,
) -> ExplorationReport:
    """
    Autonomously explore the AxCouncil application.

    Args:
        viewport: Viewport size to use (desktop, tablet, mobile)
        screens: Specific screens to test, or None for all
        headless: Run browser in headless mode

    Returns:
        ExplorationReport with all findings
    """
    if not BROWSER_USE_AVAILABLE:
        raise RuntimeError(
            "browser-use is not installed. "
            "Run: pip install browser-use langchain-anthropic playwright && playwright install chromium"
        )

    report = ExplorationReport()
    screens_to_test = screens or SCREENS_TO_TEST
    viewport_config = VIEWPORTS.get(viewport, VIEWPORTS["desktop"])

    # Ensure screenshot directory exists
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize browser with viewport
    browser_config = BrowserConfig(
        headless=headless,
        viewport_width=viewport_config["width"],
        viewport_height=viewport_config["height"],
    )

    browser = Browser(config=browser_config)

    # Initialize AI agent with Claude
    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        temperature=0,
    )

    for screen in screens_to_test:
        url = f"{APP_URL}{screen}"
        print(f"\n{'='*60}")
        print(f"Exploring: {screen}")
        print(f"{'='*60}")

        # Create exploration task for this screen
        exploration_task = f"""
        Navigate to {url} and systematically test this screen:

        1. NAVIGATION:
           - Wait for the page to fully load
           - Take note of all visible elements

        2. INTERACTIVE ELEMENTS:
           - Find and click every button
           - Test every link (but don't leave the main app)
           - Open every dropdown and select options
           - Toggle any switches/checkboxes
           - Test any tabs or accordion items

        3. FORMS (if any):
           - Fill in text inputs with realistic test data
           - Test form validation (try empty, invalid data)
           - Test form submission

        4. MODALS (if any):
           - Open any modal dialogs
           - Test all buttons inside modals
           - Test closing via X button, Escape key, and clicking outside

        5. REPORT:
           For each interaction, note:
           - Element interacted with
           - Expected behavior
           - Actual behavior
           - Any errors or unexpected results

        Be thorough but efficient. If something doesn't work as expected,
        note it and continue exploring.

        Current viewport: {viewport} ({viewport_config['width']}x{viewport_config['height']})
        """

        try:
            agent = Agent(
                task=exploration_task,
                llm=llm,
                browser=browser,
            )

            result = await agent.run(max_steps=50)

            # Process results and add to report
            report.screens_tested.append(screen)

            # Parse agent output for issues
            if result and "error" in str(result).lower():
                report.add_issue(
                    screen=screen,
                    element="Unknown",
                    severity="P2",
                    category="exploration",
                    expected="Smooth interaction",
                    actual=str(result)[:500],
                )

            print(f"✓ Completed: {screen}")

        except Exception as e:
            print(f"✗ Error on {screen}: {e}")
            report.add_issue(
                screen=screen,
                element="Page",
                severity="P1",
                category="error",
                expected="Page loads successfully",
                actual=str(e)[:500],
            )

    # Close browser
    await browser.close()

    return report


async def run_full_exploration() -> None:
    """Run full exploration across all viewports."""
    print("\n" + "="*70)
    print("  AxCouncil Autonomous App Explorer")
    print("  Using browser-use + Claude AI")
    print("="*70 + "\n")

    all_reports: list[ExplorationReport] = []

    for viewport in ["desktop", "mobile"]:
        print(f"\n>>> Testing {viewport.upper()} viewport <<<\n")
        report = await explore_app(viewport=viewport)
        all_reports.append(report)
        report_path = report.save(f"exploration-{viewport}")
        print(f"\nReport saved: {report_path}")

    # Summary
    total_issues = sum(len(r.issues) for r in all_reports)
    print("\n" + "="*70)
    print(f"  EXPLORATION COMPLETE")
    print(f"  Total Issues Found: {total_issues}")
    print("="*70 + "\n")


def main() -> None:
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Autonomous App Explorer for AxCouncil"
    )
    parser.add_argument(
        "--viewport",
        choices=["desktop", "tablet", "mobile"],
        default="desktop",
        help="Viewport to test (default: desktop)",
    )
    parser.add_argument(
        "--screen",
        type=str,
        help="Specific screen to test (e.g., /settings)",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run in headless mode",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Run full exploration across all viewports",
    )

    args = parser.parse_args()

    if args.full:
        asyncio.run(run_full_exploration())
    else:
        screens = [args.screen] if args.screen else None
        report = asyncio.run(
            explore_app(
                viewport=args.viewport,
                screens=screens,
                headless=args.headless,
            )
        )
        report_path = report.save()
        print(f"\nReport saved: {report_path}")
        print(f"Issues found: {len(report.issues)}")


if __name__ == "__main__":
    main()
