import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-700 disabled:border-slate-300 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary:
      "bg-jus-petroleum hover:bg-jus-petroleum-hover text-white focus:ring-jus-petroleum shadow-md hover:shadow-lg",
    secondary:
      "bg-jus-caramel hover:bg-jus-caramel-hover text-jus-petroleum focus:ring-jus-caramel shadow-sm",
    outline:
      "border-2 border-jus-petroleum text-jus-petroleum hover:bg-jus-petroleum-100 focus:ring-jus-petroleum",
    danger:
      "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
    ghost:
      "text-jus-darkgray hover:bg-slate-100 hover:text-jus-petroleum focus:ring-slate-300",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3.5 text-base gap-2.5",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
