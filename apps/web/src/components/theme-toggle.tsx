import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/shell/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={label}
    >
      {isDark ? <Sun aria-hidden="true" className="size-5" weight="regular" /> : <Moon aria-hidden="true" className="size-5" weight="regular" />}
    </Button>
  );
}
