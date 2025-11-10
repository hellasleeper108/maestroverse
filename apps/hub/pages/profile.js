import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { users, auth } from '../lib/api';

const YEAR_LABELS = {
  1: 'Freshman',
  2: 'Sophomore',
  3: 'Junior',
  4: 'Senior',
};

const COHORT_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const DATE_FORMAT_OPTIONS = { month: 'short', day: 'numeric', year: 'numeric' };

function formatDate(date) {
  if (!date) return '—';
  const safeDate = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(safeDate.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(safeDate);
}

function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, [user]);

  async function loadProfile() {
    try {
      setError(null);
      const data = await users.getProfile(user.id);
      setProfile(data.user);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData(e.target);
      const updateData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        bio: formData.get('bio'),
        major: formData.get('major'),
        year: formData.get('year') ? parseInt(formData.get('year')) : undefined,
        cohort: formData.get('cohort') || undefined,
        skills: formData.get('skills')
          ? formData
              .get('skills')
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s)
          : [],
        interests: formData.get('interests')
          ? formData
              .get('interests')
              .split(',')
              .map((i) => i.trim())
              .filter((i) => i)
          : [],
      };

      const data = await users.updateProfile(updateData);
      setProfile((prev) => (prev ? { ...prev, ...data.user } : data.user));
      setUser((prev) => (prev ? { ...prev, ...data.user } : data.user));
      setSuccess('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen text-cyber-text">
        <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
          <LoadingSpinner size="lg" text="Loading profile..." />
        </div>
      </div>
    );
  }

  const displayName = useMemo(() => {
    if (!profile) {
      return user?.firstName || user?.email || 'Your Profile';
    }
    const parts = [profile.firstName, profile.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return profile.username || user?.email || 'Your Profile';
  }, [profile, user]);

  const initials = useMemo(() => {
    if (!profile) return (user?.firstName || 'U').charAt(0).toUpperCase();
    const first = profile.firstName?.[0] || '';
    const last = profile.lastName?.[0] || '';
    const combined = `${first}${last}`.trim();
    if (combined) return combined.toUpperCase();
    return (profile.username || user?.firstName || 'U').charAt(0).toUpperCase();
  }, [profile, user]);

  const stats = useMemo(
    () => ({
      posts: profile?._count?.posts ?? 0,
      projects: profile?._count?.projects ?? 0,
      connections: profile?._count?.connections ?? 0,
    }),
    [profile]
  );

  const statCards = [
    {
      key: 'posts',
      label: 'Community Posts',
      value: stats.posts,
      icon: '🛰️',
      hint: 'Shared to the Hub feed',
    },
    {
      key: 'projects',
      label: 'Projects',
      value: stats.projects,
      icon: '🛠️',
      hint: 'Published across Maestroverse',
    },
    {
      key: 'connections',
      label: 'Connections',
      value: stats.connections,
      icon: '🤝',
      hint: 'Collaborators in your network',
    },
  ];

  const timelineEvents = useMemo(() => {
    if (!profile) return [];
    const events = [];

    if (profile.createdAt) {
      events.push({
        title: 'Joined Maestroverse',
        meta: formatDate(profile.createdAt),
        description: 'Started collaborating with the Maestroverse community.',
        accent: 'blue',
      });
    }

    if ((stats.posts || 0) > 0) {
      events.push({
        title: 'Shared insights',
        meta: `${stats.posts} ${stats.posts === 1 ? 'post' : 'posts'}`,
        description: 'Contributed knowledge to the community feed.',
        accent: 'pink',
      });
    }

    if ((stats.projects || 0) > 0) {
      events.push({
        title: 'Collaborated on projects',
        meta: `${stats.projects} ${stats.projects === 1 ? 'project' : 'projects'}`,
        description: 'Showcased work through collaborative initiatives.',
        accent: 'blue',
      });
    }

    if ((stats.connections || 0) > 0) {
      events.push({
        title: 'Expanded network',
        meta: `${stats.connections} ${stats.connections === 1 ? 'connection' : 'connections'}`,
        description: 'Built relationships across the Maestroverse.',
        accent: 'pink',
      });
    }

    return events;
  }, [profile, stats]);

  const yearLabel = profile?.year ? YEAR_LABELS[profile.year] : null;
  const cohortLabel = profile?.cohort ? COHORT_LABELS[profile.cohort] : null;
  const primaryRole =
    [profile?.major, yearLabel].filter(Boolean).join(' • ') || 'Add your academic focus';
  const joinDate = formatDate(profile?.createdAt);
  const skills = profile?.skills ?? [];
  const interests = profile?.interests ?? [];
  const bio = profile?.bio?.trim() || 'Share a brief bio so collaborators know what drives you.';
  const emailValue = user?.email || null;
  const emailDisplay = emailValue || 'Add an email';
  const majorLabel = profile?.major || 'Undeclared major';
  const yearDisplay = yearLabel || 'Year not set';
  const username = profile?.username ? `@${profile.username}` : null;

  return (
    <div className="min-h-screen text-cyber-text">
      <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <section className="cyber-card p-8 lg:p-10 border border-cyber-border/80">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-6">
              <div className="relative">
                {profile?.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt="Profile"
                    className="h-24 w-24 rounded-full border-2 border-cyber-blue object-cover shadow-glow-blue"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyber-pink/70 to-cyber-blue/70 text-3xl font-semibold text-white shadow-glow-pink">
                    {initials}
                  </div>
                )}
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-cyber-border/80 bg-black/70 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-gray-500">
                  Hub
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-white drop-shadow-glow-blue md:text-4xl">
                    {displayName}
                  </h1>
                  {username && (
                    <span className="text-xs uppercase tracking-[0.35em] text-cyber-blue">
                      {username}
                    </span>
                  )}
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-gray-400">{bio}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="rounded-full border border-cyber-border/60 bg-cyber-surface/80 px-3 py-1 text-xs uppercase tracking-wide text-cyber-blue shadow-glow-blue">
                    {primaryRole}
                  </span>
                  {cohortLabel && (
                    <span className="rounded-full border border-cyber-border/60 bg-cyber-surface/80 px-3 py-1 text-xs uppercase tracking-wide text-cyber-pink shadow-glow-pink">
                      {cohortLabel} Cohort
                    </span>
                  )}
                  <span className="rounded-full border border-cyber-border/60 bg-cyber-surface/60 px-3 py-1 text-xs uppercase tracking-wide text-gray-400">
                    Joined {joinDate}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <a
                href="#profile-form"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyber-pink to-cyber-blue px-5 py-2.5 text-sm font-medium text-white shadow-glow-pink transition-transform hover:scale-[1.02]"
              >
                Edit Profile
              </a>
              <span className="text-[11px] text-gray-500">
                Keep your details updated to help others discover you.
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat) => (
            <div
              key={stat.key}
              className="cyber-card flex flex-col gap-2 border border-cyber-border/70 p-6 shadow-glow-blue"
            >
              <div className="text-2xl">{stat.icon}</div>
              <div className="text-3xl font-semibold text-white drop-shadow-glow-blue">
                {stat.value}
              </div>
              <div className="text-sm font-medium uppercase tracking-wider text-gray-400">
                {stat.label}
              </div>
              <p className="text-xs text-gray-500">{stat.hint}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8">
            <div className="cyber-card space-y-4 border border-cyber-border/80 p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Profile Snapshot</h2>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">At a glance</p>
              </div>
              <div className="space-y-3 text-sm text-gray-300">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Email</p>
                  {emailValue ? (
                    <a
                      href={`mailto:${emailValue}`}
                      className="text-cyber-blue transition hover:text-cyber-pink"
                    >
                      {emailDisplay}
                    </a>
                  ) : (
                    <span className="text-gray-500">{emailDisplay}</span>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                    Academic Focus
                  </p>
                  <p>{majorLabel}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Year</p>
                  <p>{yearDisplay}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Cohort</p>
                  <p>{cohortLabel || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Joined</p>
                  <p>{joinDate}</p>
                </div>
              </div>
            </div>

            <div className="cyber-card space-y-4 border border-cyber-border/80 p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Skills & Interests</h2>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Your toolkit</p>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Skills</p>
                  {skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-cyber-border/70 bg-cyber-surface/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyber-blue shadow-glow-blue"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Add skills so teammates know where you thrive.
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Interests</p>
                  {interests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {interests.map((interest) => (
                        <span
                          key={interest}
                          className="rounded-full border border-cyber-border/70 bg-cyber-surface/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyber-pink shadow-glow-pink"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Share interests to surface relevant opportunities.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="cyber-card space-y-4 border border-cyber-border/80 p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Growth Timeline</h2>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Milestones</p>
              </div>
              {timelineEvents.length > 0 ? (
                <ol className="space-y-4">
                  {timelineEvents.map((event, index) => (
                    <li key={`${event.title}-${index}`} className="relative pl-6">
                      <span className="absolute left-0 top-1.5 inline-flex h-3 w-3 rounded-full bg-gradient-to-br from-cyber-pink/80 to-cyber-blue/80 shadow-glow-blue" />
                      <div className="text-sm font-medium text-white">{event.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-cyber-blue">
                        {event.meta}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{event.description}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-gray-600">
                  Start sharing updates to build your first milestone.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            {error && (
              <div className="cyber-card border border-red-500/40 bg-red-500/10 p-4">
                <ErrorMessage message={error} onRetry={() => setError(null)} />
              </div>
            )}

            {success && (
              <div className="cyber-card border border-cyber-blue/50 bg-cyber-surface/60 px-5 py-4 text-sm text-cyber-blue">
                {success}
              </div>
            )}

            <form
              id="profile-form"
              onSubmit={handleSave}
              className="cyber-card space-y-10 border border-cyber-border/80 p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Refine Your Profile</h2>
                  <p className="text-sm text-gray-500">
                    Update the details collaborators see across the Hub.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-cyber-border/80 bg-cyber-surface/70 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-300 transition hover:border-cyber-blue hover:text-white"
                >
                  Change Photo
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    defaultValue={profile?.firstName || ''}
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    defaultValue={profile?.lastName || ''}
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-gray-500">Bio</label>
                <textarea
                  name="bio"
                  defaultValue={profile?.bio || ''}
                  placeholder="Tell us about yourself..."
                  rows="4"
                  className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">Major</label>
                  <input
                    type="text"
                    name="major"
                    defaultValue={profile?.major || ''}
                    placeholder="e.g., Computer Science"
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">Year</label>
                  <select
                    name="year"
                    defaultValue={profile?.year || ''}
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  >
                    <option value="">Select year</option>
                    <option value="1">Freshman</option>
                    <option value="2">Sophomore</option>
                    <option value="3">Junior</option>
                    <option value="4">Senior</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">
                    Study Cohort
                  </label>
                  <select
                    name="cohort"
                    defaultValue={profile?.cohort || ''}
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  >
                    <option value="">Select cohort</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">Skills</label>
                  <input
                    type="text"
                    name="skills"
                    defaultValue={skills.join(', ')}
                    placeholder="e.g., JavaScript, Python, React"
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  />
                  <p className="text-xs text-gray-600">
                    Separate skills with commas to create badges.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-gray-500">Interests</label>
                  <input
                    type="text"
                    name="interests"
                    defaultValue={interests.join(', ')}
                    placeholder="e.g., AI, Web Development, Gaming"
                    className="w-full rounded-lg border border-cyber-border/60 bg-cyber-surface/80 px-4 py-3 text-sm text-white focus:border-cyber-blue focus:outline-none focus:ring-2 focus:ring-cyber-blue/60"
                  />
                  <p className="text-xs text-gray-600">
                    Highlight what inspires you to connect with like minds.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyber-pink to-cyber-blue px-6 py-3 text-sm font-semibold text-white shadow-glow-pink transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

Profile.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default Profile;
