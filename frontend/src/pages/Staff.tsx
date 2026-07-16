import { useEffect, useState, type ReactNode } from 'react';
import { Edit3, Plus, RefreshCw, Users, X } from 'lucide-react';
import { PageHeader, Card, CardContent, Button, EmptyState, Loading } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  employeeCode: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roles: string[];
}

const roles = ['ADMIN', 'MANAGER', 'WAITER', 'CHEF', 'CASHIER', 'STOCK_KEEPER'];

export default function Staff() {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const canManage = userRoles.some((r) => ['ADMIN', 'MANAGER'].includes(r));

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeCode: '',
    temporaryPassword: 'Staff@12345',
    roleNames: ['WAITER'],
  });

  useEffect(() => { void loadStaff(); }, []);

  const loadStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/staff?limit=100');
      setStaff(response.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load staff'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      employeeCode: `EMP${String(staff.length + 1).padStart(3, '0')}`,
      temporaryPassword: 'Staff@12345',
      roleNames: ['WAITER'],
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone ?? '',
      employeeCode: member.employeeCode,
      temporaryPassword: '',
      roleNames: member.roles,
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const submitStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editing) {
        const response = await api.patch(`/staff/${editing.id}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          employeeCode: form.employeeCode,
        });
        await api.put(`/staff/${editing.id}/roles`, { roleNames: form.roleNames });
        setStaff((current) => current.map((member) => member.id === editing.id ? { ...member, ...response.data.data, roles: form.roleNames } : member));
        setSuccess('Staff member updated.');
      } else {
        const response = await api.post('/staff', form);
        setStaff((current) => [...current, { ...response.data.data, status: 'ACTIVE' }]);
        setSuccess('Staff member created.');
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save staff member'));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (member: StaffMember, status: StaffMember['status']) => {
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/staff/${member.id}/status`, { status });
      setStaff((current) => current.map((item) => item.id === member.id ? { ...item, status } : item));
      setSuccess(`${member.firstName} ${member.lastName} marked ${status}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update staff status'));
    }
  };

  const toggleRole = (role: string) => {
    setForm((current) => {
      const next = current.roleNames.includes(role)
        ? current.roleNames.filter((item) => item !== role)
        : [...current.roleNames, role];
      return { ...current, roleNames: next.length > 0 ? next : current.roleNames };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Staff"
        description="Manage restaurant staff, roles, and account status"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadStaff} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            {canManage && <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add Staff</Button>}
          </div>
        }
      />

      {error && <Message tone="error">{error}</Message>}
      {success && <Message tone="success">{success}</Message>}

      {showForm && canManage && (
        <Card>
          <CardContent>
            <form onSubmit={submitStaff} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editing ? 'Edit staff member' : 'Add staff member'}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">Assign roles carefully; backend permissions remain authoritative.</p>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="First name"><input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
                <Field label="Last name"><input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                <Field label="Employee code"><input className="input-field uppercase" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value.toUpperCase() })} /></Field>
                <Field label="Email"><input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Phone"><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                {!editing && <Field label="Temporary password"><input className="input-field" type="password" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} /></Field>}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Roles</p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={form.roleNames.includes(role)
                        ? 'rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white'
                        : 'rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'
                      }
                    >
                      {role.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" isLoading={saving}>{editing ? 'Update Staff' : 'Create Staff'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {loading ? <Loading message="Loading staff..." /> : staff.length === 0 ? (
            <EmptyState icon={<Users className="h-12 w-12" />} title="No staff members" description="Add staff members, assign roles, and manage schedules." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-muted)]">
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Roles</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-3 py-3 font-medium">{member.employeeCode}</td>
                      <td className="px-3 py-3">{member.firstName} {member.lastName}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)]">{member.email}</td>
                      <td className="px-3 py-3 text-[var(--color-text-secondary)]">{member.roles.join(', ')}</td>
                      <td className="px-3 py-3">
                        {canManage ? (
                          <select value={member.status} onChange={(e) => changeStatus(member, e.target.value as StaffMember['status'])} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-xs">
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>
                        ) : (
                          <span className={member.status === 'ACTIVE' ? badgeGreen : badgeRed}>
                            {member.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          {canManage && (
                            <button onClick={() => openEdit(member)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]" title="Edit staff">
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="block text-sm font-medium text-[var(--color-text-primary)]">{label}</span>{children}</label>;
}

function Message({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const styles = tone === 'success'
    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300';
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

const badgeGreen = 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300';
const badgeRed = 'rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
