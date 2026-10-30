
import socket
import ssl
import hashlib
import certifi

from datetime import datetime, timezone


def investigate_ssl(hostname: str):

    result = {
        "hostname": hostname,
        "status": "unknown"
    }

    context = ssl.create_default_context(
        cafile=certifi.where()
    )

    try:
        with socket.create_connection(
            (hostname, 443),
            timeout=5
        ) as connection:

            with context.wrap_socket(
                connection,
                server_hostname=hostname
            ) as tls_socket:

                certificate = tls_socket.getpeercert()

                binary_certificate = tls_socket.getpeercert(
                    binary_form=True
                )

                issuer = {
                    key: value
                    for group in certificate.get("issuer", [])
                    for key, value in group
                }

                subject = {
                    key: value
                    for group in certificate.get("subject", [])
                    for key, value in group
                }

                san = [
                    value
                    for key, value in certificate.get(
                        "subjectAltName", []
                    )
                    if key == "DNS"
                ]

                result.update({
                    "status": "valid",
                    "issuer": issuer,
                    "subject": subject,
                    "subject_alternative_names": san,
                    "valid_from": certificate.get("notBefore"),
                    "valid_until": certificate.get("notAfter"),
                    "tls_version": tls_socket.version(),
                    "cipher": tls_socket.cipher()[0],
                    "sha256_fingerprint": hashlib.sha256(
                        binary_certificate
                    ).hexdigest(),
                    "checked_at": datetime.now(
                        timezone.utc
                    ).isoformat()
                })

    except ssl.SSLCertVerificationError as error:
        result.update({
            "status": "verification_failed",
            "error": str(error)
        })

    except (socket.timeout, TimeoutError):
        result.update({
            "status": "timeout"
        })

    except ssl.SSLError as error:
        result.update({
            "status": "ssl_error",
            "error": str(error)
        })

    except OSError as error:
        result.update({
            "status": "connection_failed",
            "error": str(error)
        })

    return result
