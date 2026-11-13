# Memory Stability — Phase 2

This release builds on Phase 1's process-wide resource scheduler.

## Bounded ESPN processing

- Live NFL scoring fetches at most two game summaries concurrently instead of fetching every active game simultaneously.
- NFL player-directory historical scans fetch at most two completed-game summaries concurrently.
- Player history requests load weekly schedules and completed game summaries at concurrency two, preserving input order and existing missing-data behavior.
- Postseason weekly checks also use the same bounded helper.
- The ESPN weekly projection cache retains at most two week entries and removes expired entries, avoiding growth across scoring periods.

## Unchanged

No database migration, scoring formula changes, transaction-rule changes, or league-state resets. Week 9 history, Week 10 injury rules, and Trade Central are preserved.

## Validation

`node test-bounded-work.js` validates concurrency, ordering, empty input, and failure propagation. Run all `test-*.js` scripts and monitor `[resource-job]` and `[memory-health]` in Render.

## Limits

This reduces peak parallel allocations but does not prove the application will remain below 512 MB under all production conditions. An individual ESPN response or database operation may still be expensive. Monitor Render memory and OOM events after deployment.
