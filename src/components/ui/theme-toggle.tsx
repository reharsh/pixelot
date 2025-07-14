import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from './button';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-full"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
} 