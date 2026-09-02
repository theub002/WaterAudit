from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from pydantic import BaseModel

import models
import auth
import email_service
from database import engine, get_db

# Create all tables (will not modify existing tables, only creates missing ones)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WaterAudit API")

# Setup CORS to allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ── Helper: get current user from token ───────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = auth.verify_firebase_token(token)
        firebase_uid: str = payload.get("uid")
        email_verified = payload.get("email_verified", False)
        if firebase_uid is None:
            raise credentials_exception
        if not email_verified:
            raise HTTPException(status_code=403, detail="Email not verified. Check your inbox.")
    except ValueError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.firebase_uid == firebase_uid).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    return user


# ── Helper: get admin user ────────────────────────────────────────
def get_admin_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    if current_user.role == "admin" and current_user.admin_status == "pending":
        raise HTTPException(status_code=403, detail="Admin privileges pending approval")
    if current_user.admin_status == "rejected":
        raise HTTPException(status_code=403, detail="Admin Access Denied")
    return current_user


# ── Helper: get superadmin user ───────────────────────────────────
def get_superadmin_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin privileges required")
    return current_user


# ── Register ──────────────────────────────────────────────────────
@app.post("/api/auth/register", response_model=models.UserResponse)
def register_user(user: models.UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        email=user.email,
        firebase_uid=user.firebase_uid,
        role=user.role,
        admin_status="pending" if user.role == "admin" else "approved",
        user_type=user.user_type,
        full_name=user.full_name,
        gender=user.gender,
        org_name=user.org_name,
        designation=user.designation,
        contact=user.contact,
        address=user.address,
        location=user.location,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if new_user.role == "admin":
        superadmins = db.query(models.User).filter(models.User.role == "superadmin").all()
        superadmin_emails = [sa.email for sa in superadmins]
        if superadmin_emails:
            background_tasks.add_task(
                email_service.send_new_admin_notification, 
                superadmin_emails, 
                new_user.email, 
                new_user.full_name or "Unknown Name"
            )

    return new_user



# ── Get Current User ──────────────────────────────────────────────
@app.get("/api/users/me", response_model=models.UserResponse)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Update Profile ────────────────────────────────────────────────
@app.put("/api/users/me", response_model=models.UserResponse)
def update_profile(
    update: models.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


# ── Users: Request Admin Access ───────────────────────────────────
@app.post("/api/users/request-admin", response_model=models.UserResponse)
def request_admin_access(
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "user":
        raise HTTPException(status_code=400, detail="Only standard users can request admin access.")
    
    current_user.role = "admin"
    current_user.admin_status = "pending"
    db.commit()
    db.refresh(current_user)

    # Notify Superadmins
    superadmins = db.query(models.User).filter(models.User.role == "superadmin").all()
    superadmin_emails = [sa.email for sa in superadmins]
    if superadmin_emails:
        background_tasks.add_task(
            email_service.send_new_admin_notification, 
            superadmin_emails, 
            current_user.email, 
            current_user.full_name or "Unknown Name"
        )

    return current_user



# ── Users: Delete Account ─────────────────────────────────────────
@app.delete("/api/users/me", status_code=204)
def delete_user_account(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Delete from Firebase
    auth.delete_firebase_user(current_user.firebase_uid)
    
    # 2. Delete from database
    db.delete(current_user)
    db.commit()
    return None


# ── Projects: List ────────────────────────────────────────────────
@app.get("/api/projects", response_model=List[models.ProjectResponse])
def list_projects(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import or_
    
    if current_user.role == "superadmin":
        return db.query(models.Project).order_by(models.Project.updated_at.desc()).all()

    conditions = [
        models.Project.owner_id == current_user.id,
        (models.Project.status == "completed") & (models.User.role == "admin")
    ]
    
    # If the user is an admin, they should also see any project in their assigned areas
    if current_user.role == "admin" and current_user.assigned_areas:
        conditions.append(models.Project.location.in_(current_user.assigned_areas))

    projects = (
        db.query(models.Project)
        .join(models.User, models.Project.owner_id == models.User.id)
        .filter(or_(*conditions))
        .order_by(models.Project.updated_at.desc())
        .all()
    )
    return projects


# ── Projects: Create ──────────────────────────────────────────────
@app.post("/api/projects", response_model=models.ProjectResponse, status_code=201)
def create_project(
    project: models.ProjectCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    new_project = models.Project(
        owner_id=current_user.id,
        **project.model_dump(),
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project


# ── Projects: Get Single ──────────────────────────────────────────
@app.get("/api/projects/{project_id}", response_model=models.ProjectResponse)
def get_project(
    project_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ── Projects: Delete ──────────────────────────────────────────────
@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None


# ── Data Input: Get Progress ──────────────────────────────────────
@app.get("/api/projects/{project_id}/data-input", response_model=models.DataInputResponse)
def get_data_input(
    project_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    data_input = db.query(models.DataInput).filter(models.DataInput.project_id == project_id).first()
    if not data_input:
        # Return an empty structure if none exists
        return models.DataInputResponse(
            id=0, 
            project_id=project_id, 
            data_values={}, 
            validation_scores={}, 
            modal_answers={},
            created_at=project.created_at,
            updated_at=project.updated_at
        )
    return data_input


# ── Data Input: Save Progress (ADMIN ONLY) ────────────────────────
@app.post("/api/projects/{project_id}/data-input", response_model=models.DataInputResponse)
def save_data_input(
    project_id: int,
    data: models.DataInputCreate,
    current_admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_admin.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_data = db.query(models.DataInput).filter(models.DataInput.project_id == project_id).first()
    if db_data:
        db_data.data_values = data.data_values
        db_data.validation_scores = data.validation_scores
        db_data.modal_answers = data.modal_answers
    else:
        db_data = models.DataInput(
            project_id=project_id,
            data_values=data.data_values,
            validation_scores=data.validation_scores,
            modal_answers=data.modal_answers
        )
        db.add(db_data)
    
    db.commit()
    db.refresh(db_data)
    return db_data


# ── Superadmin: Manage Users ──────────────────────────────────────
class AdminStatusUpdate(BaseModel):
    admin_status: str

class RoleUpdate(BaseModel):
    role: str

@app.get("/api/admin/users", response_model=List[models.UserResponse])
def get_all_users(
    current_superadmin: models.User = Depends(get_superadmin_user),
    db: Session = Depends(get_db),
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@app.put("/api/admin/users/{user_id}/status", response_model=models.UserResponse)
def update_admin_status(
    user_id: int,
    status_update: AdminStatusUpdate,
    current_superadmin: models.User = Depends(get_superadmin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if status_update.admin_status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    user.admin_status = status_update.admin_status
    db.commit()
    db.refresh(user)
    return user

@app.put("/api/admin/users/{user_id}/role", response_model=models.UserResponse)
def update_user_role(
    user_id: int,
    role_update: RoleUpdate,
    background_tasks: BackgroundTasks,
    current_superadmin: models.User = Depends(get_superadmin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role_update.role not in ["user", "admin", "superadmin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    old_role = user.role
    user.role = role_update.role
    if user.role in ["admin", "superadmin"]:
        user.admin_status = "approved"  # Auto-approve if manually promoted
    else:
        user.admin_status = "approved"  # normal users are approved
        
    db.commit()
    db.refresh(user)

    # Send notification if access revoked
    if old_role in ["admin", "superadmin"] and role_update.role == "user":
        background_tasks.add_task(email_service.send_access_revoked_notification, user.email, old_role)

    return user


class AreasUpdate(BaseModel):
    assigned_areas: List[str]

@app.put("/api/admin/users/{user_id}/areas", response_model=models.UserResponse)
def update_user_areas(
    user_id: int,
    areas_update: AreasUpdate,
    current_superadmin: models.User = Depends(get_superadmin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.assigned_areas = areas_update.assigned_areas
    db.commit()
    db.refresh(user)
    return user
