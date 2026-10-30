
import socket
import ipaddress
import httpx


SECURITY_HEADERS = [
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy"
]


def is_public_host(hostname):
    try:
        addresses = socket.getaddrinfo(
            hostname, 443, type=socket.SOCK_STREAM
        )

        return bool(addresses) and all(
            ipaddress.ip_address(item[4][0]).is_global
            for item in addresses
        )
    except (OSError, ValueError):
        return False


def investigate_http(hostname):

    result = {
        "status": "unknown",
        "final_url": None,
        "redirect_chain": [],
        "security_headers": {},
        "missing_headers": []
    }

    current_url = f"https://{hostname}/"
    visited = set()

    try:
        with httpx.Client(
            timeout=8,
            follow_redirects=False,
            verify=True,
            trust_env=False
        ) as client:

            for _ in range(6):

                parsed = httpx.URL(current_url)
                current_host = parsed.host

                if (
                    parsed.scheme != "https"
                    or not current_host
                    or not is_public_host(current_host)
                    or current_host in visited
                ):
                    result["status"] = "blocked_or_invalid_redirect"
                    return result

                visited.add(current_host)

                response = client.get(current_url)

                result["redirect_chain"].append({
                    "url": str(response.url),
                    "status_code": response.status_code
                })

                if response.is_redirect:
                    location = response.headers.get("location")

                    if not location:
                        break

                    current_url = str(
                        response.url.join(location)
                    )
                    continue

                result["final_url"] = str(response.url)

                headers = {
                    key.lower(): value
                    for key, value in response.headers.items()
                }

                for header in SECURITY_HEADERS:
                    result["security_headers"][header] = (
                        headers.get(header)
                    )

                    if not headers.get(header):
                        result["missing_headers"].append(header)

                result["status"] = "success"
                result["http_status_code"] = response.status_code
                result["https_enabled"] = True

                break

            else:
                result["status"] = "redirect_limit_exceeded"

    except httpx.TimeoutException:
        result["status"] = "timeout"

    except httpx.HTTPError:
        result["status"] = "connection_error"

    return result
