import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../../components/Navbar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { collabspace, auth } from '../../../lib/api';

function CoursePage({ user, setUser }) {
  const router = useRouter();
  const { id } = router.query;
  const [course, setCourse] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showThreadForm, setShowThreadForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  useEffect(() => {
    if (user && id) {
      loadCourseData();
    }
  }, [user, id]);

  async function loadCourseData() {
    try {
      setError(null);
      const [coursesData, threadsData] = await Promise.all([
        collabspace.getCourses(),
        collabspace.getThreads(id),
      ]);
      const foundCourse = coursesData.courses.find((c) => c.id === id);
      setCourse(foundCourse);
      setThreads(threadsData.threads);
    } catch (err) {
      console.error('Failed to load course data:', err);
      setError(err.message || 'Failed to load course data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateThread(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      await collabspace.createThread({
        courseId: id,
        title: formData.title,
        content: formData.content,
      });
      setFormData({ title: '', content: '' });
      setShowThreadForm(false);
      await loadCourseData();
    } catch (err) {
      console.error('Failed to create thread:', err);
      setError(err.message || 'Failed to create thread. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
  }

  

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <LoadingSpinner size="lg" text="Loading course..." />
        ) : !course ? (
          <div className="text-center">
            <ErrorMessage message="Course not found" onRetry={() => router.push('/collabspace')} />
          </div>
        ) : (
          <>
            {/* Course Header */}
            <div className="mb-8">
              <button
                onClick={() => router.push('/collabspace')}
                className="text-teal-400 hover:text-teal-300 mb-4 flex items-center space-x-2"
              >
                <span>←</span>
                <span>Back to Courses</span>
              </button>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-teal-400 font-bold mb-1">{course.code}</div>
                  <h1 className="text-3xl font-bold text-white mb-2">{course.name}</h1>
                  {course.description && (
                    <p className="text-gray-400">{course.description}</p>
                  )}
                </div>
                {!showThreadForm && (
                  <button
                    onClick={() => setShowThreadForm(true)}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    New Thread
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6">
                <ErrorMessage message={error} onRetry={loadCourseData} />
              </div>
            )}

            {/* New Thread Form */}
            {showThreadForm && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Create New Thread</h2>
                <form onSubmit={handleCreateThread} className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Thread Title</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="What's your question or topic?"
                      className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2">Content</label>
                    <textarea
                      name="content"
                      value={formData.content}
                      onChange={handleChange}
                      placeholder="Provide details about your question or discussion topic..."
                      className="w-full bg-gray-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      rows="6"
                      required
                    />
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? 'Creating...' : 'Create Thread'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowThreadForm(false);
                        setFormData({ title: '', content: '' });
                      }}
                      disabled={creating}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Threads List */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Discussion Threads</h2>
              {threads.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-white text-xl font-semibold mb-2">No threads yet</h3>
                  <p className="text-gray-400 mb-6">
                    Start the conversation by creating the first discussion thread
                  </p>
                  {!showThreadForm && (
                    <button
                      onClick={() => setShowThreadForm(true)}
                      className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Create First Thread
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {threads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => router.push(`/collabspace/threads/${thread.id}`)}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-white font-semibold text-lg flex-1 pr-4">
                          {thread.title}
                        </h3>
                        <span className="text-gray-400 text-sm whitespace-nowrap">
                          {new Date(thread.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {thread.content}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs">
                              {thread.author.firstName[0]}
                            </div>
                            <span className="text-gray-400 text-sm">
                              {thread.author.firstName} {thread.author.lastName}
                            </span>
                          </div>
                        </div>
                        <div className="text-gray-400 text-sm">
                          💬 {thread._count.replies} replies
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

CoursePage.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default CoursePage;
