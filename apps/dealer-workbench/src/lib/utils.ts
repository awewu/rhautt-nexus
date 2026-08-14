import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn 约定的 className 合并器：clsx 组合 + tailwind-merge 去冲突。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
