# ClassPilot architecture / v0.4

ClassPilot is a local-first classroom workspace, delivered as a PWA and a Tauri Windows application. This refactor preserves the existing database, application identifier and storage origins. It does not introduce a server, cloud account, new business features or a replacement database.

## Dependency direction

```text
App (production composition and repository injection)
  └─ app (workbench, UI orchestration, lifecycle and interaction hooks)
       ├─ features (draft sessions, grade tools, PWA lifecycle)
       └─ ClassRepository interface in domain
data (Dexie adapter and migrations) ──→ domain (types and pure rules)
```

- `src/App.tsx` selects the production repository; tests inject an isolated adapter.
- `src/app` coordinates selected class, tool state, forms and pointer events. It does not access Dexie tables.
- `src/features` contains reusable workflows and views; it cannot import `app`, `App.tsx` or the concrete `data` adapter.
- `src/domain` owns immutable seating operations, layout geometry, history, grade/date validation and shared types. No UI, persistence or external package imports are allowed.
- `src/data` implements `ClassRepository` and is responsible for transactions, validation at the persistence boundary and schema migration. It cannot import UI or features.
- `src/styles` splits tokens, shell, classroom, forms, dialogs and responsive rules; source CSS remains readable, not hand-minified.
- `scripts/check-architecture.mjs` rejects reversed dependencies and cycles. `npm run typecheck` checks application and test types in addition to production builds.

## State ownership and async work

`useClassLifecycle` owns each selected class's repository reads and `DraftSession`. Loading a different class hides old students, grades and seats immediately. Late responses from a departed class are ignored. A serialized teardown barrier flushes pending edits before the next class is read; failed sessions are retained for retry rather than discarded.

`DraftSession` owns immutable undo/redo state and debounced persistence. Changes are complete draft snapshots, not partial patches. Writes are ordered; a failure is reported without poisoning later saves. Revision checks prevent a failed old snapshot from overwriting a newer queued snapshot. `dispose()` flushes before releasing listeners.

Pointer movement is a transient preview. Only the completed movement becomes a draft edit; Escape and pointer cancellation discard the preview. Canvas coordinates are independent from viewport zoom and sidebars. Gender is represented by semantic attributes and text labels, not color alone.

## Data invariants

- One student occupies at most one seat, and one seat has at most one student.
- Desk IDs and seat IDs are unique within the draft. Every desk and assigned student belongs to the draft's class.
- A draft ID may not overwrite another class's draft. Archived students cannot be assigned.
- Deleting a desk returns its students to the unassigned pool. Deleting a student transactionally cleans their grades, assignments and classmate constraint references.
- Alignment moves existing desks only: the configured rows × desks-per-row define the central grid; extras occupy balanced side wings. It never creates desks.
- Explicit classroom rebuilding is a separate confirmed operation: it regenerates regular desks while preserving special desks and their assignments.
- Grades share one domain validator for manual writes and CSV preview. Dates must be real ISO calendar dates; scores must be finite and within `0..fullScore`, with a positive full score. Blank CSV scores are errors, not zero.
- CSV duplicate identity remains student + subject + exam date; exam name is not part of this key. Import transactions are all-or-nothing.

## Compatibility and privacy

The persisted database remains `classpilot`, schema version 4. The Tauri identifier remains `com.owanlin.classpilot`, and its versioned entry changes only the URL query, not the storage origin. Legacy regular-desk geometry is normalized without changing student or seat IDs. Native stale-cache cleanup excludes IndexedDB and local storage.

Web and Windows have independent local stores. Complete backup exchange, roster Excel import, public undo/history, AI seating and print/export are not part of this refactor. Tests must never load or publish a teacher's actual records. Build identity files contain only version, commit and platform, never classroom content.

## Release boundary

`npm run acceptance` runs version consistency, architectural rules, type checks, lint, unit/property/build contracts, the production build and browser tests. The offline browser test enables the real service worker; other UI tests block it to avoid validating an old cached bundle.

The single release workflow builds both platforms from one tag, tests the Windows process/window startup in an ephemeral runner, stages checksummed desktop artifacts, deploys Pages and then publishes the matching Release. There is no independent web-only deployment workflow. Manual dispatch performs validation/building without publication. Two hosting services cannot switch atomically; if publishing fails after Pages succeeds, resume the same run rather than issuing a mismatched version.
