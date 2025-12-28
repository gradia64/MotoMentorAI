import React, { ChangeEvent } from 'react';

const SelectField: React.FC<{ id: string; label: string; value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; }> = ({ id, label, value, onChange, children }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300">{label}</label>
        <div className="mt-1">
            <select
                id={id}
                value={value}
                onChange={onChange}
                className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
                {children}
            </select>
        </div>
    </div>
);

export default SelectField;
