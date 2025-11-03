import PropTypes from 'prop-types';

/**
 * LoadingSpinner Component
 */
function LoadingSpinner({ size = 'md', text }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div
        className={`${sizes[size]} border-teal-500 border-t-transparent rounded-full animate-spin`}
      />
      {text && <p className="text-gray-400 mt-3">{text}</p>}
    </div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  text: PropTypes.string,
};

export default LoadingSpinner;
