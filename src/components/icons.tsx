import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export function Logo(props: SVGProps<SVGSVGElement> & {className?: string}) {
  return (
    <div className={cn("flex items-center gap-2", props.className)}>
        <span
            className="material-symbols-outlined text-primary"
            style={{ fontSize: '1.75em', lineHeight: '1' }}
        >
            motion_play
        </span>
        <span className="font-logo text-2xl font-black tracking-tighter">
            Playcer
        </span>
    </div>
  );
}
