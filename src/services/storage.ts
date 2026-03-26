import type { AgentAction } from '@/types/agent';

// TODO: implement when a database is chosen for the project.
// All functions below are stubs — they are the single "eject point" for storage.
// Swap the internals here without touching any route or UI code.

export async function logAction(_userId: string, _action: AgentAction): Promise<void> {
  // TODO: persist to DB
}

export async function getActionHistory(_userId: string): Promise<AgentAction[]> {
  // TODO: fetch from DB
  return [];
}
