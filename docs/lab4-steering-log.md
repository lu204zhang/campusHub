# Lab 4 — AI Agent Steering Log

### Incident 1: Incorrect Overlap Query Logic

- **Initial Agent Output:** When adding the `isAvailable` filter to `GET /api/v1/resources`, the agent called the service with `{ type, isAvailable }` even though both could be `undefined`. `npm run typecheck` failed with a `TS2379` error because this repo has `exactOptionalPropertyTypes` turned on, so you can't pass `undefined` for an optional field — you have to leave the key out entirely.
- **Root Cause:** The agent assumed "optional property" meant "can be undefined," which isn't true here because of that compiler flag. It didn't check `tsconfig.json` before writing the filter object.
- **Remediation Prompt:** Didn't need to step in manually — CLAUDE.md already requires running `npm run typecheck` after any TS change and fixing the real issue instead of suppressing it. That's what made the agent go back, read the error, and rebuild the filter object so each key is only added when its value isn't undefined.
- **Resolution:** Reran format/typecheck/build and all passed. Hit the endpoint with `?type=ROOM` and `?isAvailable=true` against local Mongo and got back the correctly filtered results.
