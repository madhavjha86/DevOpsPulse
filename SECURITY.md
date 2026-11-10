# Security Policy

The DevOpsPulse team takes software security seriously. We appreciate the responsible disclosure of vulnerabilities.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities via public GitHub issues.**

If you believe you have discovered a security vulnerability in DevOpsPulse:

1. Send an email to `security@devopspulse.local` or contact the repository maintainers privately.
2. Include the following details in your report:
   - Type of vulnerability (e.g., SQL injection, unauthorized access, SSRF, XSS)
   - Step-by-step reproduction instructions or proof-of-concept
   - Impact assessment
3. You will receive an acknowledgment within 48 hours.
4. We will coordinate a fix and release a patched version before public disclosure.

---

## Security Best Practices in DevOpsPulse

- **Password Hashing**: Bcrypt with salted rounds
- **Token Security**: Stateless JWTs with separate access (30m) and refresh (7d) lifecycles
- **Webhook Protection**: Cryptographic HMAC-SHA256 signature verification on all inbound payloads
- **Environment Isolation**: Secrets loaded exclusively via environment variables
- **CORS & Rate Limiting**: Strict origin whitelisting and request throttling enabled by default
