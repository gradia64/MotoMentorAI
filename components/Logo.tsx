import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className}>
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#2563eb', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#1d4ed8', stopOpacity: 1 }} />
            </linearGradient>
        </defs>
        <rect width="512" height="512" rx="100" fill="url(#grad)" />

        {/* Gear Background (Mechanic) */}
        <path fill="white" opacity="0.2" d="M256 420.5c-90.8 0-164.5-73.7-164.5-164.5S165.2 91.5 256 91.5 420.5 165.2 420.5 256 346.8 420.5 256 420.5zm0-299C181.8 121.5 121.5 181.8 121.5 256S181.8 390.5 256 390.5 390.5 330.2 390.5 256 330.2 121.5 256 121.5z" />
        <path stroke="white" strokeWidth="30" strokeLinecap="round" opacity="0.2" d="M256 60v60M256 392v60M60 256h60M392 256h60M117 117l42 42M353 353l42 42M117 395l42-42M353 159l42-42" />

        {/* Motorcycle Abstract (Trip) */}
        <circle cx="160" cy="340" r="40" stroke="white" strokeWidth="25" fill="none" />
        <circle cx="352" cy="340" r="40" stroke="white" strokeWidth="25" fill="none" />
        <path d="M160 340 L210 200 L300 200 L330 260 L360 260" stroke="white" strokeWidth="25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M210 200 L180 160 L240 160" stroke="white" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* AI Text Badge */}
        <rect x="200" y="270" width="112" height="60" rx="10" fill="#1e40af" stroke="white" strokeWidth="4" />
        <text x="256" y="315" fontFamily="sans-serif" fontWeight="bold" fontSize="40" fill="white" textAnchor="middle">AI</text>
    </svg>
);

export default Logo;