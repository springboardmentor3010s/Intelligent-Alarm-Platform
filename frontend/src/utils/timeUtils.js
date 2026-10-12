/**
 * Utilities for time of day, alarm time formatting, and dynamic greetings.
 */

/**
 * Returns current time-of-day information based on the user's local system clock (or optional hour).
 */
export function getTimeOfDayGreeting(overrideDate = null) {
  const now = overrideDate ? new Date(overrideDate) : new Date();
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      period: "Morning",
      greeting: "Good Morning",
      icon: "🌅",
      dashboardTitle: "Dashboard",
      smallLabel: "YOUR DASHBOARD",
      subtitle: "Ready to start your day with an active mind?",
      badgeClass: "time-pill-morning"
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      period: "Afternoon",
      greeting: "Good Afternoon",
      icon: "☀️",
      dashboardTitle: "Dashboard",
      smallLabel: "YOUR DASHBOARD",
      subtitle: "Keep your focus sharp with a quick cognitive check-in!",
      badgeClass: "time-pill-afternoon"
    };
  } else {
    return {
      period: "Evening",
      greeting: "Good Evening",
      icon: "🌙",
      dashboardTitle: "Dashboard",
      smallLabel: "YOUR DASHBOARD",
      subtitle: "Unwind your day and maintain your active streak!",
      badgeClass: "time-pill-evening"
    };
  }
}

/**
 * Parses time string (e.g. "07:00", "14:30", "20:15", "7:00 AM") and returns formatted 12-hour display and period metadata.
 */
export function formatAlarmTime(timeStr) {
  if (!timeStr) {
    return {
      displayTime: "07:00 AM",
      period: "Morning",
      periodLabel: "Morning Alarm",
      periodIcon: "🌅"
    };
  }

  const str = String(timeStr).trim();

  // If already formatted like "07:00 AM" or "2:30 PM"
  if (str.toUpperCase().includes("AM") || str.toUpperCase().includes("PM")) {
    const isPM = str.toUpperCase().includes("PM");
    const parts = str.split(":");
    let hour = parseInt(parts[0], 10) || 7;
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    let period = "Morning";
    let periodIcon = "🌅";
    if (hour >= 12 && hour < 17) {
      period = "Afternoon";
      periodIcon = "☀️";
    } else if (hour >= 17 || hour < 5) {
      period = "Evening";
      periodIcon = "🌙";
    }

    return {
      displayTime: str,
      period,
      periodLabel: `${period} Alarm`,
      periodIcon
    };
  }

  // Parse "HH:mm" (24-hour format)
  const parts = str.split(":");
  if (parts.length >= 2) {
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);

    if (!isNaN(hour) && !isNaN(minute)) {
      const ampm = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
      const formattedMin = minute < 10 ? `0${minute}` : minute;
      const displayTime = `${formattedHour}:${formattedMin} ${ampm}`;

      let period = "Morning";
      let periodIcon = "🌅";
      if (hour >= 12 && hour < 17) {
        period = "Afternoon";
        periodIcon = "☀️";
      } else if (hour >= 17 || hour < 5) {
        period = "Evening";
        periodIcon = "🌙";
      }

      return {
        displayTime,
        period,
        periodLabel: `${period} Alarm`,
        periodIcon
      };
    }
  }

  return {
    displayTime: str,
    period: "Morning",
    periodLabel: "Morning Alarm",
    periodIcon: "🌅"
  };
}

/**
 * Returns suggested alarm title based on time of day (e.g. 07:00 -> Morning Wake-Up, 14:00 -> Afternoon Focus, 20:00 -> Evening Focus)
 */
export function getDefaultTitleForTime(timeStr) {
  const meta = formatAlarmTime(timeStr);
  if (meta.period === "Afternoon") return "Afternoon Focus";
  if (meta.period === "Evening") return "Evening Focus";
  return "Morning Wake-Up";
}

export function parseTo12HourComponents(timeStr) {
  if (!timeStr) {
    return { hour: "07", minute: "00", ampm: "AM" };
  }

  const str = String(timeStr).trim();

  // If already in 12h format like "7:00 AM" or "02:30 PM"
  if (str.toUpperCase().includes("AM") || str.toUpperCase().includes("PM")) {
    const isPM = str.toUpperCase().includes("PM");
    const cleanStr = str.replace(/(AM|PM)/i, "").trim();
    const parts = cleanStr.split(":");
    let h = parseInt(parts[0], 10) || 12;
    if (h > 12) h = h % 12 || 12;
    if (h === 0) h = 12;
    const m = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
    return {
      hour: h.toString().padStart(2, "0"),
      minute: m.toString().padStart(2, "0"),
      ampm: isPM ? "PM" : "AM"
    };
  }

  // Parse "HH:mm" (24-hour format)
  const parts = str.split(":");
  if (parts.length >= 2) {
    const rawH = parseInt(parts[0], 10) || 0;
    const rawM = parseInt(parts[1], 10) || 0;

    const ampm = rawH >= 12 ? "PM" : "AM";
    let h = rawH % 12;
    if (h === 0) h = 12;

    return {
      hour: h.toString().padStart(2, "0"),
      minute: rawM.toString().padStart(2, "0"),
      ampm
    };
  }

  return { hour: "07", minute: "00", ampm: "AM" };
}

export function convertTo24Hour(hour12, minute, ampm) {
  let h = parseInt(hour12, 10) || 12;
  const m = parseInt(minute, 10) || 0;
  const isPM = String(ampm).toUpperCase() === "PM";

  if (isPM) {
    if (h < 12) h += 12;
  } else {
    if (h === 12) h = 0;
  }

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function parseTo24Hour(timeStr) {
  const comps = parseTo12HourComponents(timeStr);
  return convertTo24Hour(comps.hour, comps.minute, comps.ampm);
}


