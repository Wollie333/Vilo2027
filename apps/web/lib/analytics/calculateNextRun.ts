/**
 * Calculate next run time based on cron expression
 *
 * Supports common patterns:
 * - Daily: "0 8 * * *" (8am every day)
 * - Weekly: "0 8 * * 1" (8am every Monday)
 * - Monthly: "0 8 1 * *" (8am on the 1st of each month)
 *
 * For production with complex cron patterns, consider using a library like cron-parser
 */

export function calculateNextRun(cronExpression: string, fromDate: Date = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    console.warn(`Invalid cron expression: ${cronExpression}. Using default (tomorrow 8am)`);
    return getDefaultNextRun(fromDate);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;

  // Parse hour and minute
  const targetHour = minute === "*" ? 8 : parseInt(minute, 10);
  const targetMinute = hour === "*" ? 0 : parseInt(hour, 10);

  if (isNaN(targetHour) || isNaN(targetMinute)) {
    console.warn(`Invalid time in cron: ${cronExpression}. Using default.`);
    return getDefaultNextRun(fromDate);
  }

  const next = new Date(fromDate);
  next.setHours(targetHour, targetMinute, 0, 0);

  // If we've already passed this time today, start from tomorrow
  if (next <= fromDate) {
    next.setDate(next.getDate() + 1);
  }

  // Handle day of month pattern (e.g., "1" for monthly)
  if (dayOfMonth !== "*") {
    const targetDay = parseInt(dayOfMonth, 10);
    if (!isNaN(targetDay) && targetDay >= 1 && targetDay <= 31) {
      // Move to the target day of month
      while (next.getDate() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
  }

  // Handle day of week pattern (e.g., "1" for Monday)
  if (dayOfWeek !== "*") {
    const targetDayOfWeek = parseInt(dayOfWeek, 10);
    if (!isNaN(targetDayOfWeek) && targetDayOfWeek >= 0 && targetDayOfWeek <= 6) {
      // Move to the next occurrence of target day of week
      while (next.getDay() !== targetDayOfWeek) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
  }

  // Daily pattern (no specific day restrictions)
  return next;
}

/**
 * Default: tomorrow at 8am
 */
function getDefaultNextRun(fromDate: Date): Date {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + 1);
  next.setHours(8, 0, 0, 0);
  return next;
}

/**
 * Get human-readable label for cron expression
 */
export function getCronLabel(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return "Custom";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;

  const hourNum = minute === "*" ? 8 : parseInt(minute, 10);
  const minuteNum = hour === "*" ? 0 : parseInt(hour, 10);
  const timeStr = `${String(hourNum).padStart(2, "0")}:${String(minuteNum).padStart(2, "0")}`;

  // Monthly pattern
  if (dayOfMonth !== "*") {
    const day = parseInt(dayOfMonth, 10);
    if (!isNaN(day)) {
      const suffix = getDaySuffix(day);
      return `Monthly · ${day}${suffix} · ${timeStr}`;
    }
  }

  // Weekly pattern
  if (dayOfWeek !== "*") {
    const dayNum = parseInt(dayOfWeek, 10);
    if (!isNaN(dayNum)) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `Weekly · ${dayNames[dayNum]} · ${timeStr}`;
    }
  }

  // Daily pattern
  return `Daily · ${timeStr}`;
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/**
 * Validate cron expression format
 */
export function isValidCron(cronExpression: string): boolean {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return false;
  }

  // Basic validation: each part should be either "*" or a number
  return parts.every((part) => {
    if (part === "*") return true;
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0;
  });
}
