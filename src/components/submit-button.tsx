"use client";
import { useFormStatus } from "react-dom";

/** Submit button that shows a spinner and disables itself while the form is saving, so it can't create duplicates. */
export function SubmitButton({ children, pendingText = "Please wait…", className = "btn" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
