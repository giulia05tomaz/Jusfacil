import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "caramel"
  | "outline"
  | "danger"
  | "ghost"
  | "approve"
  | "request_changes";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  fullWidth = false,
  type = "button",
  ...props
}) => {
  const baseStyles =
    "inline-flex min-w-0 max-w-full items-center justify-center font-medium rounded-btn transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-55 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 cursor-pointer select-none";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-jus-petroleum text-white border border-jus-petroleum hover:bg-jus-petroleum-hover active:bg-jus-petroleum-active focus-visible:ring-jus-caramel shadow-sm active:scale-[0.98]",
    secondary:
      "bg-white text-jus-petroleum border-2 border-jus-petroleum hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-jus-caramel active:scale-[0.98]",
    caramel:
      "bg-jus-caramel text-white border border-jus-caramel hover:bg-jus-caramel-hover active:bg-jus-caramel-active focus-visible:ring-jus-petroleum shadow-sm active:scale-[0.98]",
    outline:
      "bg-white text-jus-petroleum border border-jus-border hover:border-jus-petroleum hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-jus-petroleum active:scale-[0.98]",
    danger:
      "bg-white text-jus-danger border border-jus-danger hover:bg-jus-danger-soft active:bg-red-100 focus-visible:ring-jus-danger active:scale-[0.98]",
    ghost:
      "bg-transparent text-jus-darkgray hover:bg-slate-100 hover:text-jus-petroleum active:bg-slate-200 focus-visible:ring-jus-petroleum",
    approve:
      "bg-jus-success-soft text-jus-success border border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200 focus-visible:ring-jus-success active:scale-[0.98] font-semibold",
    request_changes:
      "bg-jus-danger-soft text-jus-danger border border-red-300 hover:bg-red-100 active:bg-red-200 focus-visible:ring-jus-danger active:scale-[0.98] font-semibold",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3.5 py-1.5 text-xs min-h-[36px] gap-1.5",
    md: "px-5 py-2.5 text-sm min-h-[46px] gap-2",
    lg: "px-6 py-3.5 text-base min-h-[52px] gap-2.5",
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current flex-shrink-0" />
      ) : icon ? (
        <span className="flex-shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      {children ? <span className="min-w-0 break-words text-center">{children}</span> : null}
    </button>
  );
};
