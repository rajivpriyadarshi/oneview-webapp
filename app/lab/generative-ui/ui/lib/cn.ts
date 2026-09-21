/**
 * The shadcn class merger, scoped to this prototype.
 *
 * `clsx` resolves conditionals; `tailwind-merge` makes the *last* conflicting
 * utility win, which is what lets a caller pass `className="p-0"` to a component
 * whose base styles say `p-6` and actually get `p-0`. Without it both classes land
 * and the winner is whichever Tailwind emitted first — i.e. arbitrary.
 *
 * Lives under the prototype rather than in app/utils because nothing outside
 * /lab/generative-ui uses shadcn, and a shared helper implies otherwise.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
