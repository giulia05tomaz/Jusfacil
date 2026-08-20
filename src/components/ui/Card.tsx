import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  onClick,
  hoverable = false,
  ...props
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`w-full min-w-0 max-w-full bg-white rounded-card border border-slate-200/80 shadow-card p-5 sm:p-6 transition-all duration-200 ${
        hoverable || isClickable
          ? "hover:shadow-card-lg hover:border-jus-petroleum/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-jus-caramel"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
