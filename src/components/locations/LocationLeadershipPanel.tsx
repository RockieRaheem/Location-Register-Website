import React, { useEffect, useState } from 'react';
import { Clock3, Mail, Pencil, Phone, ShieldCheck, UserRound, X } from 'lucide-react';
import { Theme } from '../../types';
import { getCurrentApiSession } from '../../services/userAdministrationService';
import {
  getLocationLeadership, getLocationLeadershipHistory, resolveLocationPath, saveLocationLeader,
  type LeadershipAudit, type LocationLeader, type ResolvedLocation,
} from '../../services/locationLeadershipService';

interface Props { countryCode: string; path: string[]; label: string; theme: Theme; onClose: () => void; }
const blank = { fullName: '', title: '', email: '', phone: '', organization: '', biography: '', termStartedOn: '' };

const LocationLeadershipPanel: React.FC<Props> = ({ countryCode, path, label, theme, onClose }) => {
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [leader, setLeader] = useState<LocationLeader | null>(null);
  const [audit, setAudit] = useState<LeadershipAudit[]>([]);
  const [form, setForm] = useState(blank);
  const [editable, setEditable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dark = theme === 'dark';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resolved = await resolveLocationPath(countryCode, path);
        const [leadership, session] = await Promise.all([
          getLocationLeadership(resolved.referenceCode), getCurrentApiSession(),
        ]);
        const history = await getLocationLeadershipHistory(resolved.referenceCode).catch(() => ({ assignments: [], audit: [] }));
        if (!active) return;
        setLocation(resolved); setLeader(leadership.leader); setAudit(history.audit);
        setEditable(['admin', 'country_admin', 'contributor'].includes(session.role));
        if (leadership.leader) setForm({ ...blank, ...leadership.leader });
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'Unable to load leadership.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [countryCode, path.join('|')]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!location) return;
    setSaving(true); setError('');
    try {
      const result = await saveLocationLeader(location.referenceCode, { ...form, replaceCurrent: Boolean(leader && leader.fullName.trim().toLowerCase() !== form.fullName.trim().toLowerCase()) });
      const history = await getLocationLeadershipHistory(location.referenceCode);
      setLeader(result.leader); setAudit(history.audit); setEditing(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save leadership.'); }
    finally { setSaving(false); }
  };

  const fieldClass = `h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-yellow-500 ${dark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`;
  return <aside className="absolute inset-0 z-[70] flex justify-end bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose}>
    <div className={`h-full w-full overflow-y-auto border-l p-5 shadow-2xl sm:max-w-lg ${dark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-950'}`} onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leadership</p><h2 className="mt-1 text-xl font-semibold">{label}</h2>{location && <p className="mt-1 text-xs text-slate-500">{location.levelName} · {location.referenceCode}</p>}</div><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-500/10" aria-label="Close leadership panel"><X size={18} /></button></div>
      {loading && <p className="mt-8 text-sm text-slate-500">Loading verified leadership record…</p>}
      {error && <p className="mt-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      {!loading && !editing && <div className="mt-7">
        {leader ? <section className={`rounded-xl border p-5 ${dark ? 'border-slate-700' : 'border-slate-200'}`}><div className="flex gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-600"><UserRound /></span><div><h3 className="font-semibold">{leader.fullName}</h3><p className="text-sm text-slate-500">{leader.title}</p></div></div>{leader.organization && <p className="mt-4 text-sm">{leader.organization}</p>}<div className="mt-4 space-y-2 text-sm text-slate-500">{leader.phone && <p className="flex gap-2"><Phone size={15} />{leader.phone}</p>}{leader.email && <p className="flex gap-2"><Mail size={15} />{leader.email}</p>}{leader.termStartedOn && <p className="flex gap-2"><Clock3 size={15} />Serving since {leader.termStartedOn}</p>}</div>{leader.biography && <p className="mt-4 border-t pt-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">{leader.biography}</p>}</section> : <div className={`rounded-xl border border-dashed p-8 text-center ${dark ? 'border-slate-700' : 'border-slate-300'}`}><UserRound className="mx-auto text-slate-400" /><h3 className="mt-3 font-semibold">No leader recorded</h3><p className="mt-1 text-sm text-slate-500">This does not mean the position is vacant; no verified details have been added yet.</p></div>}
        {editable && <button onClick={() => setEditing(true)} className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-slate-950"><Pencil size={15} />{leader ? 'Update or replace leader' : 'Add leader'}</button>}
        <section className="mt-8"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-500" /><h3 className="font-semibold">Accountability history</h3></div>{audit.length ? <ol className="mt-3 space-y-3">{audit.map((item) => <li key={item.id} className={`rounded-lg border p-3 text-sm ${dark ? 'border-slate-700' : 'border-slate-200'}`}><span className="font-semibold capitalize">{item.action}</span><p className="mt-1 text-xs text-slate-500">{item.actorEmail || item.actorUid} · {item.actorRole} · {new Date(item.occurredAt).toLocaleString()}</p></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No changes have been recorded.</p>}</section>
      </div>}
      {editing && <form onSubmit={save} className="mt-7 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Full name<input required className={`${fieldClass} mt-1.5`} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label className="text-sm font-medium">Official title<input required className={`${fieldClass} mt-1.5`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label className="text-sm font-medium">Phone<input className={`${fieldClass} mt-1.5`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="text-sm font-medium">Public email<input type="email" className={`${fieldClass} mt-1.5`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label className="text-sm font-medium">Organization<input className={`${fieldClass} mt-1.5`} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></label><label className="text-sm font-medium">Term began<input type="date" className={`${fieldClass} mt-1.5`} value={form.termStartedOn} onChange={(e) => setForm({ ...form, termStartedOn: e.target.value })} /></label></div><label className="block text-sm font-medium">Public biography<textarea className={`${fieldClass} mt-1.5 h-24 py-2`} value={form.biography} onChange={(e) => setForm({ ...form, biography: e.target.value })} /></label>{leader && form.fullName.trim().toLowerCase() !== leader.fullName.trim().toLowerCase() && <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Changing the name creates a new assignment and preserves the former leader in history.</p>}<div className="flex gap-2"><button disabled={saving} className="h-10 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save verified details'}</button><button type="button" onClick={() => setEditing(false)} className="h-10 rounded-lg border px-4 text-sm font-semibold">Cancel</button></div></form>}
    </div>
  </aside>;
};

export default LocationLeadershipPanel;
