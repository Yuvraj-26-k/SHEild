
import httpx
from datetime import datetime, timezone


RDAP_BASE = "https://rdap.org/domain/"


def extract_registrar(entities):
    for entity in entities or []:
        roles = entity.get("roles", [])

        if "registrar" in roles:
            for item in entity.get("vcardArray", [None, []])[1]:
                if len(item) >= 4 and item[0] == "fn":
                    return item[3]

    return None


def lookup_rdap(domain: str):

    url = RDAP_BASE + domain

    try:
        response = httpx.get(
            url,
            headers={"Accept": "application/rdap+json"},
            timeout=10,
            follow_redirects=True
        )

        if response.status_code == 404:
            return {"status": "not_found"}

        response.raise_for_status()
        data = response.json()

        events = {}

        for event in data.get("events", []):
            action = event.get("eventAction")
            date = event.get("eventDate")

            if action and date:
                events[action] = date

        nameservers = [
            ns.get("ldhName")
            for ns in data.get("nameservers", [])
            if ns.get("ldhName")
        ]

        return {
            "status": "success",
            "domain": data.get("ldhName"),
            "registrar": extract_registrar(
                data.get("entities", [])
            ),
            "creation_date": events.get("registration"),
            "updated_date": events.get("last changed"),
            "expiration_date": events.get("expiration"),
            "domain_status": data.get("status", []),
            "nameservers": nameservers,
            "lookup_time": datetime.now(timezone.utc).isoformat()
        }

    except httpx.HTTPStatusError as error:
        return {
            "status": "service_error",
            "http_status": error.response.status_code
        }

    except httpx.RequestError:
        return {"status": "connection_error"}

    except ValueError:
        return {"status": "invalid_response"}
