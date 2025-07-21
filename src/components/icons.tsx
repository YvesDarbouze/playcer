import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.28 15.19l-3.54-3.54c-.78-.78-.78-2.05 0-2.83l3.54-3.54c.78-.78 2.05-.78 2.83 0l3.54 3.54c.78.78.78 2.05 0 2.83l-3.54 3.54c-.78.79-2.05.79-2.83 0z" />
      <path d="M12 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" opacity=".3" />
    </svg>
  );
}
