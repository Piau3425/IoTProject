import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function formatTimeWithHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parse and validate numeric input from text fields.
 * Strips non-digit characters and clamps to optional min/max.
 */
export function parseNumericInput(
  value: string,
  options?: { min?: number; max?: number; defaultValue?: number }
): number {
  const { min = 0, max, defaultValue = 0 } = options ?? {}
  const cleaned = value.replace(/[^0-9]/g, '')
  if (cleaned === '') return defaultValue
  let num = parseInt(cleaned, 10)
  num = Math.max(min, num)
  if (max !== undefined) num = Math.min(max, num)
  return num
}
