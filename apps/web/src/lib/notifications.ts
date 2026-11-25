/** Local class reminders + push permission. Push provider integration point:
 *  register your service worker push subscription with your backend here. */
export async function enableReminders() {
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

export function scheduleClassReminders(sessions: any[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  sessions.forEach((s) => {
    const at = new Date(s.starts_at).getTime() - 10 * 60000;
    const delay = at - Date.now();
    if (delay <= 0 || delay > 7 * 86400000) return;
    setTimeout(async () => {
      const registration = await navigator.serviceWorker?.ready;
      const body = `Your ${s.batch_name || 'German'} class starts in 10 minutes.`;
      if (registration) registration.showNotification('Class starting soon', { body, icon: '/icon-192.png', tag: `class-${s.id}` });
      else new Notification('Class starting soon', { body, icon: '/icon-192.png' });
    }, delay);
  });
}
