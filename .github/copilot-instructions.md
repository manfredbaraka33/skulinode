# SkuliNode SaaS Context
- **Product:** Multi-tenant School Management System (SaaS).
- **Stack:** Django (Backend), React + Vite (Frontend), PostgreSQL.
- **Rules:** 1. Every model must have a `school` ForeignKey (Tenant isolation).
  2. Use NECTA grading (Tanzania).
  3. Parent accounts are linked by Phone Number.
  4. Use 'snake_case' for Python and 'camelCase' for JavaScript.