import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PropTypes from 'prop-types';
import Navbar from '../../../components/Navbar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { collabspace, auth } from '../../../lib/api';

function ThreadPage({ user, setUser }) {
  const router = useRouter();
  const { id } = router.query;
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) {
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

  async function handleEditReply(replyId) {
    setSaving(true);
    setError(null);

    try {
      await collabspace.updateReply(replyId, editContent);
      setEditingReplyId(null);
      setEditContent('');
      await loadThreadData();
    } catch (err) {
      console.error('Failed to edit reply:', err);
      setError(err.message || 'Failed to edit reply. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteReply(replyId) {
    if (!confirm('Are you sure you want to delete this reply?')) return;

    setError(null);

    try {
      await collabspace.deleteReply(replyId);
      await loadThreadData();
    } catch (err) {
      console.error('Failed to delete reply:', err);
      setError(err.message || 'Failed to delete reply. Please try again.');
    }
  }

  function startEditingReply(reply) {
    setEditingReplyId(reply.id);
    setEditContent(reply.content);
  }

  function cancelEditing() {
    setEditingReplyId(null);
    setEditContent('');
  }

  async function handleDeleteThread() {
    if (!confirm('Are you sure you want to delete this thread? This will also delete all replies.'))
      return;

    setError(null);

    try {
      await collabspace.deleteThread(id);
      router.push(`/collabspace/courses/${thread.course.id}`);
    } catch (err) {
      console.error('Failed to delete thread:', err);
      setError(err.message || 'Failed to delete thread');
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <LoadingSpinner size="lg" text="Loading thread..." />
        ) : !thread ? (
          <div className="text-center">
            <ErrorMessage message="Thread not found" onRetry={() => router.push('/collabspace')} />
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
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-2xl font-bold text-white flex-1">{thread.title}</h1>
                {user && thread.author.id === user.id && (
                  <button
                    onClick={handleDeleteThread}
                    className="text-gray-400 hover:text-red-400 text-sm transition-colors"
                  >
                    Delete Thread
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3 mb-4">
                <Link href={`/hub/users/${thread.author.id}`}>
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:opacity-80 transition-opacity">
                    {thread.author.firstName[0]}
                  </div>
                </Link>
                <div>
                  <Link href={`/hub/users/${thread.author.id}`}>
                    <p className="text-white font-medium hover:text-teal-400 transition-colors cursor-pointer">
                      {thread.author.firstName} {thread.author.lastName}
                    </p>
                  </Link>
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
                  {replies.map((reply) => {
                    const isAuthor = user && reply.author.id === user.id;
                    const isEditing = editingReplyId === reply.id;

                    return (
                      <div
                        key={reply.id}
                        className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                      >
                        <div className="flex items-start space-x-3">
                          <Link href={`/hub/users/${reply.author.id}`}>
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                              {reply.author.firstName[0]}
                            </div>
                          </Link>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <Link href={`/hub/users/${reply.author.id}`}>
                                <p className="text-white font-medium hover:text-teal-400 transition-colors cursor-pointer">
                                  {reply.author.firstName} {reply.author.lastName}
                                </p>
                              </Link>
                              <p className="text-gray-400 text-sm">
                                {new Date(reply.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>

                            {isEditing ? (
                              <div className="mt-3">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full bg-gray-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-3"
                                  rows="3"
                                  autoFocus
                                />
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={cancelEditing}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleEditReply(reply.id)}
                                    disabled={saving || !editContent.trim()}
                                    className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap mb-2">
                                  {reply.content}
                                </p>

                                {isAuthor && (
                                  <div className="flex items-center space-x-4 text-xs mt-2">
                                    <button
                                      onClick={() => startEditingReply(reply)}
                                      className="text-gray-400 hover:text-blue-400 transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteReply(reply.id)}
                                      className="text-gray-400 hover:text-red-400 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
