"use client";
import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the form is saving, so it can't create duplicates. */
export function SubmitButton({ children, pendingText = "Please wait…", className = "btn" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
