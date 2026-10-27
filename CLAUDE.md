# CampusHub Backend — Claude Code Instructions

## Project purpose

CampusHub is a multi-tenant campus resource management backend. Preserve tenant boundaries in all future data access and business logic. The backend service lives at the repository root under `src/`. A separate React/TypeScript client may live in `client/`; it is a distinct application with its own `package.json`, build tooling, and dependency set, and the rules in this file about the backend (authorized technology, architecture layers, TypeScript rules, API conventions) apply to `src/`, not to `client/`. See "Frontend guidelines" below for the rules that apply inside `client/`.

## Authorized technology

- Use Node.js, TypeScript, Express, and Mongoose.
- Write application source code in `.ts` files only. Do not create `.js` application source files.
- Do not add a runtime or development dependency unless the user explicitly approves it.
- Prefer Node.js built-in APIs and the packages already declared in `package.json`.
- Do not replace Express, Mongoose, npm, TypeScript, ESLint, or Prettier with alternatives.

## Required architecture

Keep application responsibilities separated into these layers:

- `src/routes`: Express route declarations and middleware mapping only. Route files must delegate to named controller functions; do not use inline business logic or query the database here.
- `src/controllers`: HTTP boundary code only. Parse typed request data, invoke services, select HTTP status codes, and return responses. Never import or query a Mongoose model directly.
- `src/services`: Framework-independent business logic and data-access orchestration. Services may call models but must not depend on Express request or response objects.
- `src/models`: Mongoose schemas, models, and corresponding TypeScript interfaces only. Do not put HTTP handling or business workflows here.

Preserve the dependency direction:

`routes -> controllers -> services -> models`

Do not bypass a layer. Shared middleware, configuration, or utility modules may be added in clearly named directories when needed, but must not absorb route, controller, service, or model responsibilities.

## TypeScript rules

- Keep `strict` mode enabled.
- Define explicit interfaces or type aliases for function parameters, return values, request bodies, response bodies, and database documents.
- Give exported functions explicit return types.
- Never use `any`, including implicit `any`. For untrusted values, use `unknown` and narrow it safely.
- Avoid unsafe type assertions. Validate external input before treating it as a domain type.
- Do not suppress compiler or lint errors with `@ts-ignore`, disabling rules, or broad casts. Correct the underlying issue.

## Async and error safety

- Await every promise or intentionally return it to a caller that handles it.
- Do not create floating or unhandled promises.
- Wrap asynchronous controller work so failures reach centralized Express error-handling middleware.
- Services must throw or return typed errors; they must not send HTTP responses.
- Do not expose stack traces, credentials, connection strings, or internal error details in API responses.
- Read secrets and environment-specific values from environment variables. Never commit `.env` or hard-code credentials.

## API conventions

- Place versioned endpoints under `/api/v1`.
- Return JSON with a consistent, typed response shape.
- Use HTTP status codes appropriate to the outcome.
- Keep route handlers thin and deterministic.
- For multi-tenant resources, require an explicit tenant identifier and include it in every relevant query. Never permit cross-tenant reads or writes.

## Frontend guidelines (`client/`)

- Stack: React with TypeScript, scaffolded via Vite (`npm create vite@latest client -- --template react-ts`). Keep `strict` mode enabled in `client/tsconfig.json`.
- Component architecture: functional components only. Give every component an explicit, exported TypeScript prop interface — no inline or implicit prop types.
- State management: use standard React hooks (`useState`, `useEffect`, etc.) or custom hooks extracted into their own files. Do not call APIs inline inside JSX or component bodies directly; route all HTTP calls through the typed API service layer (e.g. `src/api/`).
- API layer: keep a single typed API service module (or a small set of them) that wraps axios or `fetch`, exposes typed functions per backend endpoint, and is the only place that knows request/response shapes. Derive those shapes from `docs/openapi.yaml` rather than guessing field names.
- Styling: keep styling modular and consistent — CSS Modules or a single utility-CSS approach, not a mix of ad hoc inline styles, global CSS, and component styles.
- Do not add a runtime or development dependency to `client/` unless the user explicitly approves it.
- Do not commit `client/node_modules/`, `client/dist/`, or other generated output.

## Repository hygiene

- Do not edit generated output in `dist/` or installed packages in `node_modules/`.
- Keep `.env`, `node_modules/`, `dist/`, logs, and coverage output untracked.
- Format source and configuration files with Prettier.
- Make the smallest change needed for the requested behavior; do not perform unrelated refactors.

## Required validation

After changing TypeScript or project configuration, run:

1. `npm run format:check`
2. `npm run typecheck`
3. `npm run build`

Run relevant endpoint or automated tests when they exist. Report any check that could not be run and explain why.

## Git and change summaries

- Use concise, imperative commit subjects, for example: `Add typed health-check endpoint`.
- Never commit secrets, generated output, or dependency directories.
- At the end of a task, provide a concise PR/diff summary containing:
  - what was built or changed;
  - why the change was needed;
  - how the architecture and safety rules in this file were applied;
  - which validation commands were run and whether they passed.

## Claude Code working behavior

- Read this file and the relevant existing code before editing.
- Preserve user-authored changes and do not overwrite unrelated work.
- If a request conflicts with these rules, point out the conflict and ask for direction instead of silently violating a boundary.
- When requirements are ambiguous, choose the interpretation that preserves strict typing, layer separation, tenant isolation, and minimal scope.
