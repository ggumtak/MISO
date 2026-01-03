"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
    const [isVisible, setIsVisible] = React.useState(false);
    const [isTouchDevice, setIsTouchDevice] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout>();
    const longPressRef = React.useRef<NodeJS.Timeout>();

    React.useEffect(() => {
        setIsTouchDevice("ontouchstart" in window);
    }, []);

    const showTooltip = () => {
        timeoutRef.current = setTimeout(() => setIsVisible(true), 200);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (longPressRef.current) clearTimeout(longPressRef.current);
        setIsVisible(false);
    };

    const handleTouchStart = () => {
        longPressRef.current = setTimeout(() => setIsVisible(true), 500);
    };

    const handleTouchEnd = () => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
        setTimeout(() => setIsVisible(false), 1500);
    };

    const positions = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    const arrows = {
        top: "top-full left-1/2 -translate-x-1/2 border-t-card border-x-transparent border-b-transparent",
        bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-card border-x-transparent border-t-transparent",
        left: "left-full top-1/2 -translate-y-1/2 border-l-card border-y-transparent border-r-transparent",
        right: "right-full top-1/2 -translate-y-1/2 border-r-card border-y-transparent border-l-transparent",
    };

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={!isTouchDevice ? showTooltip : undefined}
            onMouseLeave={!isTouchDevice ? hideTooltip : undefined}
            onTouchStart={isTouchDevice ? handleTouchStart : undefined}
            onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
        >
            {children}
            {isVisible && (
                <div
                    className={cn(
                        "absolute z-50 px-3 py-1.5 text-xs font-medium text-foreground bg-card border border-border/60 rounded-lg shadow-lg",
                        "animate-in fade-in zoom-in-95 duration-150",
                        "max-w-[200px] text-center whitespace-normal",
                        positions[side],
                        className
                    )}
                    role="tooltip"
                >
                    {content}
                    <div
                        className={cn(
                            "absolute w-0 h-0 border-4",
                            arrows[side]
                        )}
                    />
                </div>
            )}
        </div>
    );
}

// 도움말 아이콘과 함께 툴팁을 표시하는 컴포넌트
interface HelpTooltipProps {
    content: string;
    side?: "top" | "bottom" | "left" | "right";
}

export function HelpTooltip({ content, side = "top" }: HelpTooltipProps) {
    return (
        <Tooltip content={content} side={side}>
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-muted-foreground bg-muted rounded-full cursor-help hover:bg-muted/80 transition-colors">
                ?
            </span>
        </Tooltip>
    );
}
