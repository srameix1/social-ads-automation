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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Cliente</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Negocio</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Perfil</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Trial (posts usados/límite)</th>
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
