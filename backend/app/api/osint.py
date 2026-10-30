
import re
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_connection

router = APIRouter(prefix="/api/safety", tags=["SHEild Safety"])


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=16)


class IncidentCreate(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=5, max_length=2000)


def validate_phone(phone: str):
    if not re.fullmatch(r"\+?[0-9]{10,15}", phone):
        raise HTTPException(
            status_code=400,
            detail="Invalid phone number format."
        )


@router.get("/contacts")
def get_contacts():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, name, phone, created_at FROM trusted_contacts ORDER BY id DESC"
        ).fetchall()

    return [dict(row) for row in rows]


@router.post("/contacts", status_code=201)
def add_contact(contact: ContactCreate):
    name = contact.name.strip()
    phone = contact.phone.strip()

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter a valid name.")

    validate_phone(phone)

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO trusted_contacts (name, phone) VALUES (?, ?)",
                (name, phone)
            )
            connection.commit()

            row = connection.execute(
                "SELECT id, name, phone, created_at FROM trusted_contacts WHERE id = ?",
                (cursor.lastrowid,)
            ).fetchone()

        return dict(row)

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="This phone number is already registered."
        )


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM trusted_contacts WHERE id = ?",
            (contact_id,)
        )
        connection.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Contact not found.")

    return {"message": "Contact deleted successfully."}


@router.post("/reports", status_code=201)
def create_report(report: IncidentCreate):
    category = report.category.strip()
    description = report.description.strip()

    if len(category) < 2 or len(description) < 5:
        raise HTTPException(status_code=400, detail="Invalid report details.")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO incident_reports (category, description)
            VALUES (?, ?)
            """,
            (category, description)
        )
        connection.commit()

        row = connection.execute(
            """
            SELECT id, category, description, created_at, status
            FROM incident_reports
            WHERE id = ?
            """,
            (cursor.lastrowid,)
        ).fetchone()

    return dict(row)


@router.get("/reports")
def get_reports():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, category, description, created_at, status
            FROM incident_reports
            ORDER BY id DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]
