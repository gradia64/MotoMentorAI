import React from 'react';

const Spinner: React.FC = () => (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
);

const ActionButton: React.FC<{ 
    onClick?: () => void; 
    children: React.ReactNode; 
    disabled?: boolean; 
    className?: string, 
    type?: 'button' | 'submit',
    loading?: boolean,
    loadingText?: string,
} & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ onClick, children, disabled, className = '', type = 'button', loading = false, loadingText, ...props }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors ${className}`}
        // Fix: Spread additional props (like 'title') onto the button element.
        {...props}
    >
        {loading ? (
            <>
                <Spinner />
                {loadingText && <span>{loadingText}</span>}
            </>
        ) : (
            children
        )}
    </button>
);

export default ActionButton;