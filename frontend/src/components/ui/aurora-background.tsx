"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string | undefined;
  children?: React.ReactNode | undefined;
  showRadialGradient?: boolean | undefined;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
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
