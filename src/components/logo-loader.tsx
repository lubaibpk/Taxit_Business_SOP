/* eslint-disable @next/next/no-img-element */

/** Full-screen loading screen with the firm's logo: a soft pulse inside a turning ring. */
export function LogoLoader({ label = "Loading…", overlay = false }: { label?: string; overlay?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-5 ${overlay ? "fixed inset-0 z-50 bg-white/75 backdrop-blur-sm loader-fade" : "min-h-[60vh]"}`}
    >
      <div className="relative h-28 w-28">
        <span className="loader-ring absolute inset-0 rounded-full border-4 border-[#e7eaf3] border-t-[#F5C400]" />
        <img src="/logo.png" alt="" className="loader-pulse absolute inset-4 h-20 w-20 object-contain" />
      </div>
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
  );
}
