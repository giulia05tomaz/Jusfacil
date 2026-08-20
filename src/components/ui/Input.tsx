import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  inputVariant?: "boxed" | "underline";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      rightElement,
      inputVariant = "boxed",
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, "-") : undefined);

    const variantStyles =
      inputVariant === "underline"
        ? "bg-transparent border-0 border-b-2 border-slate-300 rounded-none px-1 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-jus-petroleum focus:ring-0 transition-colors"
        : "w-full bg-white border border-slate-300 rounded-xl py-3 px-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-jus-petroleum focus:ring-4 focus:ring-jus-petroleum-50 transition-all shadow-sm";

    const errorStyles =
      inputVariant === "underline"
        ? "border-red-500 focus:border-red-600"
        : "border-red-500 focus:ring-red-100 focus:border-red-500";

    return (
      <div className="w-full min-w-0 max-w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full min-w-0 max-w-full">
          {icon && (
            <div className={`absolute ${inputVariant === "underline" ? "left-1" : "left-3.5"} text-slate-400 pointer-events-none flex items-center justify-center`}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full min-w-0 max-w-full ${variantStyles} ${error ? errorStyles : ""} ${
              icon ? (inputVariant === "underline" ? "pl-8" : "pl-10") : ""
            } ${rightElement ? (inputVariant === "underline" ? "pr-8" : "pr-10") : ""} ${className}`}
            {...props}
          />
          {rightElement && (
            <div className={`absolute ${inputVariant === "underline" ? "right-1" : "right-3.5"} flex items-center text-slate-400`}>
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <span role="alert" className="text-xs text-red-600 font-medium">
            {error}
          </span>
        ) : helperText ? (
          <span className="text-xs text-slate-500">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
