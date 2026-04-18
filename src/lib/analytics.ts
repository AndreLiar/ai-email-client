export function track(eventName: string, payload?: Record<string, any>) {
  console.log('[analytics]', eventName, payload ?? {});

  if (typeof window === 'undefined') return;

  try {
    (window as any).va?.track?.(eventName, payload);
  } catch {
    // Best-effort tracking only.
  }
}
