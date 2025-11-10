import PropTypes from 'prop-types';

/**
 * PostCard Component - Displays a single post
 */
function PostCard({ post, onLike, onComment }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all">
      {/* Post Header */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {post.author.firstName[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <p className="text-white font-semibold">
              {post.author.firstName} {post.author.lastName}
            </p>
            {post.group && <span className="text-teal-400 text-sm">→ {post.group.name}</span>}
          </div>
          <p className="text-gray-400 text-sm">
            {new Date(post.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Post Content */}
      <p className="text-white mb-4 leading-relaxed">{post.content}</p>

      {/* Post Media (if any) */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {post.mediaUrls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`Media ${idx + 1}`}
              className="rounded-lg w-full h-48 object-cover"
            />
          ))}
        </div>
      )}

      {/* Post Actions */}
      <div className="flex items-center space-x-6 pt-3 border-t border-gray-700">
        <button
          onClick={() => onLike(post.id)}
          className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors group"
        >
          <span className="text-xl group-hover:scale-110 transition-transform">❤️</span>
          <span className="font-medium">{post._count.likes}</span>
          <span className="text-sm">Likes</span>
        </button>
        <button
          onClick={() => onComment && onComment(post.id)}
          className="flex items-center space-x-2 text-gray-400 hover:text-teal-400 transition-colors group"
        >
          <span className="text-xl group-hover:scale-110 transition-transform">💬</span>
          <span className="font-medium">{post._count.comments}</span>
          <span className="text-sm">Comments</span>
        </button>
        <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors group">
          <span className="text-xl group-hover:scale-110 transition-transform">🔄</span>
          <span className="text-sm">Share</span>
        </button>
      </div>
    </div>
  );
}

PostCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    mediaUrls: PropTypes.arrayOf(PropTypes.string),
    author: PropTypes.shape({
      firstName: PropTypes.string.isRequired,
      lastName: PropTypes.string.isRequired,
    }).isRequired,
    group: PropTypes.shape({
      name: PropTypes.string,
    }),
    _count: PropTypes.shape({
      likes: PropTypes.number.isRequired,
      comments: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
  onLike: PropTypes.func.isRequired,
  onComment: PropTypes.func,
};

export default PostCard;
