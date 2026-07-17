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

export function calculateNextRun(
  cronExpression: string,
  fromDate: Date = new Date(),
): Date {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    console.warn(
      `Invalid cron expression: ${cronExpression}. Using default (tomorrow 8am)`,
    );
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
    if (
      !isNaN(targetDayOfWeek) &&
      targetDayOfWeek >= 0 &&
      targetDayOfWeek <= 6
    ) {
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
