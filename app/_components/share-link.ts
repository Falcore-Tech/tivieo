export function watchPath(slug: string) {
  return `/v/${slug}`;
}

export function watchUrl(slug: string) {
  if (typeof window === "undefined") return watchPath(slug);
  return `${window.location.origin}${watchPath(slug)}`;
}

export async function copyWatchLink(slug: string) {
  await navigator.clipboard.writeText(watchUrl(slug));
}
