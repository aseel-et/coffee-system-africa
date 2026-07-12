import React from 'react';
import { motion } from 'framer-motion';

const SkeletonCard: React.FC = () => (
  <div className="card p-5 space-y-3 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 skeleton rounded-2xl"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 skeleton rounded w-3/4"></div>
        <div className="h-6 skeleton rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="card animate-pulse">
    <div className="p-4 border-b border-stone-100">
      <div className="h-5 skeleton rounded w-1/4"></div>
    </div>
    <div className="divide-y divide-stone-50">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`h-4 skeleton rounded ${j === 0 ? 'flex-1' : 'w-20'}`}></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export { SkeletonCard, SkeletonTable, SkeletonStats };
