
import ipaddress
import dns.resolver
import httpx


def lookup_record(hostname: str, record_type: str):

    try:
        answers = dns.resolver.resolve(
            hostname,
            record_type,
            lifetime=8
        )

        records = []

        for record in answers:

            if record_type in ("A", "AAAA"):
                address = str(record.address)

                if ipaddress.ip_address(address).is_global:
                    records.append(address)

            elif record_type == "MX":
                exchange = record.exchange.to_text().rstrip(".")
                records.append({
                    "priority": record.preference,
                    "host": exchange or None,
                    "type": "mail_server" if exchange else "null_mx"
                })

            elif record_type == "NS":
                records.append(record.target.to_text().rstrip("."))

        return {
            "status": "success" if records else "no_public_records",
            "records": records
        }

    except dns.resolver.NXDOMAIN:
        return {"status": "domain_not_found", "records": []}

    except dns.resolver.NoAnswer:
        return {"status": "no_records", "records": []}

    except dns.resolver.LifetimeTimeout:
        return {"status": "timeout", "records": []}

    except Exception:
        return {"status": "lookup_error", "records": []}


def lookup_txt(hostname: str):

    try:
        response = httpx.get(
            "https://dns.google/resolve",
            params={"name": hostname, "type": "TXT"},
            timeout=8
        )

        response.raise_for_status()
        data = response.json()

        records = []

        for answer in data.get("Answer", []):
            if answer.get("type") == 16:
                value = answer.get("data", "").replace('" "', "")
                value = value.replace('"', "")
                records.append(value[:500])

        return {
            "status": "success" if records else "no_records",
            "records": records
        }

    except (httpx.HTTPError, ValueError):
        return {"status": "lookup_error", "records": []}


def lookup_dns(hostname: str):

    results = {}

    for record_type in ["A", "AAAA", "MX", "NS"]:
        results[record_type] = lookup_record(
            hostname,
            record_type
        )

    results["TXT"] = lookup_txt(hostname)

    txt_records = results["TXT"].get("records", [])

    spf = [
        record for record in txt_records
        if record.lower().startswith("v=spf1")
    ]

    results["SPF"] = {
        "status": "found" if spf else (
            "missing" if results["TXT"]["status"] == "success"
            else "unknown"
        ),
        "records": spf
    }

    dmarc_result = lookup_txt(f"_dmarc.{hostname}")

    dmarc = [
        record for record in dmarc_result.get("records", [])
        if record.lower().startswith("v=dmarc1")
    ]

    results["DMARC"] = {
        "status": "found" if dmarc else (
            "missing" if dmarc_result["status"] == "success"
            else "unknown"
        ),
        "records": dmarc
    }

    return results
