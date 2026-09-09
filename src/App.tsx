import { classRepository } from "./data/repository";
import AppWorkbench from "./app/AppWorkbench";
import type { ClassRepository } from "./domain/types";
import { AppErrorBoundary } from "./app/components/AppErrorBoundary";

/** Composition root: production injects Dexie while tests may provide a repository. */
function App({ repository = classRepository }: { repository?: ClassRepository }) {
  return <AppErrorBoundary><AppWorkbench repository={repository} /></AppErrorBoundary>;
}

export default App;
