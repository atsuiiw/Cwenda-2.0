"""Print the user's MyCourseVille assignments as JSON for the importer.

Run with the Python inside the mcv-cli tool env (it has mcv_api), so due
dates are parsed by mcv-cli itself. Uses the `mcv` login of whoever runs it.
Output: [{"ref", "title", "course", "due_at", "submitted", "url"}]
Errors: one line on stderr, exit 1.
"""

import json
import shutil
import subprocess
import sys

from mcv_api.aggregates.assignments import is_pending
from mcv_api.resources.assignments.models import Assignment


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    sys.exit(1)


def mcv_json(*args: str):
    mcv = shutil.which("mcv") or fail("mcv is not installed or not on PATH.")
    result = subprocess.run([mcv, "--json", "--quiet", *args], capture_output=True, text=True)
    if result.returncode != 0:
        try:
            fail(json.loads(result.stderr)["message"])
        except (ValueError, KeyError, TypeError):
            fail(result.stderr.strip() or f"mcv exited with code {result.returncode}")
    return json.loads(result.stdout)


if not mcv_json("auth", "status").get("authenticated"):
    fail("MCV session expired. Run `mcv auth login` in a terminal, then import again.")

rows = []
for raw in mcv_json("assignments", "list", "--due"):
    assignment = Assignment.model_validate(raw)
    if assignment.due_at is None:
        continue  # due text mcv-cli can't read; nothing to put on the calendar
    rows.append(
        {
            "ref": str(assignment.ref),
            "title": assignment.title or f"Assignment {assignment.itemid}",
            "course": assignment.course_no,
            "due_at": assignment.due_at.isoformat(),
            "submitted": not is_pending(assignment),
            "url": assignment.detail_url,
        }
    )
print(json.dumps(rows))
