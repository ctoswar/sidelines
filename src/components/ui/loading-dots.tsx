export function LoadingDots({ label = "Loading" }: { label?: string }) {
  return (
    <span className="loading-dots" aria-label={label}>
      {label}<span aria-hidden="true"><i /> <i /> <i /></span>
    </span>
  );
}
