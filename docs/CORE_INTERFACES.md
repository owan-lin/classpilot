# Core UI and domain contracts

This round keeps the visual shell stable while exposing small, testable contracts for the classroom workspace.

## Classroom layout

- \`regularDeskSpec\` is the canonical regular desk size and default capacity.
- \`specialDeskSpec\` is used for special seats and is never rebuilt with regular desks.
- \`constrainFreeDeskPosition\` permits overlap and the podium area while preserving a 32px grab strip.
- \`snapDeskPosition\` and \`isDeskPositionValid\` implement aligned mode (grid snap, canvas bounds, collision checks).
- \`rebuildRegularLayout\` replaces only regular desks; special desks and assignments on their seats survive. Assignments on removed regular seats intentionally return to the unassigned pool.
- Drag previews are transient in \`App\`; only pointer-up calls the repository-backed \`DraftSession\`. Pointer-cancel/Escape discard the preview.

## Repository

\`ClassRepository\` is the UI boundary. Implementations must keep \`ClassRecord\` parameters (\`plannedStudentCount\`, \`rows\`, \`desksPerRow\`, \`deskCapacity\`) and expose grade CRUD/import methods. Grade writes validate \`0 <= score <= fullScore\` and \`fullScore > 0\`; \`importGrades\` validates the complete preview before its transaction starts.

## Grades

\`GradeRecord\` uses ISO \`examDate\` and stores raw score/full score. \`gradeTrend\` sorts by date and returns a comparable percentage (\`score / fullScore * 100\`). \`previewGradeCsv\` is side-effect free and reports every invalid row; callers must not call \`importGrades\` until the preview is error-free.

All examples and tests use synthetic local data only.
