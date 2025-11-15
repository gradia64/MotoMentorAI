import React from 'react';

// A reusable tooltip component that shows a descriptive text on hover.
// It's designed to be simple, using TailwindCSS for styling and positioning.
const Tooltip: React.FC<{ 
    children: React.ReactNode; 
    text: string; 
    className?: string; // Allow passing a className to the wrapper for layout purposes (e.g., flex-grow)
}> = ({ children, text, className = '' }) => {
  return (
    // The 'group' class allows the tooltip to appear when hovering over this container.
    <div className={`relative group ${className}`}>
      {children}
      {/* 
        The tooltip itself. It's hidden by default (opacity-0) and becomes visible 
        on 'group-hover'. 'pointer-events-none' ensures it doesn't interfere with mouse events.
        'w-max' makes it just wide enough for its content.
      */}
      <div 
        className="absolute bottom-full mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded-lg py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20"
        role="tooltip"
      >
        {text}
        {/* This creates the small triangle/arrow at the bottom of the tooltip. */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
      </div>
    </div>
  );
};

export default Tooltip;
