import React from 'react';

const TabButton: React.FC<{text: string; icon: React.ReactNode; active: boolean; onClick: () => void}> = ({text, icon, active, onClick}) => (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 p-4 text-sm font-semibold transition-colors focus:outline-none ${active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
        {icon}
        <span className="hidden md:inline">{text}</span>
    </button>
);

export default TabButton;
