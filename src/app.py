"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

ALLOWED_ROLES = {"organizer", "approval_committee", "admin"}


def require_role(user_role: Optional[str], allowed_roles: set[str]) -> str:
    """Validate the caller role and return the normalized role."""
    role = (user_role or "").strip().lower()

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="A valid user role must be provided"
        )

    if role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"The {role} role cannot perform this action"
        )

    return role

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"],
        "reviews": []
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"],
        "reviews": []
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"],
        "reviews": []
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"],
        "reviews": []
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"],
        "reviews": []
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"],
        "reviews": []
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"],
        "reviews": []
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"],
        "reviews": []
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"],
        "reviews": []
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    user_role: Optional[str] = Header(default=None, alias="X-User-Role")
):
    """Sign up a student for an activity"""
    require_role(user_role, {"organizer"})

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    user_role: Optional[str] = Header(default=None, alias="X-User-Role")
):
    """Unregister a student from an activity"""
    require_role(user_role, {"organizer"})

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}


@app.post("/activities/{activity_name}/review")
def review_activity(
    activity_name: str,
    comment: str = "Reviewed",
    user_role: Optional[str] = Header(default=None, alias="X-User-Role")
):
    """Record an approval committee review for an activity"""
    require_role(user_role, {"approval_committee"})

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    activity["reviews"].append({
        "comment": comment.strip() or "Reviewed",
        "role": "approval_committee"
    })

    return {"message": f"Recorded review for {activity_name}"}


@app.post("/activities/{activity_name}/capacity")
def update_activity_capacity(
    activity_name: str,
    max_participants: int,
    user_role: Optional[str] = Header(default=None, alias="X-User-Role")
):
    """Update activity capacity for administrators"""
    require_role(user_role, {"admin"})

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    if max_participants < len(activities[activity_name]["participants"]):
        raise HTTPException(
            status_code=400,
            detail="Capacity cannot be lower than the current number of participants"
        )

    activities[activity_name]["max_participants"] = max_participants
    return {
        "message": f"Updated {activity_name} capacity to {max_participants}"
    }
