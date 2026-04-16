import React from 'react';

export const PEALogo = ({ className }: { className?: string }) => (
    <div className={`rounded-3xl bg-violet-700 p-3 inline-flex items-center justify-center ${className ?? ''}`}>
        <img src="/favicon.png" alt="PEA Explorer Logo" className="object-contain scale-125 w-14 h-14" />
    </div>
);
