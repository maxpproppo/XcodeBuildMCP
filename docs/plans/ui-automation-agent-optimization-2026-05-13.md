# UI Automation Agent Optimization: Plan

## Goal
Make XcodeBuildMCP's RS/1-style UI automation reliable enough that Claude Code usually completes a UI interaction with one observation and one action: `snapshot_ui`, then `tap` for one target or `batch` for multiple same-screen targets.

This is a refinement pass, not a new architecture. Keep the structured-output envelope intact and keep AXe as the raw execution layer; XcodeBuildMCP should own the RS/1 semantics that make the tools agent-friendly.

## Background
- `snapshot_ui` is the RS/1 entrypoint: it captures AXe `describe-ui`, parses runtime elements/actions, records a per-simulator snapshot, and returns refs plus `screenHash` (`manifests/tools/snapshot_ui.yaml`, `src/mcp/tools/ui-automation/snapshot_ui.ts`, `src/mcp/tools/ui-automation/shared/runtime-snapshot.ts`, `src/mcp/tools/ui-automation/shared/snapshot-ui-state.ts`).
- `tap` resolves `elementRef` and executes via semantic AXe tap/touch translation (`src/mcp/tools/ui-automation/tap.ts`, `src/mcp/tools/ui-automation/shared/semantic-tap.ts`).
- `batch` currently accepts raw AXe step strings and passes them through to AXe (`src/mcp/tools/ui-automation/batch.ts`).
- `wait_for_ui` polls snapshots and records the latest usable runtime snapshot while waiting (`src/mcp/tools/ui-automation/wait_for_ui.ts`).
- Prior art: `04b055210b111c8a2d70bdf5c19ca4c6b0d2a479` added RS/1 runtime automation parity, including batch execution, wait predicates, runtime refs, and screen-hash unchanged responses.

Transcript evidence from validation run:
- Settings toggles were handled as repeated `tap -> snapshot_ui -> tap` loops (`0058` through `0087`) instead of one snapshot plus one batch.
- Batch syntax was guessed and failed (`tap e7`, `tap --element-ref e7`, `tap-target e21`) before the agent fell back to coordinates (`0281` through `0286`, `0312` through `0327`).
- Scroll and sheet expansion produced repeated gesture/swipe/screenshot/snapshot loops (`0110` through `0144`).
- A launch failure caused a duplicate `build_run_sim` instead of a clean recovery (`0005` through `0021`). This is outside the RS/1 implementation but reinforces the need for better next-step guidance.

## Approach
1. First remove success-path snapshot invalidation for `tap` and improve tool guidance; these are low-risk changes at known seams.
2. Then replace raw, model-facing batch strings with structured RS/1 batch steps and update the manifest/schema surface at the same time.
3. Keep AXe ignorant of RS/1 refs; translate refs inside XcodeBuildMCP before crossing the AXe boundary.
4. Validate with repeated Claude Code runs and transcript exports, looking for fewer observation loops and no raw-string batch attempts.

## Work Items

### 1. Adjust snapshot invalidation semantics
Files: `src/mcp/tools/ui-automation/tap.ts`, `src/mcp/tools/ui-automation/batch.ts`, `src/mcp/tools/ui-automation/shared/snapshot-ui-state.ts`.

- Remove only the success-path `clearRuntimeSnapshot` call after `tap` succeeds.
- Keep the existing AXe error-path invalidation predicate unchanged.
- After structured `batch` lands, preserve the snapshot after a fully successful batch.
- Keep TTL expiry, explicit refresh via `snapshot_ui`, and `wait_for_ui` snapshot replacement unchanged.

Decision: do not add a new dirty-cache state or automatic post-action snapshot. That would add complexity and reintroduce the extra calls this work is trying to remove.

### 2. Make `batch` structured and RS/1-aware
Files: `src/mcp/tools/ui-automation/batch.ts`, `src/mcp/tools/ui-automation/shared/runtime-snapshot.ts`, `src/mcp/tools/ui-automation/shared/semantic-tap.ts`, `src/mcp/tools/ui-automation/shared/axe-command.ts`, `manifests/tools/batch.yaml`, and the CLI batch command if one exists.

Replace `steps: string[]` with structured tap steps:

```ts
steps: Array<{ action: 'tap'; elementRef: string; preDelay?: number; postDelay?: number }>
```

Execution contract:
- Validate all steps before executing anything.
- Resolve every `elementRef` before executing anything.
- If any ref is missing, expired, not found, or not actionable, fail before the first AXe step.
- Confirm AXe's accepted batch step grammar before implementation: if AXe accepts coordinate batch steps, translate refs into those; if not, keep one public `batch` tool call but execute the resolved actions internally.
- Prefer activation-point coordinate taps for deterministic same-screen execution where AXe supports them.
- Reuse the existing touch-vs-tap classifier from `semantic-tap.ts` instead of creating a second switch heuristic. If that classifier is not reusable, extract it first.
- Update the manifest/input schema and CLI invocation surface together with the TypeScript schema so MCP and CLI stay in sync.

