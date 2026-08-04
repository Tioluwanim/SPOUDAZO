"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed";

const variants = {
  primary:
    "relative overflow-hidden bg-gold text-[#2B2B2B] shadow-gold hover:bg-gold-deep hover:shadow-gold-lg active:scale-[0.98] before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent hover:before:translate-x-full before:transition-transform before:duration-700",
  outline:
    "border border-gold/50 bg-ink-soft text-paper hover:border-gold hover:bg-gold/5",
  ghost: "text-paper-dim hover:text-paper hover:bg-ink-surface",
  danger: "bg-danger/90 text-white hover:bg-danger",
};

const sizes = {
  sm: "text-sm px-4 py-2",
  md: "text-sm px-6 py-3",
  lg: "text-base px-8 py-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
