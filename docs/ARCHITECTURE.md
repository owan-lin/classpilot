# ClassPilot architecture contract

ClassPilot is an offline-first React application distributed as both a PWA and a Tauri Windows app. Both targets share the same TypeScript domain model and IndexedDB persistence layer.

## Stable boundaries

- `src/domain`: side-effect-free types and seating operations.
- `src/data`: Dexie persistence and schema migrations for classes, students and seating drafts.
- `src/features`: workflows that combine domain operations and repositories.
- `src/ui`: reusable presentational components and design primitives.
- `tests`: browser-level workflows and cross-target acceptance tests.

The UI depends on `ClassRepository`; it must not call Dexie directly. Every persisted record uses a stable UUID plus ISO timestamps. Student and seat assignments are one-to-one. Draft edits are persisted automatically and support in-session undo/redo.

## Privacy contract

No production path sends classroom records over the network. GitHub Pages serves only the application shell. Classroom records stay in the local browser or desktop app storage.

## Task ownership

The programmer owns domain/data/features and desktop/PWA mechanics. The designer owns visual specifications and presentational surfaces. QA owns test code and fixtures. The main controller owns integration, shared configuration, GitHub workflows, deployment, and releases.
