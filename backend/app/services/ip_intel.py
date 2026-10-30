
import ipaddress
import httpx

from datetime import datetime, timezone


def investigate_ip(ip: str):

    try:
        address = ipaddress.ip_address(ip)

        if not address.is_global:
            return {
                "ip": ip,
                "status": "non_public_ip"
            }

    except ValueError:
        return {
            "ip": ip,
            "status": "invalid_ip"
        }

    result = {
        "ip": ip,
        "status": "success",
        "geolocation": {},
        "network_intelligence": {},
        "investigation_time": datetime.now(
            timezone.utc
        ).isoformat()
    }

    try:
        response = httpx.get(
            f"https://ipwho.is/{ip}",
            timeout=8
        )

        response.raise_for_status()
        data = response.json()

        if data.get("success"):
            connection = data.get("connection") or {}

            result["geolocation"] = {
                "country": data.get("country"),
                "region": data.get("region"),
                "city": data.get("city"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": (
                    data.get("timezone") or {}
                ).get("id")
            }

            result["network_intelligence"] = {
                "asn": connection.get("asn"),
                "organisation": connection.get("org"),
                "isp": connection.get("isp"),
                "domain": connection.get("domain")
            }
        else:
            result["geolocation_status"] = "unavailable"

    except (httpx.HTTPError, ValueError):
        result["geolocation_status"] = "lookup_failed"

    # IP registration information through RDAP
    try:
        response = httpx.get(
            f"https://rdap.org/ip/{ip}",
            headers={"Accept": "application/rdap+json"},
            timeout=8,
            follow_redirects=True
        )

        response.raise_for_status()
        data = response.json()

        result["ip_registration"] = {
            "network_name": data.get("name"),
            "handle": data.get("handle"),
            "country": data.get("country"),
            "start_address": data.get("startAddress"),
            "end_address": data.get("endAddress"),
            "network_type": data.get("type"),
            "status": data.get("status", [])
        }

    except (httpx.HTTPError, ValueError):
        result["ip_registration"] = {
            "status": "lookup_failed"
        }

    return result
