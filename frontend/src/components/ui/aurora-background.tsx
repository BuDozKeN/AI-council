"use client";
import { cn } from "@/lib/utils";

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}) => {
  return (
    <div
      className={cn(
        "aurora-container",
        className
      )}
      {...props}
    >
      <div className="aurora-overlay">
        <div
          className={cn(
            "aurora-gradient",
            showRadialGradient && "aurora-radial-mask"
          )}
        ></div>
      </div>
      {children}
    </div>
  );
};
