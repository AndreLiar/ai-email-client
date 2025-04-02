//src/components/DashboardStats.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type StatsData = {
  total: number;
  averageWords: number;
  monthly: { month: string; count: number }[];
};

interface DashboardStatsProps {
  isPremium: boolean;
}

export default function DashboardStats({ isPremium }: DashboardStatsProps) {
  const { userId } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!userId) {
          setError(true);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/stats?userId=${userId}`);
        if (!res.ok) {
          throw new Error('Erreur lors de la récupération des statistiques');
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('❌ Erreur API Stats :', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (loading) return <p>⏳ Chargement des statistiques...</p>;
  if (error || !stats) return <p>❌ Impossible de charger les données.</p>;

  return (
    <div className="mt-4">
      <h3 className="mb-3">📈 Statistiques IA</h3>

      {/* Section des statistiques principales */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="border rounded p-3 bg-light">
            <h5>🧠 Total de réponses IA</h5>
            <p className="fs-3 fw-bold text-success">{stats.total}</p>
          </div>
        </div>
        <div className="col-md-6">
          <div className="border rounded p-3 bg-light">
            <h5>📝 Moyenne de mots / réponse</h5>
            <p className="fs-3 fw-bold text-primary">{stats.averageWords}</p>
          </div>
        </div>
      </div>

      {/* Graphique des réponses mensuelles */}
      <div className="border rounded p-3 bg-white">
        <h5 className="mb-3">📊 Réponses IA par mois</h5>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#007bff" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}