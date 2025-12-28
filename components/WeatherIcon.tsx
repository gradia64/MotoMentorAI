import React from 'react';
import { SunIcon, CloudIcon, BoltIcon, CloudArrowDownIcon, SparklesIcon, MoonIcon, Bars4Icon, FlagIcon } from '@heroicons/react/24/outline';

const WeatherIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className = 'w-5 h-5' }) => {
    switch (iconName?.toLowerCase()) {
        case 'sun':
            return <SunIcon className={`${className} text-yellow-400`} />;
        case 'moon':
            return <MoonIcon className={`${className} text-indigo-300`} />;
        case 'partly-cloudy-day':
            // Composite icon
            return (
                <div className={`${className} relative`}>
                    <SunIcon className="absolute top-0 left-0 w-3/4 h-3/4 text-yellow-400" />
                    <CloudIcon className="absolute bottom-0 right-0 w-3/4 h-3/4 text-gray-400" />
                </div>
            );
        case 'partly-cloudy-night':
            // Composite icon
            return (
                <div className={`${className} relative`}>
                    <MoonIcon className="absolute top-0 left-0 w-3/4 h-3/4 text-indigo-300" />
                    <CloudIcon className="absolute bottom-0 right-0 w-3/4 h-3/4 text-gray-400" />
                </div>
            );
        case 'cloud':
            return <CloudIcon className={`${className} text-gray-400`} />;
        case 'rain':
        case 'heavy-rain': // Handle both with same icon
            return <CloudArrowDownIcon className={`${className} text-blue-400`} />;
        case 'storm':
            return <BoltIcon className={`${className} text-yellow-500`} />;
        case 'snow':
            return <SparklesIcon className={`${className} text-cyan-300`} />;
        case 'fog':
             return <Bars4Icon className={`${className} text-gray-500`} />;
        case 'wind':
             return <FlagIcon className={`${className} text-gray-400`} />;
        default:
            // A sensible default if the model returns something unexpected
            return <CloudIcon className={`${className} text-gray-400`} />;
    }
};

export default WeatherIcon;