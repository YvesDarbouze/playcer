
import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export function Logo(props: SVGProps<SVGSVGElement> & {className?: string}) {
  return (
    <div className={cn("flex items-center justify-center gap-2", props.className)}>
        <span className="font-headline text-2xl font-black tracking-tighter text-primary">
            Playcer
        </span>
    </div>
  );
}
