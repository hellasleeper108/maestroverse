import { useEffect, useState } from 'react';
import Link from 'next/link';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { collabspace, auth } from '../../lib/api';

function CollabSpace({ user, setUser }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  async function loadCourses() {
    try {
      setError(null);
      const data = await collabspace.getCourses();
      setCourses(data.courses);
    } catch (err) {
      console.error('Failed to load courses:', err);
      setError(err.message || 'Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">CollabSpace</h1>
          <p className="text-gray-400">
            Collaborate with classmates, join study groups, and share resources
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadCourses} />
          </div>
        )}

        {/* Courses Grid */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Your Courses</h2>
          {loading ? (
            <LoadingSpinner size="lg" text="Loading your courses..." />
          ) : courses.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700 mb-8">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-white text-xl font-semibold mb-2">No courses yet</h3>
              <p className="text-gray-400">Contact your administrator to get enrolled in courses</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Link key={course.id} href={`/collabspace/courses/${course.id}`}>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-teal-400 font-bold text-sm mb-1">{course.code}</div>
                        <h3 className="text-white font-semibold">{course.name}</h3>
                      </div>
                      <div className="text-2xl">📚</div>
                    </div>

                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {course.description || 'No description available'}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>💬 {course._count.threads} threads</span>
                      <span>👥 {course._count.studyGroups} groups</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-colors">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-white font-semibold mb-1">Course Forums</h3>
              <p className="text-gray-400 text-sm mb-4">Ask questions and help classmates</p>
              <p className="text-gray-500 text-xs">Select a course above to view forums</p>
            </div>

            <Link href="/collabspace/study-groups">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-colors cursor-pointer">
                <div className="text-3xl mb-3">👥</div>
                <h3 className="text-white font-semibold mb-1">Study Groups</h3>
                <p className="text-gray-400 text-sm mb-4">Find study partners and collaborate</p>
                <p className="text-teal-400 text-xs hover:underline">Browse study groups →</p>
              </div>
            </Link>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-colors">
              <div className="text-3xl mb-3">📄</div>
              <h3 className="text-white font-semibold mb-1">Resources</h3>
              <p className="text-gray-400 text-sm mb-4">Share notes, slides, and study materials</p>
              <p className="text-gray-500 text-xs">Select a course above to view resources</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

CollabSpace.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default CollabSpace;
