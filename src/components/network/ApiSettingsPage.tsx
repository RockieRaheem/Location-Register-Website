import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Braces, Check, Code2, Copy, KeyRound, Loader2, MapPin, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';
import type { Theme, User } from '../../types';
import {
  getCurrentApiSession,
  getCurrentFirebaseIdToken,
  getLocationApiDescriptor,
  type LocationApiDescriptor,
} from '../../services/userAdministrationService';
import ApiScopeBuilder from './ApiScopeBuilder';

interface ApiSettingsPageProps { theme: Theme; currentUser: User; }
type Tab = 'builder' | 'overview' | 'authentication' | 'endpoints' | 'examples' | 'errors';

const ApiSettingsPage: React.FC<ApiSettingsPageProps> = ({ theme, currentUser }) => {
  const [descriptors, setDescriptors] = useState<LocationApiDescriptor[]>([]);
  const [hasGlobalRead, setHasGlobalRead] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenLoading, setTokenLoading] = useState(false);
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

  const baseUrl = window.location.origin;
  const sampleReference = descriptors[0]?.scope.referenceCode || 'UG-L02-2A18AC7F6F1D554FB225E347D4F133A5';
  const samplePath = descriptors[0]?.links.subtree || `/api/v1/locations/${sampleReference}/subtree?maxDepth=4&limit=1000`;
  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };
  const issueToken = async () => {
    setTokenLoading(true);
    setError(null);
    try { setToken(await getCurrentFirebaseIdToken(true)); }
    catch (tokenError) { setError(tokenError instanceof Error ? tokenError.message : 'Unable to create token.'); }
    finally { setTokenLoading(false); }
  };

  const examples = useMemo(() => ({
    curl: `curl -H "Authorization: Bearer $FIREBASE_ID_TOKEN" "${baseUrl}${samplePath}"`,
    javascript: `import { getAuth } from "firebase/auth";\n\nconst token = await getAuth().currentUser?.getIdToken();\nconst response = await fetch("${baseUrl}${samplePath}", {\n  headers: { Authorization: \`Bearer \${token}\` }\n});\nif (!response.ok) throw new Error(\`API error \${response.status}\`);\nconst data = await response.json();`,
    python: `import requests\n\nresponse = requests.get(\n    "${baseUrl}${samplePath}",\n    headers={"Authorization": "Bearer " + firebase_id_token},\n    timeout=30,\n)\nresponse.raise_for_status()\ndata = response.json()`,
  }), [baseUrl, samplePath]);

  const panel = theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white';
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'builder', label: 'Choose Data', icon: <MapPin size={15} /> },
    { id: 'overview', label: 'Overview', icon: <BookOpen size={15} /> },
    { id: 'authentication', label: 'Authentication', icon: <KeyRound size={15} /> },
    { id: 'endpoints', label: 'Endpoints', icon: <Braces size={15} /> },
    { id: 'examples', label: 'Examples', icon: <Code2 size={15} /> },
    { id: 'errors', label: 'Errors', icon: <ShieldCheck size={15} /> },
  ];

  if (loading) return <div className="flex h-full items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin text-yellow-500" /> Loading developer portal…</div>;

  return (
    <div className="space-y-4 pb-8">
      <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-yellow-500/15 p-3 text-yellow-500"><Terminal size={25} /></div><div><p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500">API access</p><h2 className="text-2xl font-black">Any-Location API v1</h2><p className="mt-1 text-sm text-slate-500">Choose the exact country, administrative level or location data your system needs.</p></div></div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge text="REST / JSON" /><Badge text="Firebase Auth" /><Badge text="Versioned v1" /><Badge text="Max 1,000/page" /></div>
        </div>
      </section>

      <nav className={`flex gap-1 overflow-x-auto rounded-xl border p-1.5 ${panel}`} aria-label="API documentation sections">
        {tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${activeTab === tab.id ? 'bg-yellow-500 text-slate-950' : 'text-slate-500 hover:bg-slate-800/10'}`}>{tab.icon}{tab.label}</button>)}
      </nav>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500">{error}</div>}

      {activeTab === 'builder' && <ApiScopeBuilder theme={theme} baseUrl={baseUrl} hasGlobalRead={hasGlobalRead} assignedScopes={descriptors} />}

      {activeTab === 'overview' && <div className="grid gap-4 lg:grid-cols-3"><InfoCard theme={theme} title="Base URL" value={`${baseUrl}/api/v1`} /><InfoCard theme={theme} title="Your access" value={hasGlobalRead ? 'All locations · read only' : `${descriptors.length} scoped subtree${descriptors.length === 1 ? '' : 's'}`} /><InfoCard theme={theme} title="Identity" value={currentUser.email} /><section className={`lg:col-span-3 rounded-xl border p-5 ${panel}`}><h3 className="font-black">How location APIs work</h3><p className="mt-2 text-sm leading-6 text-slate-500">Every location has a permanent <code>referenceCode</code>. Use it to retrieve the location, its direct children, complete descendant subtree, ancestor path, or verified geometry. Names can change without breaking integrations because reference codes never change.</p><div className="mt-4"><Endpoint method="GET" path="/api/v1/openapi.json" baseUrl={baseUrl} copied={copied} onCopy={copy} description="Machine-readable OpenAPI 3.1 contract" /></div></section></div>}

      {activeTab === 'authentication' && <section className={`space-y-4 rounded-xl border p-5 ${panel}`}><div><h3 className="text-lg font-black">Firebase Bearer authentication</h3><p className="mt-1 text-sm text-slate-500">Every request needs a verified user’s short-lived Firebase ID token. Tokens expire and must never be stored in source control or shared.</p></div><code className="block rounded-lg bg-slate-950 p-4 text-sm text-emerald-400">Authorization: Bearer FIREBASE_ID_TOKEN</code><div className="flex flex-wrap items-center gap-3"><button onClick={() => void issueToken()} disabled={tokenLoading} className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{tokenLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Generate fresh token</button>{token && <button onClick={() => void copy('token', token)} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold">{copied === 'token' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />} Copy token</button>}</div>{token && <div className="break-all rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 font-mono text-xs text-slate-500">{token.slice(0, 28)}••••••••••••••••{token.slice(-12)}</div>}</section>}

      {activeTab === 'endpoints' && <div className="space-y-4">{hasGlobalRead && <section className={`rounded-xl border p-5 ${panel}`}><h3 className="mb-3 font-black">Global endpoints</h3><div className="space-y-2"><Endpoint method="GET" path="/api/v1/countries" baseUrl={baseUrl} copied={copied} onCopy={copy} description="List configured countries" /><Endpoint method="GET" path="/api/v1/countries/UG/schema" baseUrl={baseUrl} copied={copied} onCopy={copy} description="Get Uganda’s hierarchy definition" /><Endpoint method="GET" path="/api/v1/countries/UG/locations?level=2&limit=100&offset=0" baseUrl={baseUrl} copied={copied} onCopy={copy} description="List paginated districts and cities" /></div></section>}{descriptors.map((descriptor) => <ScopeCard key={descriptor.scope.referenceCode} descriptor={descriptor} theme={theme} baseUrl={baseUrl} copied={copied} onCopy={copy} />)}{!hasGlobalRead && descriptors.length === 0 && <EmptyScope theme={theme} />}</div>}

      {activeTab === 'examples' && <div className="space-y-4"><CodeBlock title="cURL" code={examples.curl} copied={copied} onCopy={copy} /><CodeBlock title="JavaScript (Firebase Web SDK)" code={examples.javascript} copied={copied} onCopy={copy} /><CodeBlock title="Python" code={examples.python} copied={copied} onCopy={copy} /></div>}

      {activeTab === 'errors' && <section className={`rounded-xl border p-5 ${panel}`}><h3 className="mb-4 text-lg font-black">Response and error behavior</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Status</th><th className="pb-3">Meaning</th><th className="pb-3">Action</th></tr></thead><tbody className="divide-y divide-slate-700/40"><ErrorRow code="400" meaning="Invalid query or request body" action="Correct the named field." /><ErrorRow code="401" meaning="Missing, expired, or invalid token" action="Refresh the Firebase ID token." /><ErrorRow code="403" meaning="Role or location scope denied" action="Ask the owner to grant the required scope." /><ErrorRow code="404" meaning="Reference or geometry not found" action="Verify the immutable reference code." /><ErrorRow code="409" meaning="Hierarchy conflict" action="Resolve children, duplicate, or move constraints." /></tbody></table></div><p className="mt-4 text-xs text-slate-500">List and subtree responses include <code>total</code>, <code>limit</code>/<code>offset</code> where applicable, and <code>items</code>. Continue requesting pages until offset + items.length reaches total.</p></section>}
    </div>
  );
};

const Badge = ({ text }: { text: string }) => <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-500">{text}</span>;
const InfoCard = ({ theme, title, value }: { theme: Theme; title: string; value: string }) => <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}><p className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</p><p className="mt-2 break-all font-bold">{value}</p></div>;

const Endpoint = ({ method, path, description, baseUrl, copied, onCopy }: { method: string; path: string; description: string; baseUrl: string; copied: string | null; onCopy: (key: string, value: string) => void }) => <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-950/80 px-3 py-2.5"><span className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-500">{method}</span><div className="min-w-0 flex-1"><code className="block truncate text-xs text-slate-200" title={path}>{path}</code><span className="text-[11px] text-slate-500">{description}</span></div><button onClick={() => void onCopy(path, `${baseUrl}${path}`)} className="text-slate-400 hover:text-yellow-500" title="Copy complete URL">{copied === path ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}</button></div>;

const ScopeCard = ({ descriptor, theme, baseUrl, copied, onCopy }: { descriptor: LocationApiDescriptor; theme: Theme; baseUrl: string; copied: string | null; onCopy: (key: string, value: string) => void }) => <section className={`rounded-xl border p-5 ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><MapPin size={19} className="text-yellow-500" /><h3 className="text-lg font-black">{descriptor.scope.name}</h3></div><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{descriptor.scope.countryCode} · {descriptor.scope.levelName}</p></div><button onClick={() => void onCopy(descriptor.scope.referenceCode, descriptor.scope.referenceCode)} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 font-mono text-xs text-yellow-400">{descriptor.scope.referenceCode}{copied === descriptor.scope.referenceCode ? <Check size={14} /> : <Copy size={14} />}</button></div><div className="grid gap-2 lg:grid-cols-2">{Object.entries(descriptor.links).map(([name, path]) => <Endpoint key={path} method="GET" path={path} baseUrl={baseUrl} copied={copied} onCopy={onCopy} description={name === 'self' ? 'Location record' : name === 'children' ? 'Direct next-level locations' : name === 'subtree' ? 'All permitted descendants' : name === 'ancestors' ? 'Country-to-location path' : 'Verified GeoJSON when available'} />)}</div></section>;

const CodeBlock = ({ title, code, copied, onCopy }: { title: string; code: string; copied: string | null; onCopy: (key: string, value: string) => void }) => <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900"><div className="flex items-center justify-between border-b border-slate-700 px-4 py-3"><h3 className="font-black text-white">{title}</h3><button onClick={() => void onCopy(title, code)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-yellow-500">{copied === title ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />} Copy</button></div><pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-300"><code>{code}</code></pre></section>;
const ErrorRow = ({ code, meaning, action }: { code: string; meaning: string; action: string }) => <tr><td className="py-3 font-mono font-black text-yellow-500">{code}</td><td className="py-3 pr-4">{meaning}</td><td className="py-3 text-slate-500">{action}</td></tr>;
const EmptyScope = ({ theme }: { theme: Theme }) => <div className={`rounded-xl border p-10 text-center ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}><KeyRound size={32} className="mx-auto mb-3 text-slate-500" /><h3 className="font-black">No API location assigned</h3><p className="mt-1 text-sm text-slate-500">Ask the owner to assign a country, district, sub-county, parish, or village reference code.</p></div>;

export default ApiSettingsPage;