Do not preserve raw string fallback behavior. `batch` is still pre-release/Unreleased work, and the transcript shows the raw-string surface is actively harmful for agents.

### 3. Improve tool hints and next steps
Files: `manifests/tools/snapshot_ui.yaml`, `manifests/tools/tap.yaml`, `manifests/tools/batch.yaml`, `manifests/tools/wait_for_ui.yaml`, `src/mcp/tools/ui-automation/snapshot_ui.ts`.

Update model-facing guidance:
- `snapshot_ui`: observe once; use `tap` for one target; use `batch` for multiple same-screen targets; refresh after navigation, scrolling, sheet changes, or obvious layout changes.
- `tap`: consumes a ref from the latest `snapshot_ui` or `wait_for_ui`; other same-screen refs may remain usable after success.
- `batch`: accepts structured objects, not AXe command strings. Include a valid JSON example and explicitly avoid examples like `"tap e7"`.
- `wait_for_ui`: preferred post-navigation/post-layout refresh because it both waits and records the latest snapshot.

Add a dynamic `snapshot_ui` next step for batching only when at least two useful tap targets remain after the existing ranking/filtering rules. Keep the rules that deprioritize close/delete/sheet-grabber/already-selected controls.

### 4. Tighten tests around agent-facing behavior
Files: colocated `__tests__` near changed UI automation tools.

Add or update tests for:
- successful `tap` preserves snapshot state;
- `tap` AXe failure still invalidates when appropriate;
- `batch` rejects raw string steps and invalid structured steps;
- `batch` pre-resolves all refs and fails before execution if any ref is invalid;
- successful `batch` preserves snapshot state;
- AXe batch failure invalidates snapshot state;
- `snapshot_ui` emits a batch next step when multiple useful tap targets are present.

### 5. Validate with Claude Code transcripts
Use Claude Code, not Codex, for validation runs. Configure Claude Code to use the local source-built XcodeBuildMCP server, then repeat the Weather-app task from `0001_user_message.md`.

Reference commands and artifacts:
- Existing parser: `parse_claude_conversation.py`
- Example source conversation: `.claude/projects/<project-path>/<session-id>.jsonl`
- Export command example: `python3 parse_claude_conversation.py <claude-jsonl>`

Acceptance signals:
- The settings-toggle sequence is reduced to one `snapshot_ui`, one structured `batch`, and at most one verification call.
- The exported transcript contains no raw-string batch attempts such as `tap e7` or `tap-target e21`.

### 6. Update release notes
File: `CHANGELOG.md` under `## [Unreleased]`.

After validation, add a concise entry covering:
- structured RS/1 element-ref batch steps;
- preserved same-screen refs after successful tap/batch actions;
- improved UI automation tool guidance and next steps.

## Risks
- Preserving refs after a tap lets an agent misuse old refs after navigation. Keep the mitigation in tool guidance rather than adding automatic post-action snapshots.
- Structured `batch` is a breaking contract change. Confirm it has not shipped in a tagged release before removing raw string support; if it has shipped, add a short deprecation path instead of a hard cutover.
- AXe batch grammar may not support the exact coordinate steps XcodeBuildMCP wants to emit. Confirm the grammar before changing the public `batch` schema.

## Validation Results

Validation artifacts were written under `out.nosync/validation-ui-automation-20260513-215522` with timestamped names. Prior Claude transcripts/exports were not deleted or overwritten.

### Automated checks

All checks below were run with `XCODEBUILDMCP_AXE_SOURCE_PATH` pointing to the AXe source build:

- Focused UI automation/config/factory tests: `npx vitest run src/mcp/tools/ui-automation/__tests__/batch.test.ts src/mcp/tools/ui-automation/__tests__/runtime-snapshot.test.ts src/mcp/tools/ui-automation/__tests__/snapshot_ui.test.ts src/mcp/tools/ui-automation/__tests__/tap.test.ts src/mcp/tools/ui-automation/__tests__/wait_for_ui.test.ts src/utils/__tests__/axe-helpers.test.ts src/utils/__tests__/config-store.test.ts src/utils/__tests__/project-config.test.ts src/utils/__tests__/session-aware-tool-factory.test.ts src/utils/responses/__tests__/next-steps-renderer.test.ts` passed: 10 files, 192 tests (`focused-vitest-20260513-215522.log`).
- `npm run lint` passed (`lint-20260513-215539.log`).
- `npm run format:check` passed (`format-check-20260513-215539.log`).
- `npm run typecheck` passed (`typecheck-20260513-215539.log`).
- `npm run build` passed (`build-20260513-215553.log`).
- `npm run test` passed: 186 files, 2049 tests (`test-20260513-215553.log`).
- Post-review fixes were applied for switch batch delay handling and selector-scoped `gone` text waits. Final checks after those fixes passed: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, and `npm run test` (186 files, 2052 tests).

