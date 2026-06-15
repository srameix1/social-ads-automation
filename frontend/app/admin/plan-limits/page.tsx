'use client';

import { useState, useEffect } from 'react';
import { admin as adminApi } from '@/lib/api';
import { PageLoader } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { PlanLimits } from '@/lib/types';

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  basic:        { label: 'Básico ($97)',        color: 'text-slate-300' },
  professional: { label: 'Profesional ($197)',  color: 'text-brand-400' },
  premium:      { label: 'Premium ($397)',       color: 'text-violet-400' },
};

export default function PlanLimitsPage() {
  const [limits,  setLimits]  = useState<PlanLimits[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft,   setDraft]   = useState<Partial<PlanLimits>>({});
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    adminApi.getPlanLimits()
      .then(d => setLimits(d.planLimits))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (limit: PlanLimits) => {
    setEditing(limit.plan);
    setDraft({
      max_posts_per_campaign: limit.max_posts_per_campaign,
      can_upload_photos:      limit.can_upload_photos,
      can_generate_video:     limit.can_generate_video,
      can_generate_reel:      limit.can_generate_reel,
    });
    setError('');
  };

  const cancelEdit = () => { setEditing(null); setDraft({}); };

  const save = async (plan: string) => {
    setSaving(true);
    setError('');
    try {
      const { planLimit } = await adminApi.updatePlanLimit(plan, draft);
      setLimits(prev => prev.map(l => l.plan === plan ? planLimit : l));
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Límites de planes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Configura las capacidades de cada plan de suscripción.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-400">
          {error}
        </div>
      )}

      <div className="surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Posts/mes</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fotos</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Video</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reels</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {limits.map(limit => {
              const isEditing = editing === limit.plan;
              const meta      = PLAN_LABELS[limit.plan] ?? { label: limit.plan, color: 'text-slate-300' };

              return (
                <tr key={limit.plan}>
                  <td className={`px-6 py-4 font-medium ${meta.color}`}>{meta.label}</td>

                  <td className="px-4 py-4 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={draft.max_posts_per_campaign ?? limit.max_posts_per_campaign}
                        onChange={e => setDraft(d => ({ ...d, max_posts_per_campaign: parseInt(e.target.value) || 1 }))}
                        className="w-16 text-center bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-brand-500/60"
                      />
                    ) : (
                      <span className="text-slate-300">{limit.max_posts_per_campaign}</span>
                    )}
                  </td>

                  {(['can_upload_photos', 'can_generate_video', 'can_generate_reel'] as const).map(field => (
                    <td key={field} className="px-4 py-4 text-center">
                      {isEditing ? (
                        <button
                          onClick={() => setDraft(d => ({ ...d, [field]: !d[field] }))}
                          className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 inline-flex items-center ${
                            draft[field] ? 'bg-brand-500' : 'bg-white/[0.1]'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
                            draft[field] ? 'translate-x-3' : 'translate-x-0'
                          }`} />
                        </button>
                      ) : (
                        <span className={limit[field] ? 'text-emerald-400' : 'text-slate-700'}>
                          {limit[field] ? '✓' : '—'}
                        </span>
                      )}
                    </td>
                  ))}

                  <td className="px-4 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" loading={saving} onClick={() => save(limit.plan)}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(limit)}>
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600">
        Los cambios en posts/mes no afectan campañas ya creadas (cada campaña tiene su propio límite).
        Para modificar el límite de una campaña específica, ve al detalle del cliente.
      </p>
    </div>
  );
}
