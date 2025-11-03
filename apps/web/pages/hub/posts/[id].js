import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../../components/Navbar';
import PostCard from '../../../components/PostCard';
import CommentSection from '../../../components/CommentSection';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { hub, auth } from '../../../lib/api';

function PostDetail({ user, setUser }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id && user) {
      loadPost();
      loadComments();
    }
  }, [id, user]);

  async function loadPost() {
    try {
      setError(null);
      const data = await hub.getPost(id);
      setPost(data.post);
    } catch (err) {
      console.error('Failed to load post:', err);
      setError(err.message || 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    try {
      setLoadingComments(true);
      const data = await hub.getComments(id);
      setComments(data.comments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleLike(postId) {
    try {
      await hub.likePost(postId);
      await loadPost();
    } catch (err) {
      console.error('Failed to like post:', err);
      setError(err.message || 'Failed to like post');
    }
  }

  async function handleCommentAdded(postId, content, parentId = null) {
    try {
      await hub.createComment(postId, content, parentId);
      await loadComments();
      await loadPost(); // Refresh to update comment count
    } catch (err) {
      console.error('Failed to add comment:', err);
      throw err;
    }
  }

  async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This will also delete all comments.')) return;

    try {
      await hub.deletePost(postId);
      router.push('/hub'); // Redirect to hub after deleting
    } catch (err) {
      console.error('Failed to delete post:', err);
      setError(err.message || 'Failed to delete post. Please try again.');
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <LoadingSpinner size="lg" text="Loading post..." />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <ErrorMessage message={error || 'Post not found'} onRetry={loadPost} />
          <div className="mt-4">
            <button
              onClick={() => router.push('/hub')}
              className="text-teal-400 hover:text-teal-300 transition-colors"
            >
              ← Back to Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/hub')}
          className="text-gray-400 hover:text-white mb-4 text-sm transition-colors"
        >
          ← Back to Hub
        </button>

        {/* Post */}
        <div className="mb-6">
          <PostCard
            post={post}
            onLike={handleLike}
            onDelete={handleDeletePost}
            currentUserId={user.id}
          />
        </div>

        {/* Comments Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4 text-lg">
            Comments ({post._count.comments})
          </h3>
          {loadingComments ? (
            <LoadingSpinner size="md" text="Loading comments..." />
          ) : (
            <CommentSection
              postId={post.id}
              comments={comments}
              onCommentAdded={handleCommentAdded}
            />
          )}
        </div>
      </div>
    </div>
  );
}

PostDetail.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default PostDetail;
