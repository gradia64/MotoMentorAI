import React, { ChangeEvent } from 'react';

const InputField: React.FC<{ id: string; label: string; value: string | number; onChange: (e: ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean; type?: string }> = ({ id, label, value, onChange, placeholder, required, type = 'text' }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300">{label}</label>
        <div className="mt-1">
            <input
                type={type}
                id={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                className="block w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
        </div>
    </div>
);

export default InputField;
