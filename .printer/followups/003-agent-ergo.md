# Follow-ups for /home/sarocu/Projects/tinybook/specs/003-agent-ergo.md

Generated: 2026-05-01T22:55:59.723315242+00:00
Verdict: PASS

## Suggested follow-ups

- Split the unrelated 001/002 changes out of this branch before merging, or update the spec to acknowledge them.
- Add a tiny test (e.g. `bun test`) that hits `/api/docs/:slug` PUT with a reader session and asserts 403, to lock in the read-only guarantee.
- Consider exposing actual token counts (from the provider response) instead of the char/4 estimate once the chat call returns usage.
