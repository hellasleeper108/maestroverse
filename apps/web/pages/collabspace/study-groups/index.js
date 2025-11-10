import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../../components/Navbar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { collabspace, auth } from '../../../lib/api';

function StudyGroups({ user, setUser }) {
  const [studyGroups, setStudyGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' or 'my-groups'
  const [filters, setFilters] = useState({ courseId: '', cohort: '', search: '' });
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    try {
      setError(null);
      const [coursesData, groupsData, myGroupsData] = await Promise.all([
        collabspace.getCourses(),
        collabspace.getStudyGroups(),
        collabspace.getMyStudyGroups(),
      ]);
      setCourses(coursesData.courses);
      setStudyGroups(groupsData.studyGroups);
      setMyGroups(myGroupsData.studyGroups);
    } catch (err) {
      console.error('Failed to load study groups:', err);
      setError(err.message || 'Failed to load study groups');
    } finally {
      setLoading(false);
    }
  }

  async function handleFilter() {
    try {
      setLoading(true);
      const cleanFilters = {};
      if (filters.courseId) cleanFilters.courseId = filters.courseId;
      if (filters.cohort) cleanFilters.cohort = filters.cohort;
      if (filters.search) cleanFilters.search = filters.search;

      const data = await collabspace.getStudyGroups(cleanFilters);
      setStudyGroups(data.studyGroups);
    } catch (err) {
      console.error('Failed to filter groups:', err);
      setError(err.message || 'Failed to filter groups');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup(groupId) {
    try {
      await collabspace.joinStudyGroup(groupId);
      await loadData();
    } catch (err) {
      console.error('Failed to join group:', err);
      setError(err.message || 'Failed to join group');
    }
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
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Study Groups</h1>
              <p className="text-gray-400">Find and join study groups to collaborate with peers</p>
            </div>
            <button
              onClick={() => router.push('/collabspace/study-groups/create')}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Create Group
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'browse'
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Browse Groups
            </button>
            <button
              onClick={() => setActiveTab('my-groups')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'my-groups'
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              My Groups ({myGroups.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadData} />
          </div>
        )}

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <>
            {/* Filters */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm">Search</label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search groups..."
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm">Course</label>
                  <select
                    value={filters.courseId}
                    onChange={(e) => setFilters({ ...filters, courseId: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">All Courses</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm">Skill Level</label>
                  <select
                    value={filters.cohort}
                    onChange={(e) => setFilters({ ...filters, cohort: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleFilter}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Study Groups Grid */}
            {loading ? (
              <LoadingSpinner size="lg" text="Loading study groups..." />
            ) : studyGroups.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-white text-xl font-semibold mb-2">No study groups found</h3>
                <p className="text-gray-400 mb-6">Be the first to create a study group!</p>
                <button
                  onClick={() => router.push('/collabspace/study-groups/create')}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Create Study Group
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {studyGroups.map((group) => (
                  <StudyGroupCard
                    key={group.id}
                    group={group}
                    onJoin={handleJoinGroup}
                    onClick={() => router.push(`/collabspace/study-groups/${group.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* My Groups Tab */}
        {activeTab === 'my-groups' && (
          <>
            {loading ? (
              <LoadingSpinner size="lg" text="Loading your groups..." />
            ) : myGroups.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-white text-xl font-semibold mb-2">No groups yet</h3>
                <p className="text-gray-400 mb-6">Join or create a study group to get started!</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Browse Groups
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myGroups.map((group) => (
                  <StudyGroupCard
                    key={group.id}
                    group={group}
                    onClick={() => router.push(`/collabspace/study-groups/${group.id}`)}
                    showMembershipBadge
                    membershipRole={group.membershipRole}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StudyGroupCard({ group, onJoin, onClick, showMembershipBadge, membershipRole }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-teal-500 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg mb-1">{group.name}</h3>
          {group.course && <p className="text-teal-400 text-sm">{group.course.code}</p>}
        </div>
        {showMembershipBadge && (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              membershipRole === 'admin'
                ? 'bg-purple-600/20 text-purple-400'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {membershipRole}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{group.description}</p>

      {/* Tags */}
      {group.tags && group.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {group.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="px-2 py-1 bg-teal-600/20 text-teal-400 text-xs rounded">
              {tag}
            </span>
          ))}
          {group.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
              +{group.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex items-center justify-between text-sm pt-4 border-t border-gray-700">
        <div className="flex items-center space-x-4 text-gray-400">
          <span>
            👥 {group._count?.members || 0}/{group.maxMembers}
          </span>
          <span>💬 {group._count?.messages || 0}</span>
        </div>

        {!group.isMember && onJoin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin(group.id);
            }}
            disabled={group.isFull}
            className="px-4 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {group.isFull ? 'Full' : 'Join'}
          </button>
        )}
      </div>

      {/* Meeting Info */}
      {(group.meetingTime || group.location) && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
          {group.meetingTime && <p>⏰ {group.meetingTime}</p>}
          {group.location && <p>📍 {group.location}</p>}
        </div>
      )}
    </div>
  );
}

StudyGroupCard.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    course: PropTypes.shape({
      code: PropTypes.string,
      name: PropTypes.string,
    }),
    tags: PropTypes.arrayOf(PropTypes.string),
    maxMembers: PropTypes.number,
    isMember: PropTypes.bool,
    isFull: PropTypes.bool,
    meetingTime: PropTypes.string,
    location: PropTypes.string,
    _count: PropTypes.shape({
      members: PropTypes.number,
      messages: PropTypes.number,
    }),
  }).isRequired,
  onJoin: PropTypes.func,
  onClick: PropTypes.func,
  showMembershipBadge: PropTypes.bool,
  membershipRole: PropTypes.string,
};

StudyGroups.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default StudyGroups;
