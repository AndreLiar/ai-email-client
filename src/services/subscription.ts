import {
  isUserSubscribed as storageIsUserSubscribed,
  markUserSubscribed as storageMarkUserSubscribed,
} from '@/services/storage';

export async function isUserSubscribed(userId: string): Promise<boolean> {
  return storageIsUserSubscribed(userId);
}

export async function markUserSubscribed(userId: string): Promise<void> {
  await storageMarkUserSubscribed(userId);
}
