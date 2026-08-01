# Project Overview
Smart Inventory Management System is a production-ready, multi-agent developed platform designed to handle complex inventory workflows. It includes features such as authentication (RBAC), products and categories management, supplier and customer tracking, purchase and sales orders, detailed stock movements, and an analytics dashboard with future support for AI demand forecasting.

# Architecture
The system follows a modern decoupled architecture:
- **Frontend**: Single Page Application (SPA) communicating via REST APIs.
- **Backend**: API-first service handling business logic, authentication, and database interactions.
- **Database**: Relational database strictly enforcing schema definitions and constraints.
- **Infrastructure**: Containerized ecosystem for seamless deployment and development parity.

# Folder Structure
```
smart-inventory-management-system/
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── core/          # Core configurations and security
│   │   ├── models/        # SQLAlchemy database models
│   │   ├── schemas/       # Pydantic validation schemas
│   │   ├── services/      # Business logic
│   │   └── db/            # Database sessions
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page views
│   │   ├── services/      # API integration
│   │   └── styles/        # Tailwind configuration and CSS
├── alembic/               # Database migrations
├── docker/                # Dockerfiles and infrastructure config
├── tests/                 # Unit, integration, and E2E tests
├── docs/                  # Additional documentation
├── .agents/               # Multi-agent configurations and rules
└── docker-compose.yml     # Local environment orchestration
```

# Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL, SQLAlchemy (ORM), Alembic (Migrations)
- **Authentication**: JWT, Role-Based Access Control (RBAC)
- **Infrastructure**: Docker, Docker Compose

# Development Commands
- **Start All Services**: `docker-compose up -d`
- **Stop All Services**: `docker-compose down`
- **Backend Dev Server**: `cd backend && uvicorn app.main:app --reload`
- **Frontend Dev Server**: `cd frontend && npm run dev`
- **Run Migrations**: `alembic upgrade head`

# Database Rules
- The Database Engineer exclusively owns `backend/app/models/**`, `backend/app/db/**`, and `alembic/**`.
- Must verify runtime schema before changing migrations.
- **Constraints**: Ensure SKU uniqueness, accurate stock movement history (audit trail), and prevent negative stock without explicit policy.
- Backend and Database engineers cannot change the schema simultaneously.

# Docker Rules
- Exclusively managed by the DevOps Engineer.
- All development and deployment environments must be fully containerized.
- `docker-compose.yml` is the source of truth for the local environment setup.

# FastAPI Standards
- The Backend Engineer exclusively owns `backend/**` and must not modify frontend or database schema.
- Follow REST API design principles.
- Use dependency injection for database sessions and authentication.
- Implement robust business logic keeping route handlers clean.

# React Standards
- The Frontend Engineer exclusively owns `frontend/**`.
- Strictly typed using TypeScript.
- Styled exclusively with Tailwind CSS.
- Component-driven architecture using responsive design principles.
- Must not modify backend APIs or database models.

# Coding Style
- One active writer per shared contract.
- Adhere to strict type checking (mypy for Python, tsc for TypeScript).
- No parallel editing of the same file by multiple agents.

# Git Workflow
- Ensure all tests pass before proposing a merge.
- Code Reviewer is responsible for final review before merge.
- Every failure report must include steps to reproduce, expected result, actual result, and logs/evidence.

# Debugging Protocol
1. Reproduce the issue.
2. Identify the last known good boundary.
3. Identify the first failing boundary.
4. Form a hypothesis.
5. Gather runtime evidence.
6. Confirm root cause.
7. Apply the smallest fix.
8. Verify.
9. Run regression tests.
*Note: After two failed targeted fixes, enter DIAGNOSTIC MODE.*

# Testing Commands
- **Backend Tests**: `pytest backend/tests/`
- **Frontend Tests**: `cd frontend && npm test`
- QA Engineer owns all unit, API, integration, and E2E verifications.

# Deployment
- Orchestrated by the DevOps Engineer.
- Containerized builds are pushed via CI/CD pipelines.
- Ensure environment parity between staging and production via environment configuration.

# Current Milestone
- Initial Setup and Core Module Scaffold. (Pending API and Database integration).

# Known Issues
- Currently in early development; specific bug tracking to be established post-alpha deployment.