### AXe source-build proof

`axe-source-resolution-20260513-215621.log` shows:

```json
{
  "resolved": {
    "path": "<axe-source-path>/.build/release/axe",
    "source": "source"
  },
  "bundledEnvironment": {}
}
```

The resolved binary reported version `staging-main-31-510d4df-dirty`, proving the validation used a local AXe source build rather than bundled or PATH fallback.

### Claude Code E2E

Claude Code ran the full original 18-step Weather/Safari task against the local source-built XcodeBuildMCP server:

- MCP config: `claude-mcp-config-20260513-215817.json`
- Prompt: `claude-weather-safari-prompt-20260513-215817.md`
- Raw stream JSONL: `claude-stream-94c0a294-37b0-453f-9ac6-774095a4ace0-20260513-215817.jsonl`
- Copied Claude session JSONL: `claude-session-94c0a294-37b0-453f-9ac6-774095a4ace0-20260513-215817.jsonl`
- Parsed transcript directory: `claude-session-94c0a294-37b0-453f-9ac6-774095a4ace0-20260513-215817-parsed`
- Churn analysis: `churn-analysis-94c0a294-37b0-453f-9ac6-774095a4ace0-20260513-221455.md`
- Exit status: 0 (`claude-run-metadata-94c0a294-37b0-453f-9ac6-774095a4ace0-20260513-215817.txt`)

The MCP config used:

```json
{
  "command": "node",
  "args": ["<xcodebuildmcp-path>/build/cli.js", "mcp"],
  "env": {
    "XCODEBUILDMCP_AXE_SOURCE_PATH": "<axe-source-path>",
    "XCODEBUILDMCP_SENTRY_DISABLED": "1"
  }
}
```

The first Claude invocation (`3790365b-21d5-45ff-a11c-d6d20cb16da8`) failed before running the task because Claude Code requires `--verbose` with `--output-format stream-json`; its raw stream and metadata were preserved. The second invocation (`94c0a294-37b0-453f-9ac6-774095a4ace0`) completed all 18 steps.

### Churn analysis

From `churn-analysis-94c0a294-37b0-453f-9ac6-774095a4ace0-20260513-221455.md`:

- XcodeBuildMCP tool counts: `snapshot_ui` 21, `tap` 16, `batch` 1, `wait_for_ui` 23, `screenshot` 19, `swipe` 15, `gesture` 2, `type_text` 6, `key_press` 5, `build_run_sim` 2, `launch_app_sim` 1, `stop_app_sim` 1, `button` 1, `session_show_defaults` 1.
- Structured batch use: exactly one `batch` call, call #33 at `2026-05-13T21:01:15.625Z`, with 7 structured tap steps (`{ action: "tap", elementRef, postDelay }`) and result `SUCCEEDED`.
- Raw-string batch attempts: 0.
- Settings toggles: reduced from the prior repeated tap/snapshot loop to the single structured batch plus one verification snapshot. The settings window still included setup observations/screenshots before the batch, but the toggle inversion itself used one batch.
- Remaining tool-result churn: `WAIT_TIMEOUT` 3, `SNAPSHOT_MISSING` 4, `MISSING_REQUIRED_PARAMETERS` 2, `PARAMETER_VALIDATION_FAILED` 1, `SNAPSHOT_EXPIRED` 1, `TARGET_NOT_ACTIONABLE` 1.
- Remaining unavoidable or non-RS/1 churn:
  - Initial Weather launch used no mock service, so `Loading weather` timed out once; the run recovered with `build_run_sim` and `launchArgs: ["--mock-weather-api"]`.
  - `stop_app_sim` and `launch_app_sim` were attempted without `bundleId` defaults while recovering from that launch setup issue.
  - Element-bound swipes after gestures produced stale/missing snapshot recoveries; `snapshot_ui` refreshes recovered.
  - The Settings sheet close wait used `gone` for text `Settings`, but the main screen has a Settings button, so it timed out even though the sheet was closed.
  - The Location sheet/list required `swipe-from-bottom-edge`; several element-bound swipes were absorbed by the medium detent or used stale refs.
  - Safari WebView contents, cookie/sign-in UI, and BBC in-page links were not exposed as tappable RS/1 targets, so Claude used the URL bar for Sport, Premier League, tables, and Brighton. This reached the equivalent end state but was not a real row/link click.

## References
- Validation artifact folder: `out.nosync/validation-ui-automation-20260513-215522`
- Prior RS/1 commit: `04b055210b111c8a2d70bdf5c19ca4c6b0d2a479`
