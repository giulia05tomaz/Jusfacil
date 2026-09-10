import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick, hoverable = false }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 transition-all duration-200 ${
        hoverable ? "hover:shadow-md hover:border-jus-petroleum/30 cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
