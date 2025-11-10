import { useState } from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import { hub } from '../lib/api';

/**
 * Single Comment Component with reply functionality
 */
function Comment({ comment, onReply, onEdit, onDelete, currentUserId, depth = 0 }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const isAuthor = comment.author.id === currentUserId;

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      await onReply(comment.id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Failed to reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    setSaving(true);
    try {
      await onEdit(comment.id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to edit comment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await onDelete(comment.id);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const marginLeft = depth > 0 ? 'ml-8' : '';
  const showBorder = depth > 0;

  return (
    <div className={`${marginLeft} ${showBorder ? 'border-l-2 border-gray-700 pl-4' : ''}`}>
      <div className="bg-gray-800 rounded-lg p-4 mb-3">
        {/* Comment Header */}
        <div className="flex items-center space-x-3 mb-2">
          <Link href={`/hub/users/${comment.author.id}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-700 rounded-full flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:opacity-80 transition-opacity">
              {comment.author.firstName[0]}
            </div>
          </Link>
          <div className="flex-1">
            <Link href={`/hub/users/${comment.author.id}`}>
              <p className="text-white font-medium text-sm hover:text-teal-400 transition-colors cursor-pointer">
                {comment.author.firstName} {comment.author.lastName}
              </p>
            </Link>
            <p className="text-gray-400 text-xs">
              {new Date(comment.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Comment Content */}
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="mb-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              rows="2"
              autoFocus
            />
            <div className="mt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                className="px-3 py-1 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !editContent.trim()}
                className="px-4 py-1 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-200 text-sm mb-2 leading-relaxed">{comment.content}</p>
        )}

        {/* Comment Actions */}
        {!isEditing && (
          <div className="flex items-center space-x-4 text-xs">
            {depth < 2 && ( // Limit nesting to 2 levels
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-gray-400 hover:text-teal-400 transition-colors"
              >
                {showReplyForm ? 'Cancel' : 'Reply'}
              </button>
            )}
            {isAuthor && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-blue-400 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
            {comment._count?.replies > 0 && (
              <span className="text-gray-400">
                {comment._count.replies} {comment._count.replies === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>
        )}

        {/* Reply Form */}
        {showReplyForm && (
          <form onSubmit={handleReplySubmit} className="mt-3">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="w-full bg-gray-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              rows="2"
              autoFocus
            />
            <div className="mt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent('');
                }}
                className="px-3 py-1 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !replyContent.trim()}
                className="px-4 py-1 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Replying...' : 'Reply'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              currentUserId={currentUserId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

Comment.propTypes = {
  comment: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    author: PropTypes.shape({
      id: PropTypes.string.isRequired,
      firstName: PropTypes.string.isRequired,
      lastName: PropTypes.string.isRequired,
      photoUrl: PropTypes.string,
    }).isRequired,
    replies: PropTypes.array,
    _count: PropTypes.shape({
      replies: PropTypes.number,
    }),
  }).isRequired,
  onReply: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  currentUserId: PropTypes.string,
  depth: PropTypes.number,
};

/**
 * CommentSection Component - Displays all comments and handles new comments
 */
function CommentSection({ postId, comments, onCommentAdded, onCommentsUpdated }) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      await onCommentAdded(postId, newComment);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
      setError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId, content) => {
    await onCommentAdded(postId, content, parentId);
  };

  const handleEdit = async (commentId, content) => {
    await hub.updateComment(commentId, content);
    if (onCommentsUpdated) {
      await onCommentsUpdated(postId);
    }
  };

  const handleDelete = async (commentId) => {
    await hub.deleteComment(commentId);
    if (onCommentsUpdated) {
      await onCommentsUpdated(postId);
    }
  };

  // Get current user ID from user context (passed via page)
  const currentUserId =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('maestro_user') || '{}').id
      : null;

  return (
    <div className="space-y-4">
      {/* New Comment Form */}
      <form
        onSubmit={handleCommentSubmit}
        className="bg-gray-800 rounded-lg p-4 border border-gray-700"
      >
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="w-full bg-gray-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          rows="3"
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}

CommentSection.propTypes = {
  postId: PropTypes.string.isRequired,
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
      createdAt: PropTypes.string.isRequired,
      author: PropTypes.shape({
        firstName: PropTypes.string.isRequired,
        lastName: PropTypes.string.isRequired,
      }).isRequired,
      replies: PropTypes.array,
    })
  ).isRequired,
  onCommentAdded: PropTypes.func.isRequired,
  onCommentsUpdated: PropTypes.func,
};

export default CommentSection;
