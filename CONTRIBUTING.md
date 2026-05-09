# Contributing to DiffAPI

Thank you for your interest in contributing to DiffAPI! This document outlines the guidelines for contributing to this project.

## Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we as contributors and maintainers pledge to making participation in our project and our community a harassment-free experience for everyone.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the [issue tracker](https://github.com/diffapi/diffapi/issues)
2. Use a clear and descriptive title
3. Provide steps to reproduce the issue
4. Include screenshots or logs if applicable
5. Specify your environment (Python version, OS, browser)

### Submitting Pull Requests

1. **Fork** the repository
2. **Create** a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make** your changes
4. **Test** your changes
5. **Commit** with a meaningful message:
   ```bash
   git commit -m "feat: add new feature"
   ```
6. **Push** to your fork
7. **Submit** a pull request

## Development Setup

### Prerequisites

- Python 3.8+
- MySQL 5.7+ or MariaDB 10.2+
- Node.js 14+ (for frontend development)

### Installation

```bash
# Clone the repository
git clone https://github.com/diffapi/diffapi.git
cd diffapi

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
python init_db.py

# Run the application
python app.py
```

## Coding Standards

### Python

- Follow [PEP 8](https://peps.python.org/pep-0008/) style guide
- Use type hints where appropriate
- Write docstrings for all functions and classes
- Use `logging` instead of `print` for logging

### JavaScript

- Use ES6+ syntax
- Use `const` and `let` appropriately
- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use JSDoc comments for functions

### Git Commit Messages

Use the following format:

```
<type>: <description>

[optional body]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build or tooling changes

### Pull Request Template

```markdown
## Description

Please include a summary of the changes and the related issue.

## Related Issues

Fixes #issue-number

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

Please describe how you tested your changes.
```

## License

By contributing to DiffAPI, you agree that your contributions will be licensed under the MIT License.

## Questions

If you have any questions, feel free to open an issue or contact the maintainers.