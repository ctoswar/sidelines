const palette = [["I", "#1f6b4a"], ["L", "#e8590c"], ["H", "#14213d"], ["R", "#9b2c2c"], ["B", "#6b46c1"]] as const;

export function AvatarStack({ count }: { count: number }) {
  const shown = Math.min(5, count);
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {palette.slice(0, shown).map(([letter, color]) => (
          <span key={letter} className="grid h-6 w-6 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white" style={{ background: color }}>
            {letter}
          </span>
        ))}
        {count > 5 && (
          <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-fg text-[10px] font-bold text-bg">+{count - 5}</span>
        )}
      </div>
      <span className="ml-3 text-xs text-muted">{count} teams joined</span>
    </div>
  );
}
