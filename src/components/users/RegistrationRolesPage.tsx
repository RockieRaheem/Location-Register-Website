import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Search, ShieldCheck, UserCog } from 'lucide-react';
import type { Theme } from '../../types';
import type { ApplicationRole } from '../../services/firebaseAuthService';
import {
  listRegisteredUsers,
  updateRegisteredUserAccess,
  type RegisteredUserAccess,
} from '../../services/userAdministrationService';

const roles: { value: ApplicationRole; label: string }[] = [
  { value: 'contributor', label: 'Contributor' },
  { value: 'developer', label: 'API Developer' },
  { value: 'country_admin', label: 'Country Administrator' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'financial_institution', label: 'Financial Institution' },
  { value: 'admin', label: 'System Administrator' },
];

const RegistrationRolesPage: React.FC<{ theme: Theme }> = ({ theme }) => {
  const [users, setUsers] = useState<RegisteredUserAccess[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listRegisteredUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => !term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term));
  }, [search, users]);

  const editUser = (uid: string, changes: Partial<RegisteredUserAccess>) => {
    setUsers((current) => current.map((user) => user.uid === uid ? { ...user, ...changes } : user));
  };

  const saveUser = async (user: RegisteredUserAccess) => {
    setSavingUid(user.uid);
    setError(null);
    setNotice(null);
    try {
      await updateRegisteredUserAccess(user.uid, {
        role: user.role,
        status: user.disabled ? 'disabled' : 'active',
        assignedCountryCodes: user.assignedCountryCodes,
        assignedLocationReferenceCodes: user.assignedLocationReferenceCodes,
      });
      setNotice(`Access updated for ${user.email}. They must sign out and back in to receive the new role.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update access.');
    } finally {
      setSavingUid(null);
    }
  };

  const panel = theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const input = theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900';

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-yellow-500/15 p-3 text-yellow-500"><ShieldCheck size={24} /></div>
            <div>
              <h2 className="text-xl font-black">Registrations & Roles</h2>
              <p className="mt-1 text-sm text-slate-500">New registrations appear here automatically. Only the configured owner can grant or revoke access.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative min-w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm ${input}`} />
            </div>
            <button onClick={() => void loadUsers()} className={`rounded-lg border p-2.5 ${panel}`} title="Refresh registrations"><RefreshCw size={17} /></button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500">{error}</div>}
      {notice && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-500"><CheckCircle2 size={17} />{notice}</div>}

      <div className={`overflow-hidden rounded-xl border ${panel}`}>
        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin text-yellow-500" /> Loading registered users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700/40 text-sm">
              <thead className={theme === 'dark' ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>{['Registered user', 'Verified', 'Role', 'Country access', 'API location scope', 'Status', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className={theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3"><div className="font-bold">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td>
                    <td className="px-4 py-3"><span className={user.emailVerified ? 'text-emerald-500' : 'text-amber-500'}>{user.emailVerified ? 'Verified' : 'Pending'}</span></td>
                    <td className="px-4 py-3">
                      <select value={user.role} onChange={(event) => editUser(user.uid, { role: event.target.value as ApplicationRole, assignedCountryCodes: [] })} className={`rounded-lg border px-2 py-2 ${input}`}>
                        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={user.assignedLocationReferenceCodes.join(', ')}
                        onChange={(event) => editUser(user.uid, { assignedLocationReferenceCodes: event.target.value.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean) })}
                        placeholder="UG-L02-…"
                        className={`w-44 rounded-lg border px-2 py-2 uppercase ${input}`}
                        title="Optional comma-separated location reference codes. Each code grants read access only to that location and its descendants."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={user.assignedCountryCodes.join(', ')}
                        disabled={!['country_admin', 'contributor'].includes(user.role)}
                        onChange={(event) => editUser(user.uid, { assignedCountryCodes: event.target.value.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean) })}
                        placeholder="UG, KE"
                        className={`w-32 rounded-lg border px-2 py-2 uppercase disabled:cursor-not-allowed disabled:opacity-40 ${input}`}
                        title="Comma-separated ISO country codes"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select value={user.disabled ? 'disabled' : 'active'} onChange={(event) => editUser(user.uid, { disabled: event.target.value === 'disabled' })} className={`rounded-lg border px-2 py-2 ${input}`}>
                        <option value="active">Active</option><option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button disabled={savingUid === user.uid} onClick={() => void saveUser(user)} className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-2 font-bold text-slate-900 hover:bg-yellow-400 disabled:opacity-50">
                        {savingUid === user.uid ? <Loader2 size={15} className="animate-spin" /> : <UserCog size={15} />} Save
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-500">No registered users found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationRolesPage;
