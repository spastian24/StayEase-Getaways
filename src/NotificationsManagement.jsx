import CalendarControl from "./CalendarControl.jsx";
import "./NotificationsManagement.css";
import notificationIcon from "./assets/notification.png";

export default function NotificationsManagement({ notifications, calendarDate, setCalendarDate, onOpenNotifications, unreadCount, onMarkAllRead, onNotificationClick, onDeleteNotification }) {
  const unread = notifications.filter((notification) => notification.unread).length;

  return (
    <main className="admin-main notifications-page">
      <header className="admin-topbar">
        <div className="admin-welcome"><span className="admin-page-label">STAYEASE ADMINISTRATION / NOTIFICATIONS</span><h1>Notifications</h1><p>View and manage booking, payment, housekeeping, and system notifications.</p></div>
        <div className="admin-topbar-right"><button className="admin-notification-box" onClick={onOpenNotifications}><img className="notification-icon-box" src={notificationIcon} alt="Notifications" /><div><strong>{unreadCount} Notifications</strong><span>{unreadCount} unread notifications</span></div></button><CalendarControl value={calendarDate} onChange={setCalendarDate} /></div>
      </header>

      <section className="notifications-summary"><div><span>UNREAD</span><strong>{unread}</strong></div><div><span>TOTAL ALERTS</span><strong>{notifications.length}</strong></div><button onClick={onMarkAllRead}>Mark all as read</button></section>

      <section className="notifications-workspace"><div className="notifications-workspace-heading"><div><span>NOTIFICATION CENTER</span><h2>All notifications</h2></div><small>Click any alert to open its related workspace.</small></div><div className="notifications-management-list">{notifications.length ? notifications.map((notification) => <article className={`managed-notification ${notification.unread ? "unread" : ""}`} key={notification.id}><button className="managed-notification-main" onClick={() => onNotificationClick(notification)}><span className="managed-notification-dot"></span><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{notification.time}</small></div></button><button className="managed-notification-delete" onClick={() => onDeleteNotification(notification.id)} aria-label={`Delete ${notification.title}`}>×</button></article>) : <div className="notifications-empty">You are all caught up.</div>}</div></section>
    </main>
  );
}
