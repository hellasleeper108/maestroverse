import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { careerlink, auth } from '../lib/api';

function BrowseStudents({ user, setUser }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    major: '',
    year: '',
    skills: '',
  });
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadStudents();
  }, [user]);

  async function loadStudents() {
    try {
      setError(null);
      const data = await careerlink.browseStudents(filters);
      setStudents(data.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
      setError(err.message || 'Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    await loadStudents();
  }

  function handleClearFilters() {
    setFilters({ major: '', year: '', skills: '' });
    setLoading(true);
    loadStudents();
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CareerLink" user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Browse Students</h1>
          <p className="text-gray-400">
            Discover talented peers and expand your professional network
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Filter Students</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Major</label>
                <input
                  type="text"
                  name="major"
                  value={filters.major}
                  onChange={handleFilterChange}
                  placeholder="e.g. Computer Science"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Year</label>
                <select
                  name="year"
                  value={filters.year}
                  onChange={handleFilterChange}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">All Years</option>
                  <option value="1">Freshman</option>
                  <option value="2">Sophomore</option>
                  <option value="3">Junior</option>
                  <option value="4">Senior</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Skills</label>
                <input
                  type="text"
                  name="skills"
                  value={filters.skills}
                  onChange={handleFilterChange}
                  placeholder="e.g. React, Python"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadStudents} />
          </div>
        )}

        {/* Students Grid */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">
            {students.length} {students.length === 1 ? 'Student' : 'Students'} Found
          </h2>
          {loading ? (
            <LoadingSpinner size="lg" text="Loading students..." />
          ) : students.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-white text-xl font-semibold mb-2">No students found</h3>
              <p className="text-gray-400">Try adjusting your filters to see more results</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-colors"
                >
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0">
                      {student.firstName[0]}
                      {student.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-lg mb-1">
                        {student.firstName} {student.lastName}
                      </h3>
                      <p className="text-gray-400 text-sm">@{student.username}</p>
                    </div>
                  </div>

                  {student.bio && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {student.bio}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    {student.major && (
                      <div className="flex items-center text-sm text-gray-400">
                        <span className="mr-2">🎓</span>
                        <span>{student.major}</span>
                      </div>
                    )}
                    {student.year && (
                      <div className="flex items-center text-sm text-gray-400">
                        <span className="mr-2">📅</span>
                        <span>Year {student.year}</span>
                      </div>
                    )}
                  </div>

                  {student.skills && student.skills.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {student.skills.slice(0, 4).map((skill, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-teal-600/20 text-teal-400 text-xs rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {student.skills.length > 4 && (
                          <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                            +{student.skills.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>🚀 {student._count.projects} projects</span>
                      <span>👥 {student._count.connections} connections</span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/profile/${student.id}`)}
                    className="w-full mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

BrowseStudents.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default BrowseStudents;
