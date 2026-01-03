"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Keyboard } from "lucide-react";
import { Button } from "./button";
import { VirtualNumpad, useVirtualNumpad } from "./VirtualNumpad";

interface NumberInputProps {
    value: string;
    onChange: (value: string) => void;
    min?: number;
    max?: number;
    step?: number;
    allowDecimal?: boolean;
    suffix?: string;
    className?: string;
    inputClassName?: string;
    error?: boolean;
    showControls?: boolean;
    showNumpad?: boolean;
}

export function NumberInput({
    value,
    onChange,
    min,
    max,
    step = 1,
    allowDecimal = true,
    suffix,
    className,
    inputClassName,
    error = false,
    showControls = true,
    showNumpad = true,
}: NumberInputProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const numpad = useVirtualNumpad();

    const numValue = parseFloat(value) || 0;

    const clamp = (val: number) => {
        let result = val;
        if (min !== undefined) result = Math.max(min, result);
        if (max !== undefined) result = Math.min(max, result);
        return result;
    };

    const increment = () => {
        const newValue = clamp(numValue + step);
        onChange(allowDecimal ? newValue.toString() : Math.round(newValue).toString());
    };

    const decrement = () => {
        const newValue = clamp(numValue - step);
        onChange(allowDecimal ? newValue.toString() : Math.round(newValue).toString());
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            increment();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            decrement();
        }
    };

    const openNumpad = () => {
        if (inputRef.current) {
            numpad.open(inputRef.current, value, onChange, allowDecimal);
        }
    };

    return (
        <>
            <div className={cn("relative flex items-center group", className)}>
                <input
                    ref={inputRef}
                    type="text"
                    inputMode={allowDecimal ? "decimal" : "numeric"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono",
                        "ring-offset-background placeholder:text-muted-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "transition-all duration-200",
                        error && "border-destructive text-destructive focus-visible:ring-destructive/40",
                        suffix && "pr-8",
                        showControls && "pr-16",
                        inputClassName
                    )}
                />

                {suffix && !showControls && (
                    <span className="absolute right-3 text-xs text-muted-foreground pointer-events-none">
                        {suffix}
                    </span>
                )}

                {showControls && (
                    <div className="absolute right-1 flex items-center gap-0.5">
                        {showNumpad && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={openNumpad}
                            >
                                <Keyboard className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        <div className="flex flex-col">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-6 text-muted-foreground hover:text-primary"
                                onClick={increment}
                                tabIndex={-1}
                            >
                                <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-6 text-muted-foreground hover:text-primary"
                                onClick={decrement}
                                tabIndex={-1}
                            >
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </div>
                        {suffix && (
                            <span className="text-xs text-muted-foreground ml-1 mr-1">
                                {suffix}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <VirtualNumpad
                isOpen={numpad.isOpen}
                onClose={numpad.close}
                onInput={numpad.handleInput}
                onBackspace={numpad.handleBackspace}
                onClear={numpad.handleClear}
                onSubmit={numpad.close}
                currentValue={numpad.currentValue}
                allowDecimal={numpad.allowDecimal}
                position={numpad.position}
            />
        </>
    );
}
