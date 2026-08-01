# AGENTS.md

Version: 1.0

# Smart Inventory Management System - Multi-Agent Workflow

## Mission

Build a production-ready Inventory Management System using:

-   React + TypeScript + Tailwind
-   FastAPI
-   PostgreSQL
-   SQLAlchemy
-   Alembic
-   Docker
-   JWT Authentication

Core modules:

-   Authentication & RBAC
-   Products
-   Categories
-   Suppliers
-   Customers
-   Purchase Orders
-   Sales Orders
-   Inventory Tracking
-   Stock Movements
-   Reports & Analytics
-   Dashboard
-   Notifications
-   AI demand forecasting (future)

------------------------------------------------------------------------

# Primary Agents

## Orchestrator

Coordinates all work, delegates to specialists, tracks milestones,
blockers, and VERIFIED WORKING components. Never performs specialist
implementation unless explicitly requested.

## Project Planner

Owns: - PROJECT.md - ROADMAP.md - FEATURES.md

## Solution Architect

Owns: - ARCHITECTURE.md - API_DESIGN.md - TECH_STACK.md

------------------------------------------------------------------------

# Implementation Agents

## Backend Engineer

Owns: - FastAPI - REST APIs - Authentication - Business logic - Services

Must NOT modify frontend or database schema.

## Frontend Engineer

Owns: - React - TypeScript - Tailwind - API integration - Responsive UI

Must NOT modify backend or database.

## Database Engineer

Owns: - PostgreSQL - SQLAlchemy models - Alembic - Migrations -
Constraints - Indexes - Transactions

Must verify runtime schema before changing migrations.

## DevOps Engineer

Owns: - Docker - Docker Compose - Deployment - CI/CD - Environment
configuration

## Security Engineer

Owns: - JWT review - RBAC - Secret management - Upload validation -
Dependency review

## QA Engineer

Owns: - Unit tests - API tests - Integration tests - End-to-end
verification

Every failure report must include: - Steps to reproduce - Expected
result - Actual result - Logs/evidence

## Documentation Engineer

Maintains: - README - API docs - Deployment docs - Developer guide

## Performance Engineer

Reviews: - SQL performance - API latency - Index usage - Memory usage

## Code Reviewer

Final review before merge.

------------------------------------------------------------------------

# File Ownership

Backend: - backend/\*\*

Frontend: - frontend/\*\*

Database: - backend/app/models/** - backend/app/db/** - alembic/\*\*

Infrastructure: - docker/\*\* - docker-compose.yml

Tests: - tests/\*\*

Documentation: - docs/\*\* - README.md

------------------------------------------------------------------------

# Parallel Rules

Allowed: - Backend + Frontend - Backend + DevOps - Database +
Documentation

Forbidden: - Two agents editing the same file - Backend and Database
changing schema simultaneously - Frontend implementing changing API
contracts

One active writer per shared contract.

------------------------------------------------------------------------

# Debugging Protocol

1.  Reproduce the issue.
2.  Identify last known good boundary.
3.  Identify first failing boundary.
4.  Form a hypothesis.
5.  Gather runtime evidence.
6.  Confirm root cause.
7.  Apply the smallest fix.
8.  Verify.
9.  Run regression tests.

After two failed targeted fixes: Enter DIAGNOSTIC MODE.

------------------------------------------------------------------------

# Inventory Standards

Products: - SKU uniqueness - Barcode support - Stock quantity - Reorder
level

Purchases: - Supplier linkage - Status tracking - Receiving workflow

Sales: - Inventory deduction - Invoice support - Validation

Inventory: - Accurate stock movement history - Audit trail - No negative
stock without explicit policy

------------------------------------------------------------------------

# Definition of Done

A task is complete only when:

-   Scope finished
-   Tests pass
-   Runtime verified
-   Documentation updated if needed
-   No unrelated files changed
-   QA validates critical workflow
