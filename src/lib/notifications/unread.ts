import type { NotificationItem } from "@/types";

export function countUnreadNotifications(items: Pick<NotificationItem, "read">[]): number {
  return items.reduce((count, item) => count + (item.read ? 0 : 1), 0);
}
