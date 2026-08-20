"use client";

import React, { useEffect } from "react";
import { Button } from "./Button";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "caramel" | "approve" | "request_changes";
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
  loading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-card max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
          aria-label="Fechar diálogo"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3">
          <div
            className={`p-3 rounded-full flex-shrink-0 ${
              variant === "danger"
                ? "bg-red-50 text-red-600"
                : "bg-jus-petroleum-100 text-jus-petroleum"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 id="confirm-dialog-title" className="text-lg font-bold text-jus-petroleum font-serif">
              {title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={
              variant === "danger"
                ? "danger"
                : variant === "caramel"
                ? "caramel"
                : variant === "approve"
                ? "approve"
                : variant === "request_changes"
                ? "request_changes"
                : "primary"
            }
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
