import PropTypes from 'prop-types';

/**
 * ErrorMessage Component
 */
function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-red-500 font-semibold mb-2">Oops! Something went wrong</p>
      <p className="text-gray-400 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

ErrorMessage.propTypes = {
  message: PropTypes.string.isRequired,
  onRetry: PropTypes.func,
};

export default ErrorMessage;
