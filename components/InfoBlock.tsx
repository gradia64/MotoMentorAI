import React from 'react';

const InfoBlock: React.FC<{ icon: React.ElementType, title: string, content: string }> = ({ icon: Icon, title, content }) => {
    if (!content) return null;
    return (
        <div className="mt-3 flex items-start gap-3">
            <Icon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
                <h5 className="font-semibold text-gray-300">{title}:</h5>
                <p className="text-gray-400 text-sm">{content}</p>
            </div>
        </div>
    );
};

export default InfoBlock;
