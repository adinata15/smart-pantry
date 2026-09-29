import { CaretDown, Check } from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange" | "type" | "children">;

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function Select({
  options,
  value,
  onChange,
  disabled,
  className,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function closeAndFocusTrigger() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openAt(index: number) {
    if (disabled || options.length === 0) return;
    setActiveIndex(clampIndex(index, options.length));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closeAndFocusTrigger();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        event.preventDefault();
        openAt(selectedIndex);
        return;
      case "Home":
        event.preventDefault();
        openAt(0);
        return;
      case "End":
        event.preventDefault();
        openAt(options.length - 1);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeAndFocusTrigger();
        return;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => clampIndex(index + 1, options.length));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => clampIndex(index - 1, options.length));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", open && "z-40", className)}>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          "flex w-full min-h-11 items-center justify-between gap-2 rounded-2xl border border-input-border bg-background px-3 text-left text-foreground shadow-glass-soft transition-colors duration-200",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onClick={() => (open ? closeAndFocusTrigger() : openAt(selectedIndex))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <CaretDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          weight="regular"
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-activedescendant={`${listboxId}-option-${activeIndex}`}
          tabIndex={-1}
          className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 max-h-60 overflow-y-auto rounded-2xl border border-border bg-background p-1 shadow-glass"
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold text-foreground transition-colors duration-200",
                  isActive || isSelected ? "bg-highlight" : "hover:bg-highlight",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Check aria-hidden="true" className="size-4 shrink-0 text-primary" weight="regular" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
