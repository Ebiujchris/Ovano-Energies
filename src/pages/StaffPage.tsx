import { useEffect, useState, useMemo } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  salary?: number;
  canAccessInventory: boolean;
  canApproveCredits: boolean;
  canViewReports: boolean;
  canViewDashboard: boolean;
  canMakeSales: boolean;
  canManageExpenses: boolean;
  hireDate?: string;
}

const ROLES = ['cashier', 'manager', 'stock_keeper'];

// Permission presets per role
const ROLE_PRESETS: Record<string, { canAccessInventory: boolean; canApproveCredits: boolean; canViewReports: boolean; canManageExpenses: boolean }> = {
  cashier:      { canAccessInventory: false, canApproveCredits: false, canViewReports: false, canManageExpenses: false },
  stock_keeper: { canAccessInventory: true,  canApproveCredits: false, canViewReports: false, canManageExpenses: false },
  manager:      { canAccessInventory: true,  canApproveCredits: true,  canViewReports: true,  canManageExpenses: true  },
};

const roleBadge: Record<string, string> = {
  owner:        'bg-purple-100 text-purple-700',
  manager:      'bg-blue-100 text-blue-700',
  cashier:      'bg-emerald-100 text-emerald-700',
  stock_keeper: 'bg-amber-100 text-amber-700',
};

const statusBadge: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
  on_leave: 'bg-amber-100 text-amber-700',
};

