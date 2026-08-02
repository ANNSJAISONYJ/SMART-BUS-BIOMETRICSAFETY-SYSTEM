export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day > 1 ? 's' : ''} ago`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const roleLabel = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'driver':
      return 'Driver';
    case 'parent':
      return 'Parent / Guardian';
    case 'passenger':
      return 'Passenger';
    default:
      return role;
  }
};

// Simulated fingerprint template generator (demo only).
export function fakeTemplate(prefix: string): string {
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}_${rnd}`;
}
