import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { collabspace, auth } from '../../lib/api';

function StudyGroups({ user, setUser }) {
  const [studyGroups, setStudyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    courseId: '',
    cohort: '',
    search: '',
    tags: '',
  });
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadStudyGroups();
  }, [user, filters]);

  async function loadStudyGroups() {
    try {
      setError(null);
      const data = await collabspace.getStudyGroups(filters);
      setStudyGroups(data.studyGroups);
    } catch (err) {
      console.error('Failed to load study groups:', err);
      setError(err.message || 'Failed to load study groups. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(studyGroupId) {
    try {
      await collabspace.joinStudyGroup(studyGroupId);
      await loadStudyGroups(); // Refresh to update membership status
    } catch (err) {
      console.error('Failed to join study group:', err);
      setError(err.message || 'Failed to join study group. Please try again.');
    }
  }

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Study Groups</h1>
              <p className="text-gray-400">Find study partners and collaborate with classmates</p>
            </div>
            <Link href="/study-groups/create">
              <button className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-semibold">
                Create Group
              </button>
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-white font-semibold mb-4">Filter Groups</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Group name or description..."
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cohort</label>
                <select
                  value={filters.cohort}
                  onChange={(e) => handleFilterChange('cohort', e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Cohorts</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Course</label>
                <input
                  type="text"
                  value={filters.courseId}
                  onChange={(e) => handleFilterChange('courseId', e.target.value)}
                  placeholder="Course ID..."
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                <input
                  type="text"
                  value={filters.tags}
                  onChange={(e) => handleFilterChange('tags', e.target.value)}
                  placeholder="Comma-separated tags..."
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadStudyGroups} />
          </div>
        )}

        {/* Study Groups Grid */}
        {loading ? (
          <LoadingSpinner size="lg" text="Loading study groups..." />
        ) : studyGroups.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-white text-xl font-semibold mb-2">No study groups found</h3>
            <p className="text-gray-400 mb-4">
              {Object.values(filters).some((v) => v)
                ? 'Try adjusting your filters or create the first group!'
                : 'Be the first to create a study group!'}
            </p>
            <Link href="/study-groups/create">
              <button className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                Create Group
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studyGroups.map((group) => (
              <div
                key={group.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg mb-1">{group.name}</h3>
                    {group.course && (
                      <div className="text-teal-400 text-sm font-medium mb-2">
                        {group.course.code} - {group.course.name}
                      </div>
                    )}
                  </div>
                  <div className="text-2xl">👥</div>
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                  {group.description || 'No description available'}
                </p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {group.cohort && (
                    <span className="px-2 py-1 bg-teal-600 text-white text-xs rounded-full capitalize">
                      {group.cohort}
                    </span>
                  )}
                  {group.tags?.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {group.tags?.length > 3 && (
                    <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                      +{group.tags.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                  <span>
                    👤 {group.members.length}/{group.maxMembers} members
                  </span>
                  <span>💬 {group._count.messages} messages</span>
                </div>

                <div className="flex gap-2">
                  <Link href={`/study-groups/${group.id}`}>
                    <button className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
                      View Details
                    </button>
                  </Link>
                  {group.isMember ? (
                    <button
                      disabled
                      className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-not-allowed"
                    >
                      Joined
                    </button>
                  ) : group.isFull ? (
                    <button
                      disabled
                      className="px-4 py-2 bg-gray-600 text-gray-400 rounded-lg cursor-not-allowed"
                    >
                      Full
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoin(group.id)}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

StudyGroups.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default StudyGroups;
