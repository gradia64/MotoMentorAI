import React from 'react';
import { SunIcon, CloudIcon, BoltIcon, CloudArrowDownIcon, SparklesIcon } from '@heroicons/react/24/outline';

const WeatherIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className = 'w-5 h-5' }) => {
    switch (iconName?.toLowerCase()) {
        case 'sun':
            return <SunIcon className={`${className} text-yellow-400`} />;
        case 'cloud':
            return <CloudIcon className={`${className} text-gray-400`} />;
        case 'rain':
            return <CloudArrowDownIcon className={`${className} text-blue-400`} />;
        case 'storm':
            return <BoltIcon className={`${className} text-yellow-500`} />;
        case 'snow':
            return <SparklesIcon className={`${className} text-cyan-300`} />;
        default:
            return <CloudIcon className={`${className} text-gray-400`} />;
    }
};

export default WeatherIcon;
