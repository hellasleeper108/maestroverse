# Repository Guidelines

## Project Structure & Module Organization

- `apps/web` is the unified Next.js frontend (exposes Hub, CareerLink, and CollabSpace). Legacy standalone apps still exist under `apps/hub`, `apps/careerlink`, and `apps/collabspace` for reference but are not part of the active stack.
- `server/src` contains the Express API; use `routes/` for domain endpoints, `middleware/` for auth/validation, and `websocket/` for Socket.IO handlers.
- Shared logic resides in `shared/utils` (HTTP client, helpers) to keep duplicative code out of each app.
- Database artifacts live in `server/prisma/` with migrations driven by `schema.prisma`; temporary data during local runs lives in `db/`.
- `docs/` holds architecture/setup references—update alongside structural changes. `uploads/` is runtime storage and stays out of version control.

## Build, Test, and Development Commands

- `npm install` bootstraps every workspace in the monorepo.
- `npm run dev` starts the Dockerised stack (web app on port 3005 + API on 3001).
- `npm run docker:logs` / `npm run docker:stop` tail and stop the running containers.
- `npm run dev --workspace=server` / `npm run dev --workspace=apps/web` start the API or unified frontend locally without Docker.
- `npm run build` builds the unified web image via Docker Compose.
- `npm run lint` and `npm run format` enforce ESLint + Prettier baselines.
- `npm run db:migrate` / `npm run db:seed` run Prisma migrations and seeds inside the server container.
- `docker-compose up -d web` provisions PostgreSQL, Redis, the API, and the unified web frontend; follow with `npm run db:migrate` after schema edits.
- `bash test-verification.sh` validates expected files/configs and should be green prior to PR submission.

## Coding Style & Naming Conventions

- Prettier governs formatting (2-space indent, 100-char line width, semicolons, single quotes, LF endings).
- ESLint (`@typescript-eslint`, React) flags risky patterns; resolve warnings before merging.
- React components use PascalCase (`Navbar.jsx`), hooks start with `use`, and utility modules are camelCase.
- Keep Express route files lowercase by domain (e.g., `careerlink.js`) and export pure handler factories.
- Prefer ES modules with async/await; avoid `any` and document exceptions when unavoidable.

## Testing Guidelines

- Co-locate unit/integration tests as `*.test.ts(x)` or `*.test.jsx`; group fixtures under `__fixtures__`.
- Backend tests should pair Jest with Supertest (or similar) against a disposable Prisma database.
- Frontend tests should rely on React Testing Library and Next.js testing utilities for page behavior.
- Always run `bash test-verification.sh`; extend it when new critical paths need regression coverage.
- Document manual QA flows in PRs until automated suites cover the scenario.

## Commit & Pull Request Guidelines

- No git history ships with this archive; follow Conventional Commits (`feat:`, `fix:`, `chore:`) and add scopes when useful (`feat(hub): enable RSVP`).
- Make commits small, lint-clean, and include migration identifiers or seed references in the body when relevant.
- PRs must supply a purpose summary, linked issue/ticket, screenshots or curl samples for UI/API changes, test commands executed, and rollout considerations.
- Request reviewers from owning areas (`frontend`, `backend`, `shared`) and sync documentation (`docs/`, `.env.example`) when introducing new configuration.

## Configuration & Security Tips

- Duplicate `.env.example` for each environment; never commit populated secrets.
- Update `CORS_ORIGINS`, port settings, and `JWT_SECRET` when deploying beyond localhost.
- Maintain `ROOT_ADMIN_EMAILS` so trusted moderators automatically receive admin privileges on login.
- Treat `uploads/` as local-only; direct production assets to managed storage and document the integration.