const BLANK_FORM = {
  name: '', phone: '', role: 'cashier', salary: '', password: '',
  canAccessInventory: false, canApproveCredits: false, canViewReports: false, canManageExpenses: false,
};

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StaffMember & { password?: string }>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authHeader = { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` };

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/staff`, { headers: authHeader });
      if (!res.ok) throw new Error('Failed to load staff');
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  // Apply role preset when role changes in add form
  const handleRoleChange = (role: string) => {
    const preset = ROLE_PRESETS[role] ?? BLANK_FORM;
    setForm((f) => ({ ...f, role, ...preset }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    if (!form.password) { setError('Password is required for staff login'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          role: form.role,
          password: form.password,
          salary: form.salary ? Number(form.salary) : undefined,
          canAccessInventory: form.canAccessInventory,
          canApproveCredits: form.canApproveCredits,
          canViewReports: form.canViewReports,
          canManageExpenses: form.canManageExpenses,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed to add staff');
      setMessage(`Added ${payload.name}`);
      setForm(BLANK_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.role) body.role = editForm.role;
      if (editForm.status) body.status = editForm.status;
      if (editForm.salary !== undefined) body.salary = Number(editForm.salary);
      if (editForm.canAccessInventory !== undefined) body.canAccessInventory = editForm.canAccessInventory;
      if (editForm.canApproveCredits !== undefined) body.canApproveCredits = editForm.canApproveCredits;
      if (editForm.canViewReports !== undefined) body.canViewReports = editForm.canViewReports;
      if (editForm.canManageExpenses !== undefined) body.canManageExpenses = editForm.canManageExpenses;
      if (editForm.password) body.password = editForm.password;

      const res = await fetch(`${API_URL}/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed to update');
      setEditingId(null);
      setMessage('Staff member updated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmRemove = async () => {
    if (!deleteTarget) return;
    await fetch(`${API_URL}/staff/${deleteTarget}`, { method: 'DELETE', headers: authHeader });
    setDeleteTarget(null);
    await load();
  };

  const startEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setEditForm({
      role: member.role,
      status: member.status,
      salary: member.salary,
      canAccessInventory: member.canAccessInventory,
      canApproveCredits: member.canApproveCredits,
      canViewReports: member.canViewReports,
      canManageExpenses: member.canManageExpenses,
      password: '',
    });
    setError(null); setMessage(null);
  };

  const filtered = useMemo(() => staff.filter((s) => {
    const matchRole = roleFilter === 'all' || s.role === roleFilter;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search);
    return matchRole && matchSearch;
  }), [staff, search, roleFilter]);

  return (
    <PageShell title="Staff" description="Manage your team, roles, login access, and permissions.">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove staff member"
        message="Are you sure you want to remove this staff member? They will lose access immediately."
        confirmLabel="Remove"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">

        {/* Add staff form */}
        <div className="w-full lg:w-[520px] lg:shrink-0">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Add staff member</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Full name</label>
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="e.g. Sarah Nakato" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Phone number <span className="text-slate-400">(used to log in)</span></label>
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="e.g. 0700123456" type="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Login password <span className="text-slate-400">(min 6 characters)</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-16 text-sm"
                    placeholder="Set a password for this staff"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Role</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.role} onChange={(e) => handleRoleChange(e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Monthly salary (UGX)</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Optional" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Permissions</p>
                <p className="text-xs text-slate-400">Auto-set by role — adjust as needed</p>
                {([
                  { key: 'canAccessInventory',  label: 'Access inventory & restock' },
                  { key: 'canApproveCredits',   label: 'Approve / manage credits' },
                  { key: 'canManageExpenses',   label: 'Manage expenses' },
                  { key: 'canViewReports',      label: 'View reports & financials' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <button className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={submitting}>
                {submitting ? 'Adding…' : 'Add staff member'}
              </button>
            </div>
            {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </form>
        </div>

        {/* Staff list */}
        <div className="rounded-2xl border border-slate-200 p-5 w-full lg:max-w-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Team</h2>
            <span className="text-sm text-slate-500">{filtered.length} of {staff.length} members</span>
          </div>
          <div className="mt-4 space-y-3">
            <input type="text" placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            <div className="flex flex-wrap gap-2">
              {(['all', ...ROLES]).map((r) => (
                <button key={r} type="button" onClick={() => setRoleFilter(r)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${roleFilter === r ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {r === 'all' ? `All (${staff.length})` : r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">Loading staff...</div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              {staff.length === 0 ? 'No staff added yet.' : 'No staff match your filters.'}
            </div>
          ) : (
            <div className="mt-4 max-h-[560px] overflow-y-auto space-y-2 pr-1">
              {filtered.map((member) => (
                <div key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {editingId === member.id ? (
                    /* Edit panel */
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Role</label>
                          <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={editForm.role ?? member.role}
                            onChange={(e) => {
                              const preset = ROLE_PRESETS[e.target.value] ?? {};
                              setEditForm((f) => ({ ...f, role: e.target.value, ...preset }));
                            }}>
                            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Status</label>
                          <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={editForm.status ?? member.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="on_leave">On leave</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Monthly salary (UGX)</label>
                        <input type="number" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={editForm.salary ?? member.salary ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, salary: Number(e.target.value) }))} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Permissions</p>
                        {([
                          { key: 'canAccessInventory' as const, label: 'Access inventory & restock' },
                          { key: 'canApproveCredits'  as const, label: 'Approve / manage credits' },
                          { key: 'canManageExpenses'  as const, label: 'Manage expenses' },
                          { key: 'canViewReports'     as const, label: 'View reports & financials' },
                        ]).map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input type="checkbox"
                              checked={editForm[key] ?? member[key]}
                              onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.checked }))}
                              className="rounded" />
                            {label}
                          </label>
                        ))}
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">New password (leave blank to keep current)</label>
                        <input type="password" placeholder="Optional" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={editForm.password ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={submitting} onClick={() => handleUpdate(member.id)}
                          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-600 transition">
                          {submitting ? 'Saving…' : 'Save changes'}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                      {error && <p className="text-xs text-red-500">{error}</p>}
                    </div>
                  ) : (
                    /* View row */
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{member.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge[member.role] ?? 'bg-slate-100 text-slate-600'}`}>{member.role.replace('_', ' ')}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[member.status] ?? 'bg-slate-100 text-slate-500'}`}>{member.status.replace('_', ' ')}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{member.phone}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {member.canViewDashboard   && <span className="text-xs text-slate-400">📊 Dashboard</span>}
                          {member.canMakeSales       && <span className="text-xs text-slate-400">💰 Sales</span>}
                          {member.canAccessInventory && <span className="text-xs text-slate-400">📦 Inventory</span>}
                          {member.canApproveCredits  && <span className="text-xs text-slate-400">✅ Credits</span>}
                          {member.canManageExpenses  && <span className="text-xs text-slate-400">💸 Expenses</span>}
                          {member.canViewReports     && <span className="text-xs text-slate-400">� Reports</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        {member.salary ? <p className="text-sm font-semibold text-slate-900">UGX {Number(member.salary).toLocaleString()}</p> : null}
                        <button type="button" onClick={() => startEdit(member)} className="block text-xs text-brand-500 hover:text-brand-600">Edit</button>
                        <button type="button" onClick={() => handleRemove(member.id)} className="block text-xs text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
