//src/app/dashboard/page.tsx
// src/app/dashboard/page.tsx
// src/app/dashboard/page.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import DashboardStats from '@/components/DashboardStats';

export default function DashboardPage() {
  const { isSignedIn, user, isLoaded } = useUser();
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const fetchStatus = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('is_premium')
          .eq('user_id', user.id)
          .maybeSingle(); // ✅ 🔑 pour éviter erreur 406 si aucune ligne

        if (error) {
          console.error('❌ Supabase error:', error.message);
          setIsPremium(false);
        } else {
          setIsPremium(data?.is_premium === true);
        }
        setLoading(false);
      }
    };

    fetchStatus();
  }, [isSignedIn, user]);

  useEffect(() => {
    if (searchParams.get('refresh') === '1') {
      router.replace('/dashboard');
      setTimeout(() => window.location.reload(), 500); // ✅ 500ms suffit
    }
  }, [searchParams, router]);

  if (!isLoaded || loading) {
    return (
      <ProtectedLayout>
        <div className="text-center mt-5">Chargement...</div>
      </ProtectedLayout>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <ProtectedLayout>
        <div className="alert alert-danger">Accès refusé. Connecte-toi.</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <h1 className="text-primary">Bienvenue, {user.firstName} 👋</h1>
      <p className="lead">Email : <strong>{user.emailAddresses[0]?.emailAddress}</strong></p>

      <div className="d-flex align-items-center gap-3 my-4">
        <img src={user.imageUrl} alt="Avatar" width={80} height={80} className="rounded-circle" />
        <div>
          <p className="lead mb-1">
            Statut :{' '}
            <span className={isPremium ? 'text-success fw-bold' : 'text-warning'}>
              {isPremium ? '🌟 Premium' : '🔓 Gratuit'}
            </span>
          </p>
          {!isPremium && (
            <a href="/pricing" className="btn btn-outline-warning btn-sm">
              🚀 Passer Premium
            </a>
          )}
        </div>
      </div>

      <DashboardStats isPremium={isPremium} />

      <button
        className="btn btn-outline-secondary btn-sm mt-3"
        onClick={() => window.location.href = '/dashboard?refresh=1'}
      >
        🔄 Rafraîchir
      </button>
    </ProtectedLayout>
  );
}
