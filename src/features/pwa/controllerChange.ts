export function shouldReloadForControllerChange(
  initialController: ServiceWorker | null,
  hasReloaded: boolean,
) {
  return initialController !== null && !hasReloaded
}
