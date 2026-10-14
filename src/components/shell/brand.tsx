import { Sprout } from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Sprout size={20} aria-hidden />
      </span>
      mini-habitify<span className="sr-only">home</span>
    </div>
  );
}
