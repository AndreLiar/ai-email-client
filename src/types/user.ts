export type SubscriptionStatus = 'free' | 'pro';

export interface UserProfile {
  id: string;
  email: string;
  plan: SubscriptionStatus;
}
