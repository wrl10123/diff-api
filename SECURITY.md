# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x     | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in DiffAPI, please follow these steps:

1. **Do not** open a public issue on GitHub.

2. **Email** the maintainers directly at: [security@diffapi.example.com](mailto:security@diffapi.example.com)

3. Include the following information in your report:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Any suggested fix (optional)

4. We will respond to your report within 48 hours.

## Security Best Practices

### For Users

1. **Always use environment variables** for sensitive configuration:
   - Database credentials
   - SECRET_KEY
   - API keys

2. **Use HTTPS** in production environments

3. **Restrict database access** to trusted IPs only

4. **Regularly update dependencies** using `pip list --outdated`

### For Developers

1. **Input Validation**: Always validate and sanitize user inputs
2. **Parameterized Queries**: Use SQLAlchemy ORM to prevent SQL injection
3. **XSS Protection**: Escape all user-generated content before rendering
4. **CSRF Protection**: Enable CSRF protection for form submissions
5. **Dependency Scanning**: Run `safety check` to scan for vulnerable dependencies

## Known Security Features

- Environment variable management for sensitive config
- Input validation and sanitization
- SQL injection protection via SQLAlchemy ORM
- XSS protection via Jinja2 auto-escaping
- Secure database migration with whitelist validation
- Error boundary handling to prevent information leakage