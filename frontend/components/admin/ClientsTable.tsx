'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { admin as adminApi } from '@/lib/api';
import type { AdminClientRow } from '@/lib/types';

interface Props {
  clients:         AdminClientRow[];
  onClientUpdated: (client: AdminClientRow) => void;
}

export function ClientsTable({ clients, onClientUpdated }: Props) {
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [limitInput,     setLimitInput]     = useState('');
  const [savingLimit,    setSavingLimit]    = useState(false);

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput,     setNotesInput]     = useState('');
  const [savingNotes,    setSavingNotes]    = useState(false);

  const [editingCourtesyId, setEditingCourtesyId] = useState<string | null>(null);
  const [courtesyOn,        setCourtesyOn]        = useState(false);
  const [courtesyPlan,      setCourtesyPlan]      = useState<AdminClientRow['plan']>('basic');
  const [courtesyDate,      setCourtesyDate]      = useState('');
  const [savingCourtesy,    setSavingCourtesy]    = useState(false);
  const [courtesyError,     setCourtesyError]     = useState<string | null>(null);

  const adjustLimit = async (c: AdminClientRow, delta: number) => {
    const next = Math.max(0, c.trial_posts_limit + delta);
    setSavingLimit(true);
    try {
      await adminApi.updateClient(c.id, { trial_posts_limit: next });
      onClientUpdated({ ...c, trial_posts_limit: next });
    } finally {
      setSavingLimit(false);
    }
  };

  const saveLimitInput = async (c: AdminClientRow) => {
    const val = parseInt(limitInput, 10);
    if (isNaN(val) || val < 0) { setEditingLimitId(null); return; }
    setSavingLimit(true);
    try {
      await adminApi.updateClient(c.id, { trial_posts_limit: val });
      onClientUpdated({ ...c, trial_posts_limit: val });
      setEditingLimitId(null);
    } finally {
      setSavingLimit(false);
    }
  };

  const saveNotes = async (c: AdminClientRow) => {
    setSavingNotes(true);
    try {
      await adminApi.updateClient(c.id, { admin_notes: notesInput });
      onClientUpdated({ ...c, admin_notes: notesInput });
      setEditingNotesId(null);
    } finally {
      setSavingNotes(false);
    }
  };

  const openCourtesyEditor = (c: AdminClientRow) => {
    setEditingCourtesyId(c.id);
    setCourtesyOn(c.is_courtesy);
    setCourtesyPlan(c.courtesy_plan ?? 'basic');
    setCourtesyDate(c.courtesy_expires_at ? c.courtesy_expires_at.slice(0, 10) : '');
    setCourtesyError(null);
  };

  const saveCourtesy = async (c: AdminClientRow) => {
    setCourtesyError(null);
    if (courtesyOn && !courtesyDate) {
      setCourtesyError('La fecha de expiración es requerida');
      return;
    }
    setSavingCourtesy(true);
    try {
      const expiresAt = courtesyDate ? new Date(`${courtesyDate}T23:59:59`).toISOString() : null;
      await adminApi.updateCourtesy(c.id, {
        is_courtesy:         courtesyOn,
        courtesy_plan:       courtesyOn ? courtesyPlan : null,
        courtesy_expires_at: courtesyOn ? expiresAt : null,
      });
      onClientUpdated({
        ...c,
        is_courtesy:         courtesyOn,
        courtesy_plan:       courtesyOn ? courtesyPlan : null,
        courtesy_expires_at: courtesyOn ? expiresAt : null,
      });
      setEditingCourtesyId(null);
    } catch (e) {
      setCourtesyError((e as Error).message);
    } finally {
      setSavingCourtesy(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Negocio</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Perfil</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Trial (posts usados/límite)</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Cortesía</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Notas admin</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Campañas</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Registro</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map(c => {
            const isEditingLimit = editingLimitId === c.id;
            const isEditingNotes = editingNotesId === c.id;

            return (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors align-top">
                <td className="py-3 px-4 font-medium text-gray-900">{c.email}</td>
                <td className="py-3 px-4 text-gray-600">{c.business_name || '—'}</td>
                <td className="py-3 px-4">
                  <Badge variant={c.setup_completed ? 'green' : 'yellow'}>
                    {c.setup_completed ? 'Completo' : 'Pendiente'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  {c.is_trial ? (
                    <div className="flex items-center gap-1.5">
                      {isEditingLimit ? (
                        <>
                          <span className="text-gray-600">{c.posts_used}/</span>
                          <input
                            type="number"
                            min={0}
                            value={limitInput}
                            onChange={e => setLimitInput(e.target.value)}
                            className="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-xs"
                          />
                          <button
                            onClick={() => saveLimitInput(c)}
                            disabled={savingLimit}
                            className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingLimitId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <Badge variant={c.posts_used >= c.trial_posts_limit ? 'red' : 'blue'}>
                            {c.posts_used}/{c.trial_posts_limit}
                          </Badge>
                          <button
                            onClick={() => adjustLimit(c, -1)}
                            disabled={savingLimit}
                            className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                            title="Bajar límite en 1"
                          >
                            −
                          </button>
                          <button
                            onClick={() => adjustLimit(c, 1)}
                            disabled={savingLimit}
                            className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                            title="Subir límite en 1"
                          >
                            +
                          </button>
                          <button
                            onClick={() => { setEditingLimitId(c.id); setLimitInput(String(c.trial_posts_limit)); }}
                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                          >
                            editar
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">Plan pago</span>
                  )}
                </td>
                <td className="py-3 px-4 min-w-[190px]">
                  {editingCourtesyId === c.id ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={courtesyOn}
                          onChange={e => setCourtesyOn(e.target.checked)}
                        />
                        Cortesía activa
                      </label>
                      <select
                        value={courtesyPlan}
                        disabled={!courtesyOn}
                        onChange={e => setCourtesyPlan(e.target.value as AdminClientRow['plan'])}
                        className="border border-gray-300 rounded px-1.5 py-1 text-xs disabled:opacity-50"
                      >
                        <option value="basic">Basic</option>
                        <option value="professional">Professional</option>
                        <option value="premium">Premium</option>
                      </select>
                      <input
                        type="date"
                        value={courtesyDate}
                        disabled={!courtesyOn}
                        onChange={e => setCourtesyDate(e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-1 text-xs disabled:opacity-50"
                      />
                      {courtesyError && <p className="text-xs text-red-500">{courtesyError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveCourtesy(c)}
                          disabled={savingCourtesy}
                          className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingCourtesyId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openCourtesyEditor(c)} className="text-left">
                      {c.is_courtesy ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="green">{c.courtesy_plan}</Badge>
                          {c.courtesy_expires_at && (
                            <span className="text-xs text-gray-500">
                              hasta {new Date(c.courtesy_expires_at).toLocaleDateString('es-MX')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 underline decoration-dotted">Sin cortesía</span>
                      )}
                    </button>
                  )}
                </td>
                <td className="py-3 px-4 max-w-[220px]">
                  {isEditingNotes ? (
                    <div className="flex items-start gap-1.5">
                      <textarea
                        value={notesInput}
                        onChange={e => setNotesInput(e.target.value)}
                        rows={2}
                        className="w-40 border border-gray-300 rounded px-1.5 py-1 text-xs"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => saveNotes(c)}
                          disabled={savingNotes}
                          className="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingNotesId(c.id); setNotesInput(c.admin_notes ?? ''); }}
                      className="text-left text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted"
                    >
                      {c.admin_notes ? c.admin_notes : 'Agregar nota...'}
                    </button>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-600">{c.campaign_count ?? 0}</td>
                <td className="py-3 px-4 text-gray-400 text-xs">
                  <div>{new Date(c.created_at).toLocaleDateString('es-MX')}</div>
                  {c.duplicate_ip && (
                    <div className="mt-1">
                      <Badge variant="red">IP duplicada</Badge>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Link href={`/admin/clients/${c.id}`}
                    className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                    Ver →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
