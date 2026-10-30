
from datetime import datetime, timezone


def calculate_risk(dns_data, rdap_data, ip_data, ssl_data):

    score = 0
    findings = []

    # SSL/TLS analysis
    ssl_status = ssl_data.get("status")

    if ssl_status == "verification_failed":
        score += 30
        findings.append({
            "severity": "high",
            "finding": "SSL certificate verification failed"
        })

    elif ssl_status in ("ssl_error", "connection_failed"):
        score += 15
        findings.append({
            "severity": "medium",
            "finding": "SSL/TLS connection could not be verified"
        })

    elif ssl_status == "valid":
        findings.append({
            "severity": "info",
            "finding": "Valid SSL/TLS certificate detected"
        })

    # Domain age analysis
    creation_date = rdap_data.get("creation_date")

    if creation_date:
        try:
            created = datetime.fromisoformat(
                creation_date.replace("Z", "+00:00")
            )

            age_days = (
                datetime.now(timezone.utc) - created
            ).days

            if age_days < 30:
                score += 25
                findings.append({
                    "severity": "high",
                    "finding": "Domain registered less than 30 days ago"
                })

            elif age_days < 180:
                score += 15
                findings.append({
                    "severity": "medium",
                    "finding": "Recently registered domain"
                })

            else:
                findings.append({
                    "severity": "info",
                    "finding": f"Domain age: {age_days} days"
                })

        except (ValueError, TypeError):
            pass

    # DNS analysis
    if dns_data.get("A", {}).get("status") != "success":
        score += 10
        findings.append({
            "severity": "medium",
            "finding": "No successful IPv4 DNS resolution"
        })

    # RDAP analysis
    if rdap_data.get("status") != "success":
        score += 10
        findings.append({
            "severity": "low",
            "finding": "Domain registration information unavailable"
        })

    # IP intelligence availability
    if not ip_data:
        findings.append({
            "severity": "low",
            "finding": "No public IP intelligence available"
        })

    score = min(score, 100)

    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"

    return {
        "risk_score": score,
        "risk_level": level,
        "findings": findings,
        "assessment_type": "preliminary_heuristic",
        "disclaimer": (
            "This score is based on technical indicators, "
            "not a confirmed malware or phishing verdict."
        )
    }
