import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-card p-6 border border-slate-200/80 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="pt-2 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC<{ title?: string }> = ({ title }) => {
  return (
    <div className="bg-white rounded-card p-6 border border-slate-200/80 shadow-card space-y-4">
      {title ? (
        <h3 className="text-base font-bold text-jus-petroleum">{title}</h3>
      ) : (
        <Skeleton className="h-5 w-40" />
      )}
      <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2">
        <Skeleton className="h-24 w-full rounded-t-lg" />
        <Skeleton className="h-40 w-full rounded-t-lg" />
        <Skeleton className="h-32 w-full rounded-t-lg" />
        <Skeleton className="h-48 w-full rounded-t-lg" />
        <Skeleton className="h-20 w-full rounded-t-lg" />
        <Skeleton className="h-36 w-full rounded-t-lg" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
};
