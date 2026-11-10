# Contributing to DevOpsPulse

Thank you for your interest in contributing to DevOpsPulse! We welcome contributions from developers of all skill levels.

---

## 🛠️ Development Workflow

1. **Fork the Repository**
   Fork the repository to your own GitHub account and clone it locally:
   ```bash
   git clone https://github.com/<your-username>/DevOpsPulse.git
   cd DevOpsPulse
   ```

2. **Create a Feature Branch**
   Use descriptive branch names following the convention:
   ```bash
   git checkout -b feature/github-workflow-dispatch
   # or
   git checkout -b fix/auth-token-refresh
   ```

3. **Set Up the Environment**
   Follow the local installation instructions in the [README](README.md) using Docker Compose or local virtualenv.

4. **Code Quality Standards**
   - **Backend**: Adhere to PEP 8. Use type hints for all function arguments and return types.
   - **Frontend**: Use TypeScript strict types. Avoid using `any` wherever possible. Follow ESLint and Prettier formatting.

5. **Write Automated Tests**
   - Every new feature or bugfix should include corresponding unit or integration tests in `backend/tests/`.
   - Ensure the test suite passes before submitting:
     ```bash
     cd backend && pytest
     ```

6. **Commit Messages**
   Follow conventional commits:
   - `feat: add pipeline duration percentiles to analytics`
   - `fix: handle null author email in commit ingestion`
   - `docs: update deployment environment variables in README`
   - `test: add webhook replay security tests`

7. **Submit a Pull Request**
   Push your branch to GitHub and open a Pull Request against the `main` branch. Provide a clear summary of your changes, reference any related issues, and attach screenshots for UI updates.

---

## 💬 Community & Help

If you have questions or ideas, open an issue on GitHub.
