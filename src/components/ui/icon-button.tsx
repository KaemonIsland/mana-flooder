import * as React from "react";

import { cn } from "@/lib/utils";

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost";
};

const sizeClasses: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-10 w-10 text-base",
};

const variantClasses: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  default:
    "bg-white/10 text-white hover:bg-white/20 hover:brightness-110 ring-1 ring-white/10",
  ghost: "bg-transparent text-white/70 hover:bg-white/10 hover:text-white",
};

function IconButton({
  className,
  size = "sm",
  variant = "default",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-all duration-200 ease-out hover:ring-2 hover:ring-violet-400/40 active:scale-95",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { IconButton };
