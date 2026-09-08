import React, { useEffect, useState } from 'react';
import { Braces, Check, Copy, KeyRound, Loader2, MapPin } from 'lucide-react';
import type { Theme, User } from '../../types';
import { getCurrentApiSession, getLocationApiDescriptor, type LocationApiDescriptor } from '../../services/userAdministrationService';

interface ApiSettingsPageProps { theme: Theme; currentUser: User; }

const ApiSettingsPage: React.FC<ApiSettingsPageProps> = ({ theme, currentUser }) => {
  const [descriptors, setDescriptors] = useState<LocationApiDescriptor[]>([]);
  const [hasGlobalRead, setHasGlobalRead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await getCurrentApiSession();
        setHasGlobalRead(session.role === 'admin' || session.assignedLocationReferenceCodes.length === 0);
        setDescriptors(await Promise.all(session.assignedLocationReferenceCodes.map(getLocationApiDescriptor)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load API access.');
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}${value}`);
    setCopied(value);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const panel = theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white';
  if (loading) return <div className="flex h-full items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin text-yellow-500" /> Loading API access…</div>;

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex items-start gap-3"><div className="rounded-xl bg-yellow-500/15 p-3 text-yellow-500"><KeyRound size={24} /></div><div><h2 className="text-xl font-black">Your Location APIs</h2><p className="mt-1 text-sm text-slate-500">Signed in as {currentUser.email}. Send a Firebase ID token in <code>Authorization: Bearer TOKEN</code>.</p></div></div>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500">{error}</div>}
      {hasGlobalRead && <div className={`rounded-xl border p-5 ${panel}`}><div className="mb-3 flex items-center gap-2 font-black"><Braces className="text-emerald-500" size={20} /> All-country read access</div><Endpoint path="/api/v1/countries" onCopy={copy} copied={copied} /><div className="mt-2"><Endpoint path="/api/v1/countries/UG/locations?level=2&limit=100" onCopy={copy} copied={copied} /></div></div>}
      {descriptors.map((descriptor) => <div key={descriptor.scope.referenceCode} className={`rounded-xl border p-5 ${panel}`}><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><MapPin size={19} className="text-yellow-500" /><h3 className="text-lg font-black">{descriptor.scope.name}</h3></div><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{descriptor.scope.countryCode} · {descriptor.scope.levelName}</p></div><code className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-yellow-400">{descriptor.scope.referenceCode}</code></div><div className="grid gap-2 lg:grid-cols-2">{Object.values(descriptor.links).map((path) => <Endpoint key={path} path={path} onCopy={copy} copied={copied} />)}</div></div>)}
      {!hasGlobalRead && descriptors.length === 0 && !error && <div className={`rounded-xl border p-10 text-center ${panel}`}><KeyRound size={32} className="mx-auto mb-3 text-slate-500" /><h3 className="font-black">No API location has been assigned</h3><p className="mt-1 text-sm text-slate-500">Ask the system owner to assign a country, district, sub-county, parish, or village reference code.</p></div>}
    </div>
  );
};

const Endpoint: React.FC<{ path: string; copied: string | null; onCopy: (path: string) => void }> = ({ path, copied, onCopy }) => <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-950/70 px-3 py-2"><span className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-500">GET</span><code className="min-w-0 flex-1 truncate text-xs text-slate-300" title={path}>{path}</code><button onClick={() => onCopy(path)} className="text-slate-400 hover:text-yellow-500" title="Copy complete URL">{copied === path ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}</button></div>;

export default ApiSettingsPage;
