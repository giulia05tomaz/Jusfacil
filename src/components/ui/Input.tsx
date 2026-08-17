import React, { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, rightElement, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-white border ${
              error ? "border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-jus-petroleum focus:ring-jus-petroleum-100"
            } rounded-lg ${icon ? "pl-10" : "pl-4"} ${rightElement ? "pr-10" : "pr-4"} py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 transition-all duration-150 ${className}`}
            {...props}
          />
          {rightElement && <div className="absolute right-3.5 flex items-center">{rightElement}</div>}
        </div>
        {error ? (
          <span className="text-xs text-red-600 font-medium">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-slate-500">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
