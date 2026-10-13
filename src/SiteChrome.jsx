import { useEffect, useState } from "react";
import "./SiteChrome.css";

import logo from "./assets/logo1.png";
import userLogo from "./assets/user.png";
import loveLogo from "./assets/love.png";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}/stayease-api/stayease.php`;

const roomNames = {
  standard: "Standard Room",
  twin: "Deluxe Twin Room",
  deluxe: "Deluxe Queen Room",
  triple: "Superior Triple Room",
  quadruple: "Superior Quadruple Room",
};

export default function SiteChrome({
  onHome,
  onAmenities,
  onAbout,
  onContact,
  onProfile,
  onLogout,
  onRooms,
  favoriteCount = 0,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState("");

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem("stayeaseUser") || "null");
    } catch {
      return null;
    }
  };

  const savedUser = getUser();
  const name = savedUser?.name || "Guest";
  const email = savedUser?.email || "No email connected";

  const readStorage = () => {
    try {
      const storedFavorites = JSON.parse(
        localStorage.getItem("stayeaseFavorites") || "[]"
      );
      setFavorites(Array.isArray(storedFavorites) ? storedFavorites : []);
    } catch {
      setFavorites([]);
    }

    try {
      const storedReservations = JSON.parse(
        localStorage.getItem("stayeaseReservations") || "[]"
      );
      setReservations(
        Array.isArray(storedReservations) ? storedReservations : []
      );
    } catch {
      setReservations([]);
    }

  };

  useEffect(() => {
    readStorage();

    const update = () => readStorage();
    const refreshNotifications = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}?action=notifications`,
          { credentials: "include" }
        );
        const result = await response.json();

        if (!response.ok || result.success === false) {
          throw new Error(
            result.message || `Could not load notifications (${response.status}).`
          );
        }

        setNotifications(
          (Array.isArray(result.data) ? result.data : []).map((item) => ({
            id: String(item.notification_id),
            title: item.title,
            message: item.message,
            date: item.notification_date || item.created_at,
            read: Boolean(Number(item.is_read)),
          }))
        );
        setNotificationError("");
      } catch (error) {
        setNotificationError(error.message);
      }
    };

    window.addEventListener("stayeaseFavoritesUpdated", update);
    window.addEventListener("stayeaseReservationsUpdated", update);
    window.addEventListener("storage", update);
    refreshNotifications();
    const notificationRefresh = window.setInterval(refreshNotifications, 15000);

    return () => {
      window.removeEventListener("stayeaseFavoritesUpdated", update);
      window.removeEventListener("stayeaseReservationsUpdated", update);
      window.removeEventListener("storage", update);
      window.clearInterval(notificationRefresh);
    };
  }, []);

  const handleProfile = () => {
    setProfileOpen((current) => !current);
    setFavoritesOpen(false);
    setMobileNavOpen(false);
  };

  const handleFavorites = () => {
    setFavoritesOpen((current) => !current);
    setProfileOpen(false);
    setMobileNavOpen(false);
  };

  const navigate = (action) => {
    setMobileNavOpen(false);
    action();
  };

  const markNotificationsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}?action=notifications`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || `Could not update notifications (${response.status}).`
        );
      }

      setNotifications((current) =>
        current.map((item) => ({ ...item, read: true }))
      );
      setNotificationError("");
    } catch (error) {
      setNotificationError(error.message);
    }
  };

  const unreadCount = notifications.filter((item) => !item.read).length;
  const displayFavoriteCount = favorites.length;

  return (
    <header className="site-header">
      <button
        type="button"
        className="header-logo"
        onClick={onHome}
        aria-label="Go to home"
      >
        <img src={logo} alt="StayEase" />
      </button>

      <nav className={`main-nav ${mobileNavOpen ? "mobile-nav-open" : ""}`}>
        <button type="button" onClick={() => navigate(onHome)}>
          HOME
        </button>
        <button type="button" onClick={() => navigate(onAmenities)}>
          ROOM & AMENITIES
        </button>
        <button type="button" onClick={() => navigate(onAbout)}>
          ABOUT
        </button>
        <button type="button" onClick={() => navigate(onContact)}>
          CONTACT
        </button>
      </nav>

      <button
        type="button"
        className={`mobile-nav-toggle ${mobileNavOpen ? "active" : ""}`}
        onClick={() => setMobileNavOpen((open) => !open)}
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <div className="header-actions">
        <div className="header-action-wrapper">
          <button
            type="button"
            className={`header-icon-button ${
              displayFavoriteCount > 0 ? "has-favorites" : ""
            }`}
            onClick={handleFavorites}
            aria-label={`Favorites${
              displayFavoriteCount > 0 ? `, ${displayFavoriteCount} saved` : ""
            }`}
            aria-expanded={favoritesOpen}
          >
            <img src={loveLogo} alt="" />
            {displayFavoriteCount > 0 && (
              <span className="notification-badge favorite-badge">
                {displayFavoriteCount > 99 ? "99+" : displayFavoriteCount}
              </span>
            )}
          </button>

          {favoritesOpen && (
            <div className="header-dropdown favorites-dropdown">
              <div className="dropdown-heading">
                <span>SAVED STAYS</span>
                <h3>Your favorites</h3>
              </div>

              {favorites.length === 0 ? (
                <div className="empty-dropdown">
                  <p>Your favorite rooms will appear here.</p>
                </div>
              ) : (
                <div className="favorite-list">
                  {favorites.map((id) => (
                    <div className="favorite-item" key={id}>
                      <div className="favorite-item-copy">
                        <strong>{roomNames[id] || id}</strong>
                        <span>Saved room</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="dropdown-main-link"
                onClick={() => {
                  setFavoritesOpen(false);
                  onRooms();
                }}
              >
                VIEW ROOMS →
              </button>
            </div>
          )}
        </div>

        <div className="profile-wrapper">
          <button
            type="button"
            className="profile-button"
            onClick={handleProfile}
            aria-label="Profile"
            aria-expanded={profileOpen}
          >
            <img className="profile-icon" src={userLogo} alt="" />

            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {profileOpen && (
            <div className="header-dropdown profile-dropdown">
              <div className="profile-intro">
                <div className="profile-avatar">
                  <img src={userLogo} alt="" />
                </div>

                <div>
                  <strong>{name}</strong>
                  <span>{email}</span>
                </div>
              </div>

              <div className="profile-summary">
                <span>RESERVATIONS</span>
                <strong>{reservations.length}</strong>
              </div>

              <div className="notification-section">
                <div className="notification-header">
                  <div>
                    <span>ACCOUNT NOTIFICATIONS</span>
                    <strong>
                      {unreadCount
                        ? `${unreadCount} unread`
                        : "All caught up"}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={markNotificationsRead}
                    disabled={!unreadCount}
                  >
                    {unreadCount ? "MARK AS READ" : "ALL CAUGHT UP"}
                  </button>
                </div>

                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="notification-empty">
                      {notificationError || "No notifications yet."}
                    </div>
                  ) : (
                    notifications.map((item, index) => (
                      <div
                        className={`notification-item ${
                          !item.read ? "unread" : ""
                        }`}
                        key={item.id || index}
                      >
                        {!item.read && <i />}

                        <div>
                          <strong>
                            {item.title || "StayEase update"}
                          </strong>
                          <p>
                            {item.message || "You have a new update."}
                          </p>
                          {item.date && <small>{item.date}</small>}
                        </div>
                      </div>
                    ))
                  )}
                  {notificationError && notifications.length > 0 && (
                    <div className="notification-empty" role="alert">
                      {notificationError}
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-actions">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onProfile?.();
                  }}
                >
                  MY PROFILE
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onRooms();
                  }}
                >
                  MY STAYEASE
                </button>

                <button
                  type="button"
                  className="logout-button"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                >
                  LOG OUT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
