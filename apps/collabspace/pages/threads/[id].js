import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { collabspace, auth } from '../../lib/api';

function ThreadPage({ user, setUser }) {
  const router = useRouter();
  const { id } = router.query;
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (id) {
      loadThreadData();
    }
  }, [user, id]);

  async function loadThreadData() {
    try {
      setError(null);
      const threadData = await collabspace.getThread(id);
      setThread(threadData.thread);
      setReplies(threadData.thread.replies || []);
    } catch (err) {
      console.error('Failed to load thread data:', err);
      setError(err.message || 'Failed to load thread data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReply(e) {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await collabspace.createReply(id, replyContent);
      setReplyContent('');
      await loadThreadData();
    } catch (err) {
      console.error('Failed to create reply:', err);
      setError(err.message || 'Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
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

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <LoadingSpinner size="lg" text="Loading thread..." />
        ) : !thread ? (
          <div className="text-center">
            <ErrorMessage message="Thread not found" onRetry={() => router.push('/')} />
          </div>
        ) : (
          <>
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="text-teal-400 hover:text-teal-300 mb-6 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back to Course</span>
            </button>

            {error && (
              <div className="mb-6">
                <ErrorMessage message={error} onRetry={loadThreadData} />
              </div>
            )}

            {/* Thread Post */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
              <h1 className="text-2xl font-bold text-white mb-4">{thread.title}</h1>

              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                  {thread.author.firstName[0]}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {thread.author.firstName} {thread.author.lastName}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {new Date(thread.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{thread.content}</p>
            </div>

            {/* Reply Form */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Post a Reply</h2>
              <form onSubmit={handleSubmitReply}>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Share your thoughts or answer the question..."
                  className="w-full bg-gray-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
                  rows="4"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting || !replyContent.trim()}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Posting...' : 'Post Reply'}
                </button>
              </form>
            </div>

            {/* Replies */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
              </h2>

              {replies.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-gray-400">No replies yet. Be the first to respond!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                    >
                      <div className="flex items-start space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          {reply.author.firstName[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-white font-medium">
                              {reply.author.firstName} {reply.author.lastName}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {new Date(reply.createdAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {reply.content}
                          </p>
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

ThreadPage.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default ThreadPage;
