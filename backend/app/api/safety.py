
import re
import sqlite3
from concurrent.futures import ThreadPoolExecutor

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import get_connection

router = APIRouter(prefix="/api/safety", tags=["SHEild Safety"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

NCRB_LAYER_URL = (
    "https://livingatlas.esri.in/server1/rest/services/"
    "NCRB/District_Wise_Crime_Against_Women_2022/MapServer/0/query"
)

NCRB_CITY_DATA_URL = "https://data.opencity.in/dataset/crime-in-india-2023"
NCRB_OFFICIAL_URL = "https://www.data.gov.in/catalog/crime-india-2023"


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=16)


class IncidentCreate(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=5, max_length=2000)


def validate_phone(phone: str):
    if not re.fullmatch(r"\+?[0-9]{10,15}", phone):
        raise HTTPException(status_code=400, detail="Invalid phone number.")


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
        raise HTTPException(status_code=409, detail="This phone number already exists.")


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

    return {"message": "Contact deleted."}


@router.post("/reports", status_code=201)
def create_report(report: IncidentCreate):
    category = report.category.strip()
    description = report.description.strip()

    if len(category) < 2 or len(description) < 5:
        raise HTTPException(status_code=400, detail="Invalid report details.")

    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO incident_reports (category, description) VALUES (?, ?)",
            (category, description)
        )
        connection.commit()

        row = connection.execute(
            """
            SELECT id, category, description, created_at, status
            FROM incident_reports WHERE id = ?
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
            FROM incident_reports ORDER BY id DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def fetch_amritsar_places():
    query = """
    [out:json][timeout:25];
    (
      node["amenity"~"^(police|hospital|clinic)$"](31.50,74.70,31.80,75.00);
      way["amenity"~"^(police|hospital|clinic)$"](31.50,74.70,31.80,75.00);
      relation["amenity"~"^(police|hospital|clinic)$"](31.50,74.70,31.80,75.00);
    );
    out center tags;
    """

    response = httpx.post(
        OVERPASS_URL,
        data={"data": query},
        headers={"User-Agent": "SHEild-Hackathon/1.0"},
        timeout=35
    )
    response.raise_for_status()

    elements = response.json().get("elements", [])
    places = []

    for element in elements:
        tags = element.get("tags", {})
        amenity = tags.get("amenity", "")

        if amenity not in ("police", "hospital", "clinic"):
            continue

        lat = element.get("lat")
        lon = element.get("lon")

        if lat is None or lon is None:
            center = element.get("center", {})
            lat = center.get("lat")
            lon = center.get("lon")

        if lat is None or lon is None:
            continue

        places.append({
            "id": str(element.get("id")),
            "name": tags.get("name", "Unnamed facility"),
            "type": amenity,
            "lat": lat,
            "lng": lon,
            "address": ", ".join(
                filter(None, [
                    tags.get("addr:street"),
                    tags.get("addr:suburb"),
                    tags.get("addr:city")
                ])
            )
        })

    return places


def fetch_women_crime_data():
    params = {
        "where": "state LIKE '%Punjab%' AND dist LIKE '%Amritsar%'",
        "outFields": (
            "dist,state,totcrwom24,totipcbns24,totsllcr24,"
            "totmod24,totsexh24,totstk24,totkidabd24,"
            "dwyph24,prtdomvi24,totcyit24,totpocso24"
        ),
        "returnGeometry": "false",
        "f": "json"
    }

    response = httpx.get(
        NCRB_LAYER_URL,
        params=params,
        timeout=25
    )
    response.raise_for_status()

    data = response.json()

    if data.get("error"):
        raise ValueError(data["error"].get("message", "NCRB service error"))

    features = data.get("features", [])

    if not features:
        return {
            "available": False,
            "message": "No matching Amritsar district record returned by this service.",
            "source": NCRB_LAYER_URL
        }

    attributes = features[0].get("attributes", {})

    fields = {
        "total_crimes_against_women": "totcrwom24",
        "ipc_bns_crimes_against_women": "totipcbns24",
        "special_local_law_crimes": "totsllcr24",
        "assault_on_women": "totmod24",
        "sexual_harassment": "totsexh24",
        "stalking": "totstk24",
        "kidnapping_abduction": "totkidabd24",
        "dowry_prohibition_cases": "dwyph24",
        "domestic_violence_act_cases": "prtdomvi24",
        "women_centric_cyber_crimes": "totcyit24",
        "pocso_girl_child_cases": "totpocso24"
    }

    values = {}

    for label, field in fields.items():
        value = attributes.get(field)
        values[label] = value

    return {
        "available": True,
        "district": attributes.get("dist", "Amritsar"),
        "state": attributes.get("state", "Punjab"),
        "year": 2024,
        "geography": "District-level, not street-level",
        "values": values,
        "source": NCRB_LAYER_URL
    }


@router.get("/amritsar/map")
def amritsar_map():
    try:
        places = fetch_amritsar_places()
        return {
            "city": "Amritsar",
            "state": "Punjab",
            "center": {"lat": 31.6340, "lng": 74.8723},
            "places": places,
            "place_count": len(places),
            "source": "OpenStreetMap contributors",
            "source_url": "https://www.openstreetmap.org/copyright"
        }
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Map location service unavailable: {str(error)}"
        )


@router.get("/amritsar/crime-data")
def amritsar_crime_data():
    try:
        women_data = fetch_women_crime_data()
    except Exception as error:
        women_data = {
            "available": False,
            "message": f"NCRB district data could not be loaded: {str(error)}"
        }

    return {
        "city": "Amritsar",
        "state": "Punjab",
        "women_crime_data": women_data,
        "all_crime_data": {
            "available": True,
            "note": (
                "The NCRB 2023 catalogue provides city-wise and crime-head-wise "
                "datasets. This endpoint does not invent or estimate Amritsar "
                "city-wide counts."
            ),
            "categories": [
                "Murder",
                "Attempt to murder",
                "Robbery",
                "Theft",
                "Burglary",
                "Kidnapping and abduction",
                "Violent crimes",
                "Crimes against women",
                "Cybercrime",
                "Special and Local Laws offences"
            ],
            "year": 2023,
            "source": NCRB_CITY_DATA_URL,
            "official_source": NCRB_OFFICIAL_URL
        }
    }


@router.get("/amritsar/sources")
def amritsar_sources():
    return {
        "sources": [
            {
                "name": "NCRB Crime in India 2023",
                "url": NCRB_OFFICIAL_URL,
                "description": "Official national crime statistics catalogue."
            },
            {
                "name": "NCRB city-wise crime datasets 2023",
                "url": NCRB_CITY_DATA_URL,
                "description": "City-wise IPC, SLL and crime-head datasets."
            },
            {
                "name": "NCRB district-wise crimes against women 2024",
                "url": NCRB_LAYER_URL,
                "description": "District-level women's crime statistics."
            },
            {
                "name": "OpenStreetMap",
                "url": "https://www.openstreetmap.org/copyright",
                "description": "Community-maintained map and public facility locations."
            }
        ]
    }
