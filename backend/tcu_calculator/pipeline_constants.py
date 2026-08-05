"""
Shared constants for the TCU calculator — the grade-to-points conversion
(Table 1), locked and verified earlier. No LLM involvement at runtime;
this is the deterministic rules layer the calculator engine reads from.
"""

GRADE_POINT_SCALES = {
    "PRE_2014":     {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1, "S": 0.5},
    "2014_2015":    {"A": 5, "B+": 4, "B": 3, "C": 2, "D": 1, "E": 0.5},
    "2016_ONWARDS": {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1, "S": 0.5},
}

COHORT_LABELS = {
    "PRE_2014":     "Kabla ya 2014",
    "2014_2015":    "2014 - 2015",
    "2016_ONWARDS": "2016 na kuendelea",
}

# Common A-Level subjects seen across the guidebook — powers the frontend
# dropdown. Free-text entry is still supported as a fallback for anything
# not in this list.
COMMON_SUBJECTS = [
    "History", "Geography", "English Language", "Literature in English",
    "Kiswahili", "Kiislam", "Kikristo", "Arabic", "French", "Fine Arts",
    "Economics", "Commerce", "Accountancy", "Physics", "Chemistry",
    "Biology", "Advanced Mathematics", "Basic Applied Mathematics",
    "Agriculture", "Computer Science", "Nutrition", "General Studies",
]


def normalize_subject(name: str) -> str:
    """Case/whitespace-insensitive matching between student input and slot data."""
    return " ".join(name.strip().lower().split())