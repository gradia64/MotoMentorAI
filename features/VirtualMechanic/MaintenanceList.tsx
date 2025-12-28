import React from 'react';

const MaintenanceList: React.FC<{title: string; items: string[]}> = ({ title, items }) => (
    <div className="bg-gray-700/50 p-4 rounded-lg">
        <h3 className="text-xl font-semibold text-blue-400">{title}</h3>
        <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    </div>
);

export default MaintenanceList;
