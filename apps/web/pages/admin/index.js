import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { admin as adminApi, auth } from '../../lib/api';

const SUSPEND_OPTIONS = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: '7 days', minutes: 60 * 24 * 7 },
];

function formatDate(value) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function getStatusTone(status) {
  switch (status) {
    case 'BANNED':
      return 'text-red-400 border-red-500/60 bg-red-500/10';
    case 'SUSPENDED':
      return 'text-orange-300 border-orange-400/60 bg-orange-500/10';
    default:
      return 'text-cyan-200 border-cyber-border/70 bg-cyber-surface/70';
  }
}

function AdminDashboard({ user, setUser }) {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [actionUserId, setActionUserId] = useState(null);

  const isAdmin = user?.role === 'ADMIN';

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user === null) {
      router.push('/login');
      return;
    }

    if (user && user.role !== 'ADMIN') {
      router.replace('/hub');
      return;
    }

    loadUsers();
  }, [user, router, loadUsers]);

  const handleLogout = useCallback(() => {
    auth.logout();
    setUser(null);
    router.push('/login');
  }, [router, setUser]);

  const handleSuspend = async (targetId, minutes, label) => {
    if (!window.confirm(`Suspend this user for ${label}?`)) {
      return;
    }

    const reason = window.prompt('Reason for suspension (optional):') || undefined;

    try {
      setActionUserId(targetId);
      setFeedback(null);
      await adminApi.suspendUser(targetId, minutes, reason);
      setFeedback('User suspended successfully.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to suspend user');
    } finally {
      setActionUserId(null);
    }
  };

  const handleBan = async (targetId) => {
    if (!window.confirm('This will permanently ban the user. Continue?')) {
      return;
    }

    const reason = window.prompt('Reason for ban (optional):') || undefined;

    try {
      setActionUserId(targetId);
      setFeedback(null);
      await adminApi.banUser(targetId, reason);
      setFeedback('User banned successfully.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to ban user');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRestore = async (targetId) => {
    try {
      setActionUserId(targetId);
      setFeedback(null);
      await adminApi.restoreUser(targetId);
      setFeedback('User restored to active status.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to restore user');
    } finally {
      setActionUserId(null);
    }
  };

  const handleDelete = async (targetId) => {
    if (!window.confirm('Delete this user and all associated data? This cannot be undone.')) {
      return;
    }

    try {
      setActionUserId(targetId);
      setFeedback(null);
      await adminApi.deleteUser(targetId);
      setFeedback('User deleted.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRoleToggle = async (targetId, role) => {
    const nextRole = role === 'ADMIN' ? 'STUDENT' : 'ADMIN';
    if (role === 'ADMIN' && !window.confirm('Remove admin privileges from this user?')) {
      return;
    }

    if (role !== 'ADMIN' && !window.confirm('Grant admin privileges to this user?')) {
      return;
    }

    try {
      setActionUserId(targetId);
      setFeedback(null);
      await adminApi.updateRole(targetId, nextRole);
      setFeedback('User role updated.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user role');
    } finally {
      setActionUserId(null);
    }
  };

  const summaryCounts = useMemo(() => {
    return users.reduce(
      (acc, entry) => {
        acc.total += 1;
        const statusKey = entry.status?.toLowerCase();
        if (statusKey && Object.prototype.hasOwnProperty.call(acc, statusKey)) {
          acc[statusKey] += 1;
        }
        if (entry.role === 'ADMIN') acc.admins += 1;
        return acc;
      },
      { total: 0, active: 0, suspended: 0, banned: 0, admins: 0 },
    );
  }, [users]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen text-cyber-text">
      <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white drop-shadow-glow-blue">Moderator Console</h1>
            <p className="text-sm text-gray-400">
              Manage user access, respond to reports, and keep the community safe.
            </p>
          </div>
          <div className="flex gap-3 text-xs uppercase tracking-wide text-gray-400">
            <span>Total: {summaryCounts.total}</span>
            <span>Active: {summaryCounts.active}</span>
            <span>Suspended: {summaryCounts.suspended}</span>
            <span>Banned: {summaryCounts.banned}</span>
            <span>Admins: {summaryCounts.admins}</span>
          </div>
        </header>

        {feedback && (
          <div className="cyber-card border border-cyber-blue/50 bg-cyber-surface/60 px-5 py-4 text-sm text-cyber-blue">
            {feedback}
          </div>
        )}

        {error && (
          <ErrorMessage message={error} onRetry={loadUsers} />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading users..." />
          </div>
        ) : (
          <section className="cyber-card border border-cyber-border/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-cyber-border/60">
                <thead className="bg-cyber-surface/95 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Suspended Until</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/60 text-sm">
                  {users.map((entry) => {
                    const isSelf = entry.id === user.id;
                    return (
                      <tr key={entry.id} className="hover:bg-cyber-surface/60 transition-colors">
                        <td className="px-4 py-4 align-top">
                          <div className="font-medium text-white">
                            {entry.firstName} {entry.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{entry.email}</div>
                          <div className="text-xs text-gray-600">@{entry.username}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(entry.status)}`}>
                            {entry.status}
                          </span>
                          {entry.moderationNote && (
                            <div className="mt-2 text-xs text-gray-500">{entry.moderationNote}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-gray-400">
                          {entry.suspendedUntil ? formatDate(entry.suspendedUntil) : '—'}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-gray-400">
                          {entry.role}
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-gray-500">
                          <div>Created: {formatDate(entry.createdAt)}</div>
                          <div>Last active: {formatDate(entry.lastActive)}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2 justify-end">
                            {!isSelf && entry.status !== 'BANNED' && (
                              <>
                                {SUSPEND_OPTIONS.map((option) => (
                                  <button
                                    key={option.minutes}
                                    onClick={() => handleSuspend(entry.id, option.minutes, option.label)}
                                    className="rounded-md border border-cyber-border/70 bg-cyber-surface/70 px-3 py-1 text-xs text-gray-200 hover:border-cyber-blue hover:text-white transition"
                                    disabled={actionUserId === entry.id}
                                  >
                                    Suspend {option.label}
                                  </button>
                                ))}
                                <button
                                  onClick={() => handleBan(entry.id)}
                                  className="rounded-md border border-red-500/70 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20 transition"
                                  disabled={actionUserId === entry.id}
                                >
                                  Ban
                                </button>
                              </>
                            )}
                            {!isSelf && entry.status !== 'ACTIVE' && (
                              <button
                                onClick={() => handleRestore(entry.id)}
                                className="rounded-md border border-cyber-blue/60 bg-cyber-blue/10 px-3 py-1 text-xs text-cyber-blue hover:bg-cyber-blue/20 transition"
                                disabled={actionUserId === entry.id}
                              >
                                Restore
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                onClick={() => handleRoleToggle(entry.id, entry.role)}
                                className="rounded-md border border-purple-500/60 bg-purple-500/10 px-3 py-1 text-xs text-purple-200 hover:bg-purple-500/20 transition"
                                disabled={actionUserId === entry.id}
                              >
                                {entry.role === 'ADMIN' ? 'Remove Admin' : 'Make Admin'}
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="rounded-md border border-red-600/60 bg-red-600/10 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20 transition"
                                disabled={actionUserId === entry.id}
                              >
                                Delete
                              </button>
                            )}
                            {isSelf && (
                              <span className="text-xs text-gray-500">(This is you)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

AdminDashboard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default AdminDashboard;
