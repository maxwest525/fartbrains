// Opens the phone's native Clock/Alarm app pre-filled with the reminder time.
//
// Android: uses an `intent://` URL targeting AlarmClock.ACTION_SET_ALARM.
//   Chrome on Android resolves this to the system Clock app with the hour
//   and minute prefilled and a custom message. The user taps "Save" once
//   and gets a real OS alarm (loud, bypasses silent/DND like any alarm).
//
// iOS: no public URL scheme exists for the Clock app. The honest fallback
//   is to copy the time to the clipboard and tell the user to paste it into
//   Clock > Alarm. (Apple does not allow third parties to set alarms.)

import { toast } from "sonner";

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function formatTime12(d: Date) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Try to open the OS Clock app with an alarm pre-filled for the given
 * date/time. Returns true if a handoff was attempted, false if we showed
 * a manual fallback instead.
 */
export function openPhoneAlarm(when: Date, message: string): boolean {
  const hour = when.getHours();
  const minute = when.getMinutes();
  const msg = encodeURIComponent(message.slice(0, 120) || "Reminder");

  if (isAndroid()) {
    // Android intent URL — Chrome will hand off to the Clock app.
    // S.android.intent.extra.alarm.MESSAGE = string extra
    // i.android.intent.extra.alarm.HOUR/MINUTES = int extras
    const url =
      `intent://#Intent;` +
      `action=android.intent.action.SET_ALARM;` +
      `i.android.intent.extra.alarm.HOUR=${hour};` +
      `i.android.intent.extra.alarm.MINUTES=${minute};` +
      `S.android.intent.extra.alarm.MESSAGE=${msg};` +
      `B.android.intent.extra.alarm.SKIP_UI=false;` +
      `end`;
    window.location.href = url;
    return true;
  }

  // iOS / desktop fallback: copy time, instruct user.
  const timeStr = formatTime12(when);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(timeStr).catch(() => {});
  }
  if (isIOS()) {
    toast.info("iOS can't open Clock from a website", {
      description: `Time ${timeStr} copied. Open Clock → Alarms → + and paste.`,
      duration: 8000,
    });
  } else {
    toast.info("Phone alarm is mobile-only", {
      description: `Time ${timeStr} copied. Open it on your phone.`,
      duration: 6000,
    });
  }
  return false;
}
