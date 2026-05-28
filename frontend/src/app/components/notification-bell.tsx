// src/app/components/notification-bell.tsx

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

interface Notification {
  notification_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  employeeId: number;
}

export function NotificationBell({ employeeId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const fetchNotifications = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/notifications/${employeeId}`,
      );

      if (!res.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const fetchAllNotifications = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/notifications/all/${employeeId}`,
      );

      if (!res.ok) {
        throw new Error("Failed to fetch all notifications");
      }

      const data = await res.json();
      setAllNotifications(Array.isArray(data) ? data : []);
      setViewAllOpen(true);
    } catch (err) {
      console.error("Failed to fetch all notifications", err);
    }
  };

  useEffect(() => {
    if (!employeeId) return;

    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [employeeId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllAsRead = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/notifications/${employeeId}/read-all`,
        {
          method: "PUT",
        },
      );

      if (!res.ok) {
        throw new Error("Failed to mark notifications as read");
      }

      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex size-9 items-center justify-center rounded-md border bg-white hover:bg-gray-100"
      >
        <Bell className="size-4" />

        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-[9999] rounded-md border bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Notifications</h3>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500">No notifications</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  className={`border rounded-lg p-3 ${
                    notification.is_read ? "bg-white" : "bg-blue-50"
                  }`}
                >
                  <p className="font-medium text-sm">{notification.title}</p>

                  <p className="text-sm text-gray-600">
                    {notification.message}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={fetchAllNotifications}
            className="mt-3 w-full text-sm text-blue-600 hover:underline"
          >
            View all notifications
          </button>
        </div>
      )}
      {viewAllOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-md bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">All Notifications</h3>

              <button
                type="button"
                onClick={() => setViewAllOpen(false)}
                className="text-sm text-gray-600 hover:underline"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {allNotifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  className={`border rounded-lg p-3 ${
                    notification.is_read ? "bg-white" : "bg-blue-50"
                  }`}
                >
                  <p className="font-medium text-sm">{notification.title}</p>

                  <p className="text-sm text-gray-600">
                    {notification.message}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}