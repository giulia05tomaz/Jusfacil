import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`bg-white rounded-card border border-dashed border-slate-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-jus-petroleum">
        <Icon className="w-7 h-7" />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-bold text-jus-petroleum">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
      {actionText && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
