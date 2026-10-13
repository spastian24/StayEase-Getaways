import { useEffect, useMemo, useState } from "react";
import "./AppAdmin.css";
import logo from "./assets/logo1.png";
import building from "./assets/building.png";
import pool from "./assets/pool.png";
import arrivalsIcon from "./assets/arrivals.png";
import cleaningIcon from "./assets/cleaning.png";
import departuresIcon from "./assets/departures.png";
import notificationIcon from "./assets/notification.png";
import occupancyIcon from "./assets/occupancy.png";
const maintenanceIcon = cleaningIcon;
import pendingBookingsIcon from "./assets/pendingbookings.png";
import pendingPaymentIcon from "./assets/pendingpayment.png";
import roomsReadyIcon from "./assets/roomsready.png";
import todaysRevenueIcon from "./assets/todaysrevenue.png";
import userIcon from "./assets/user.png";
import RoomManagement from "./RoomManagement.jsx";
import CalendarControl from "./CalendarControl.jsx";
import CustomerManagement from "./CustomerManagement.jsx";
import PaymentManagement from "./PaymentManagement.jsx";
import RoomAmenitiesManagement from "./RoomAmenitiesManagement.jsx";
import ReportsManagement from "./ReportsManagement.jsx";
import NotificationsManagement from "./NotificationsManagement.jsx";
import "./responsiveAdmin.css";

const officialRoomNames = [
  "Standard Room",
  "Deluxe Twin Room",
  "Deluxe Queen Room",
  "Superior Triple Room",
  "Superior Quadruple Room"
];

const ADMIN_API_BASE_URL = `${window.location.protocol}//${window.location.hostname}/stayease-api/stayease.php`;

async function requestAdminApi(action, options = {}) {
  const url = new URL(ADMIN_API_BASE_URL);
  url.searchParams.set("action", action);

  const response = await fetch(url, {
    credentials: "include",
    ...options
  });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `The request failed (${response.status}).`
    );
  }

  return result.data;
}

function mapApiReservation(reservation) {
  return {
    id: reservation.reservation_id,
    guest: reservation.guest_name || "Guest",
    room: reservation.room_name,
    checkIn: formatDisplayDate(reservation.check_in),
    checkOut: formatDisplayDate(reservation.check_out),
    reportDate: reservation.created_at?.slice(0, 10) || reservation.check_in,
    createdAt: reservation.created_at || "",
    guests: Number(reservation.adults) + Number(reservation.children),
    amount: `₱${Number(reservation.total_amount).toLocaleString()}`,
    status: reservation.status || "Pending",
    apiBacked: true
  };
}

function toInputDate(value) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateBookingId(bookings) {
  const numbers = bookings
    .map((booking) => Number(String(booking.id).replace(/\D/g, "")))
    .filter((number) => !Number.isNaN(number));

  const nextNumber = numbers.length
    ? Math.max(...numbers) + 1
    : 1001;

  return `SE-${nextNumber}`;
}

function DashboardIcon({ src, alt, className = "" }) {
  return (
    <div className={`dashboard-icon ${className}`}>
      <img src={src} alt={alt} />
    </div>
  );
}

function getTodayInputDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function AdminDateBox({ value, onChange }) {
  return <CalendarControl value={value} onChange={onChange} />;
}

function AdminTopBar({ label, title, subtitle, rightContent, className = "" }) {
  return (
    <header className={`admin-topbar ${className}`.trim()}>
      <div className="admin-welcome">
        <span className="admin-page-label">{label}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="admin-topbar-right">{rightContent}</div>
    </header>
  );
}

const pageDetails = {
  customers: {
    label: "STAYEASE ADMINISTRATION / CUSTOMERS",
    title: "Customer directory",
    subtitle: "Keep guest profiles, contact details, and stay history organized.",
    eyebrow: "GUEST RELATIONSHIPS",
    heading: "Customer overview",
    cards: ["Active guests", "Returning guests", "Profiles needing review"]
  },
  payments: {
    label: "STAYEASE ADMINISTRATION / PAYMENTS",
    title: "Payment center",
    subtitle: "Review transactions and keep every reservation financially clear.",
    eyebrow: "FINANCIAL OPERATIONS",
    heading: "Payment overview",
    cards: ["Collected today", "Awaiting review", "Refunds to process"]
  },
  amenities: {
    label: "STAYEASE ADMINISTRATION / AMENITIES",
    title: "Amenities catalog",
    subtitle: "Organize the services and extras available to every guest.",
    eyebrow: "GUEST EXPERIENCE",
    heading: "Amenity overview",
    cards: ["Active amenities", "Most requested", "Needs restocking"]
  },
  reports: {
    label: "STAYEASE ADMINISTRATION / REPORTS",
    title: "Reports workspace",
    subtitle: "Turn hotel activity into clear, useful operational insight.",
    eyebrow: "BUSINESS INTELLIGENCE",
    heading: "Report overview",
    cards: ["Occupancy report", "Revenue report", "Operations report"]
  }
};

function ManagementPage({
  page,
  onOpenNotifications,
  unreadCount,
  calendarDate,
  setCalendarDate
}) {
  const details = pageDetails[page];

  return (
    <main className="admin-main management-page">
      <AdminTopBar
        label={details.label}
        title={details.title}
        subtitle={details.subtitle}
        rightContent={
          <>
            <button
              className="admin-notification-box"
              onClick={onOpenNotifications}
            >
              <DashboardIcon
                src={notificationIcon}
                alt="Notifications"
                className="notification-icon-box"
              />
              <div>
                <strong>{unreadCount} Notifications</strong>
                <span>{unreadCount} unread notifications</span>
              </div>
            </button>

            <CalendarControl
              value={calendarDate}
              onChange={setCalendarDate}
            />
          </>
        }
      />

      <section className={`management-hero management-hero-${page}`}>
        <span>{details.eyebrow}</span>
        <h2>{details.heading}</h2>
        <p>
          Everything your team needs is gathered here for a focused {page} workflow.
        </p>
      </section>

      <section className="management-card-grid">
        {details.cards.map((card, index) => (
          <article className="management-summary-card" key={card}>
            <span>0{index + 1}</span>
            <h3>{card}</h3>
            <strong>Ready</strong>
            <p>This workspace is connected to the StayEase admin layout.</p>
          </article>
        ))}
      </section>

      <section className="management-empty-panel">
        <span>WORKSPACE READY</span>
        <h2>{details.title} is connected</h2>
        <p>
          The shared navigation, notifications, calendar, and page styling are now
          consistent across the admin area.
        </p>
      </section>
    </main>
  );
}

function AdminLogin({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [forgotUsername, setForgotUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getAdminAccount = () => {
    const saved = localStorage.getItem("stayeaseAdmin");

    if (!saved) {
      return null;
    }

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  };

  const showVerification = () => {
    const code = generateCode();

    setGeneratedCode(code);
    setVerificationCode("");
    setVerificationError("");
    setVerificationStep(true);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setVerificationStep(false);
    setVerificationCode("");
    setGeneratedCode("");
    setVerificationError("");
    setError("");
    setSuccess("");
  };

  const handleLogin = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }

    const account = getAdminAccount();
    if (
      account &&
      username.trim() === account.username &&
      password === account.password
    ) {
      localStorage.setItem("stayeaseAdminLoggedIn", "true");
      onLogin();
      return;
    }

    setError("Invalid username or password.");
  };

  const handleCreateAccount = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !newName.trim() ||
      !newUsername.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const existing = localStorage.getItem("stayeaseAdmin");

    if (existing) {
      const account = getAdminAccount();

      if (account && account.username === newUsername.trim()) {
        setError("That username is already registered.");
        return;
      }
    }

    const account = {
      username: newUsername.trim(),
      password: newPassword,
      name: newName.trim(),
      role: "Administrator"
    };

    localStorage.setItem(
      "stayeasePendingAdmin",
      JSON.stringify(account)
    );

    const code = generateCode();

    localStorage.setItem(
      "stayeasePendingAdminCode",
      code
    );

    setGeneratedCode(code);
    setVerificationCode("");
    setVerificationError("");
    setVerificationStep(true);
    setSuccess("");
  };

  const handleForgotPassword = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!forgotUsername.trim()) {
      setError("Please enter your admin username.");
      return;
    }

    const account = getAdminAccount();

    if (!account || forgotUsername.trim() !== account.username) {
      setError("No admin account was found with that username.");
      return;
    }

    const code = generateCode();

    localStorage.setItem(
      "stayeaseResetCode",
      code
    );

    setGeneratedCode(code);
    setVerificationCode("");
    setVerificationError("");
    setVerificationStep(true);
  };

  const resendCode = () => {
    const code = generateCode();

    setGeneratedCode(code);
    setVerificationCode("");
    setVerificationError("");
  };

  const verifyCreateAccount = () => {
    if (verificationCode !== generatedCode) {
      setVerificationError("Incorrect verification code.");
      return;
    }

    const pending = localStorage.getItem(
      "stayeasePendingAdmin"
    );

    if (!pending) {
      setVerificationError(
        "Account setup expired. Please try again."
      );
      return;
    }

    localStorage.setItem(
      "stayeaseAdmin",
      pending
    );

    localStorage.removeItem(
      "stayeasePendingAdmin"
    );

    localStorage.removeItem(
      "stayeasePendingAdminCode"
    );

    localStorage.setItem(
      "stayeaseAdminLoggedIn",
      "true"
    );

    onLogin();
  };

  const verifyForgotPassword = () => {
    if (verificationCode !== generatedCode) {
      setVerificationError("Incorrect verification code.");
      return;
    }

    setVerificationStep(false);
    setSuccess(
      "Code verified. Please create your new password."
    );
    setVerificationCode("");
    setGeneratedCode("");
    setMode("reset");
  };

  const handleResetPassword = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!resetPassword || !confirmResetPassword) {
      setError("Please enter your new password.");
      return;
    }

    if (resetPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      setError("Passwords do not match.");
      return;
    }

    const account = getAdminAccount();

    if (!account) {
      setError("Admin account could not be found. Please create an account.");
      return;
    }

    const updatedAccount = {
      ...account,
      password: resetPassword
    };

    localStorage.setItem(
      "stayeaseAdmin",
      JSON.stringify(updatedAccount)
    );

    setResetPassword("");
    setConfirmResetPassword("");
    setForgotUsername("");
    setMode("login");
    setSuccess(
      "Password updated successfully. You can now log in."
    );
  };

  if (verificationStep) {
    const verificationTitle =
      mode === "create"
        ? "Verify your account"
        : mode === "forgot"
          ? "Verify password reset"
          : "Verify your login";

    return (
      <div className="admin-login-page">
        <div className="admin-login-background">
          <div className="admin-orb admin-orb-one"></div>
          <div className="admin-orb admin-orb-two"></div>
          <div className="admin-line admin-line-one"></div>
          <div className="admin-line admin-line-two"></div>
        </div>

        <div className="admin-login-container">
          <div
            className="admin-brand-panel"
            style={{ backgroundImage: `url(${building})` }}
          >
            <div className="admin-brand-overlay"></div>

            <div className="admin-brand-content">
              <img
                src={logo}
                alt="StayEase"
                className="admin-login-logo"
              />

              <h1 className="admin-brand-message">
                Manage StayEase
                <span>with Ease.</span>
              </h1>
            </div>
          </div>

          <div className="admin-form-panel">
            <div className="admin-form-content verification-content">
              <div className="admin-form-heading">
                <span>SECURITY VERIFICATION</span>
                <h2>{verificationTitle}</h2>
                <p>
                  Enter the six-digit verification code to continue.
                </p>
              </div>

              <div className="demo-code-box">
                <span>DEMO VERIFICATION CODE</span>
                <strong>{generatedCode}</strong>
              </div>

              <div className="admin-form-group">
                <label htmlFor="verificationCode">
                  Verification Code
                </label>

                <input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  value={verificationCode}
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);

                    setVerificationCode(value);
                    setVerificationError("");
                  }}
                  placeholder="Enter 6-digit code"
                  autoComplete="one-time-code"
                />
              </div>

              {verificationError && (
                <div className="admin-login-error">
                  {verificationError}
                </div>
              )}

              <button
                type="button"
                className="admin-login-button"
                onClick={
                  mode === "create"
                    ? verifyCreateAccount
                    : mode === "forgot"
                      ? verifyForgotPassword
                      : undefined
                }
              >
                <span>VERIFY CODE</span>
              </button>

              <div className="verification-actions">
                <button type="button" onClick={resendCode}>
                  Resend Code
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerificationStep(false);
                    setVerificationCode("");
                    setGeneratedCode("");
                    setVerificationError("");
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <div className="admin-login-page">
        <div className="admin-login-background">
          <div className="admin-orb admin-orb-one"></div>
          <div className="admin-orb admin-orb-two"></div>
          <div className="admin-line admin-line-one"></div>
          <div className="admin-line admin-line-two"></div>
        </div>

        <div className="admin-login-container">
          <div
            className="admin-brand-panel"
            style={{ backgroundImage: `url(${building})` }}
          >
            <div className="admin-brand-overlay"></div>

            <div className="admin-brand-content">
              <img
                src={logo}
                alt="StayEase"
                className="admin-login-logo"
              />

              <h1 className="admin-brand-message">
                Reset your access.
                <span>Get back to managing.</span>
              </h1>
            </div>
          </div>

          <div className="admin-form-panel">
            <div className="admin-form-content">
              <div className="admin-form-heading">
                <span>ACCOUNT SECURITY</span>
                <h2>Reset password</h2>
                <p>
                  Create a new password for your admin account.
                </p>
              </div>

              <form
                onSubmit={handleResetPassword}
                className="admin-login-form"
              >
                <div className="admin-form-group">
                  <label htmlFor="resetPassword">
                    New Password
                  </label>

                  <input
                    id="resetPassword"
                    type="password"
                    value={resetPassword}
                    onChange={(event) => {
                      setResetPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="confirmResetPassword">
                    Confirm Password
                  </label>

                  <input
                    id="confirmResetPassword"
                    type="password"
                    value={confirmResetPassword}
                    onChange={(event) => {
                      setConfirmResetPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Confirm new password"
                  />
                </div>

                {error && (
                  <div className="admin-login-error">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="admin-login-success">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="admin-login-button"
                >
                  <span>UPDATE PASSWORD</span>
                </button>
              </form>

              <div className="admin-form-links">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="admin-login-page">
        <div className="admin-login-background">
          <div className="admin-orb admin-orb-one"></div>
          <div className="admin-orb admin-orb-two"></div>
          <div className="admin-line admin-line-one"></div>
          <div className="admin-line admin-line-two"></div>
        </div>

        <div className="admin-login-container">
          <div
            className="admin-brand-panel"
            style={{ backgroundImage: `url(${building})` }}
          >
            <div className="admin-brand-overlay"></div>

            <div className="admin-brand-content">
              <img
                src={logo}
                alt="StayEase"
                className="admin-login-logo"
              />

              <h1 className="admin-brand-message">
                Everything you need,
                <span>all in one place.</span>
              </h1>
            </div>
          </div>

          <div className="admin-form-panel">
            <div className="admin-form-content">
              <div className="admin-form-heading">
                <span>ADMINISTRATION</span>
                <h2>Create account</h2>
                <p>
                  Set up your StayEase administrator account.
                </p>
              </div>

              <form
                onSubmit={handleCreateAccount}
                className="admin-login-form"
              >
                <div className="admin-form-group">
                  <label htmlFor="newName">Full Name</label>

                  <input
                    id="newName"
                    type="text"
                    value={newName}
                    onChange={(event) => {
                      setNewName(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="newUsername">
                    Username
                  </label>

                  <input
                    id="newUsername"
                    type="text"
                    value={newUsername}
                    onChange={(event) => {
                      setNewUsername(event.target.value);
                      setError("");
                    }}
                    placeholder="Create a username"
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="newPassword">
                    Password
                  </label>

                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Create a password"
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="confirmPassword">
                    Confirm Password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Confirm your password"
                  />
                </div>

                {error && (
                  <div className="admin-login-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="admin-login-button"
                >
                  <span>CREATE ADMIN ACCOUNT</span>
                </button>
              </form>

              <div className="admin-form-links">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                >
                  Already have an account? Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="admin-login-page">
        <div className="admin-login-background">
          <div className="admin-orb admin-orb-one"></div>
          <div className="admin-orb admin-orb-two"></div>
          <div className="admin-line admin-line-one"></div>
          <div className="admin-line admin-line-two"></div>
        </div>

        <div className="admin-login-container">
          <div
            className="admin-brand-panel"
            style={{ backgroundImage: `url(${building})` }}
          >
            <div className="admin-brand-overlay"></div>

            <div className="admin-brand-content">
              <img
                src={logo}
                alt="StayEase"
                className="admin-login-logo"
              />

              <h1 className="admin-brand-message">
                Reset your access.
                <span>Get back to managing.</span>
              </h1>
            </div>
          </div>

          <div className="admin-form-panel">
            <div className="admin-form-content">
              <div className="admin-form-heading">
                <span>ACCOUNT RECOVERY</span>
                <h2>Forgot password?</h2>
                <p>
                  Enter your admin username to receive a verification code.
                </p>
              </div>

              <form
                onSubmit={handleForgotPassword}
                className="admin-login-form"
              >
                <div className="admin-form-group">
                  <label htmlFor="forgotUsername">
                    Admin Username
                  </label>

                  <input
                    id="forgotUsername"
                    type="text"
                    value={forgotUsername}
                    onChange={(event) => {
                      setForgotUsername(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter your username"
                  />
                </div>

                {error && (
                  <div className="admin-login-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="admin-login-button"
                >
                  <span>CONTINUE</span>
                </button>
              </form>

              <div className="admin-form-links">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-background">
        <div className="admin-orb admin-orb-one"></div>
        <div className="admin-orb admin-orb-two"></div>
        <div className="admin-line admin-line-one"></div>
        <div className="admin-line admin-line-two"></div>
      </div>

      <div className="admin-login-container">
        <div
          className="admin-brand-panel"
          style={{ backgroundImage: `url(${building})` }}
        >
          <div className="admin-brand-overlay"></div>

          <div className="admin-brand-content">
            <img
              src={logo}
              alt="StayEase"
              className="admin-login-logo"
            />

            <h1 className="admin-brand-message">
              Manage StayEase
              <span>with Ease.</span>
            </h1>
          </div>
        </div>

        <div className="admin-form-panel">
          <div className="admin-form-content">
            <div className="admin-form-heading">
              <span>WELCOME BACK,</span>
              <h2>Admin!</h2>
              <p>
                Sign in to access your StayEase management dashboard.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="admin-login-form"
            >
              <div className="admin-form-group">
                <label htmlFor="adminUsername">
                  Username
                </label>

                <input
                  id="adminUsername"
                  type="text"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="adminPassword">
                  Password
                </label>

                <div className="admin-password-wrapper">
                  <input
                    id="adminPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      setSuccess("");
                    }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    className="admin-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="admin-login-error">
                  {error}
                </div>
              )}

              {success && (
                <div className="admin-login-success">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="admin-login-button"
              >
                <span>LOGIN TO ADMIN PORTAL</span>
              </button>
            </form>

            <div className="admin-form-links">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                ← Back to StayEase
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({
  notifications,
  onClose,
  onMarkAllRead,
  onNotificationClick,
  onViewAll
}) {
  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  return (
    <div className="notification-panel">
      <div className="notification-panel-header">
        <div>
          <span>STAYEASE</span>
          <h3>Notifications</h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="notification-close"
        >
          ×
        </button>
      </div>

      <div className="notification-panel-actions">
        <span>{unreadCount} unread</span>

        <div>
          <button type="button" onClick={onMarkAllRead}>
            Mark all as read
          </button>

          <button type="button" onClick={onViewAll}>
            View all
          </button>
        </div>
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <strong>No notifications</strong>
            <span>You&apos;re all caught up.</span>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              className={`notification-item ${
                notification.unread ? "unread" : ""
              }`}
              key={notification.id}
              type="button"
              onClick={() => onNotificationClick(notification)}
            >
              <div className="notification-dot"></div>

              <div className="notification-item-content">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <span>{notification.time}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Sidebar({
  page,
  setPage,
  admin,
  onLogout,
  onOpenNotifications,
  unreadCount
}) {
  return (
    <aside
      className="admin-sidebar"
      style={{ backgroundImage: `url(${pool})` }}
    >
      <div className="admin-sidebar-overlay"></div>

      <div className="admin-sidebar-content">
        <div className="admin-sidebar-brand">
          <img src={logo} alt="StayEase" />
          <span>ADMINISTRATION</span>
        </div>

        <div className="admin-sidebar-divider"></div>

        <nav className="admin-sidebar-nav">
          <button
            className={`admin-nav-item ${
              page === "dashboard" ? "active" : ""
            }`}
            onClick={() => setPage("dashboard")}
          >
            <span>Dashboard</span>
          </button>

          <button
            className={`admin-nav-item ${
              page === "bookings" ? "active" : ""
            }`}
            onClick={() => setPage("bookings")}
          >
            <span>Bookings</span>
          </button>

          <button
            className={`admin-nav-item ${
              page === "rooms" ? "active" : ""
            }`}
            onClick={() => setPage("rooms")}
          >
            <span>Rooms</span>
          </button>

          <button
            className={`admin-nav-item ${
              page === "customers" ? "active" : ""
            }`}
            onClick={() => setPage("customers")}
          >
            <span>Customers</span>
          </button>

          <button
            className={`admin-nav-item ${
              page === "payments" ? "active" : ""
            }`}
            onClick={() => setPage("payments")}
          >
            <span>Payments</span>
          </button>

          <button
            className={`admin-nav-item ${
              page === "room-amenities" ? "active" : ""
            }`}
            onClick={() => setPage("room-amenities")}
          >
            <span>Amenities</span>
          </button>

          <button
            className={`admin-nav-item ${
              page === "reports" ? "active" : ""
            }`}
            onClick={() => setPage("reports")}
          >
            <span>Reports</span>
          </button>
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-user">
            <div className="admin-user-avatar">
              <img src={userIcon} alt="Administrator" />
            </div>

            <div className="admin-user-details">
              <strong>
                {admin.name || "Administrator"}
              </strong>

              <span>
                {admin.role || "Administrator"}
              </span>
            </div>
          </div>

          <button
            className="admin-logout-button"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

function AdminDashboard({
  setPage,
  goToBookings,
  admin,
  onLogout,
  onOpenNotifications,
  unreadCount,
  bookings,
  setBookings,
  onBookingStatusChange,
  paymentRecords,
  bookingLoadError,
  calendarDate,
  setCalendarDate,
  dashboardAction,
  setDashboardAction
}) {
  const [quickForm, setQuickForm] = useState({
    guest: "",
    room: "",
    checkIn: calendarDate,
    checkOut: calendarDate,
    guests: "2",
    amount: "",
    status: "Pending",
    bookingId: ""
  });

  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("stayease_payments");

    let localPayments = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        localPayments = Array.isArray(parsed) ? parsed : [];
      } catch {
        localPayments = [];
      }
    }

    const apiBookingIds = new Set(
      paymentRecords.map((payment) => payment.reservation_id)
    );
    setPayments([
      ...paymentRecords.map((payment) => ({
        id: payment.payment_id,
        booking: payment.reservation_id,
        customer: payment.customer_name || "Guest",
        method: payment.payment_method || "GCash",
        amount: `₱${Number(payment.amount).toLocaleString()}`,
        date: payment.payment_date || "",
        status: payment.payment_status || "For review",
        apiBacked: true
      })),
      ...localPayments.filter(
        (payment) =>
          !payment.apiBacked &&
          !apiBookingIds.has(payment.booking)
      )
    ]);
  }, [dashboardAction, bookings, paymentRecords]);

  const today = getTodayInputDate();

  const recentBookings = bookings.slice(0, 4);

  const arrivalsToday = bookings.filter(
    (booking) => toInputDate(booking.checkIn) === today
  ).length;

  const departuresToday = bookings.filter(
    (booking) =>
      toInputDate(booking.checkOut) === today &&
      ["Confirmed", "Checked-in"].includes(booking.status)
  ).length;

  const checkedInCount = bookings.filter(
    (booking) => booking.status === "Checked-in"
  ).length;

  const pendingBookings = bookings.filter(
    (booking) => booking.status === "Pending"
  ).length;
  const pendingReservations = bookings
    .filter((booking) => booking.status === "Pending")
    .slice(0, 5);

  const paidPayments = payments.filter(
    (payment) => payment.status === "Paid"
  );

  const pendingPayments = payments.filter(
    (payment) => payment.status === "For review"
  );

  const pendingPaymentAmount = pendingPayments.reduce(
    (sum, payment) =>
      sum + Number(String(payment.amount).replace(/[^\d]/g, "")),
    0
  );

  const todaysRevenue = paidPayments
    .filter((payment) => toInputDate(payment.date) === today)
    .reduce(
      (sum, payment) =>
        sum + Number(String(payment.amount).replace(/[^\d]/g, "")),
      0
    );

  const closeQuickAction = () => {
    setDashboardAction("");

    setQuickForm({
      guest: "",
      room: "",
      checkIn: calendarDate,
      checkOut: calendarDate,
      guests: "2",
      amount: "",
      status: "Pending",
      bookingId: ""
    });
  };

  const submitQuickAction = () => {
    if (dashboardAction === "new") {
      if (
        !quickForm.guest.trim() ||
        !quickForm.room ||
        !quickForm.checkIn ||
        !quickForm.checkOut ||
        !quickForm.amount
      ) {
        return;
      }

      setBookings((current) => [
        {
          id: generateBookingId(current),
          guest: quickForm.guest.trim(),
          room: quickForm.room,
          checkIn: formatDisplayDate(quickForm.checkIn),
          checkOut: formatDisplayDate(quickForm.checkOut),
          guests: Number(quickForm.guests) || 1,
          amount: `₱${Number(quickForm.amount).toLocaleString()}`,
          status: quickForm.status
        },
        ...current
      ]);

      closeQuickAction();
      return;
    }

    if (
      dashboardAction === "checkin" ||
      dashboardAction === "checkout"
    ) {
      const nextStatus =
        dashboardAction === "checkin"
          ? "Checked-in"
          : "Checked-out";

      onBookingStatusChange(quickForm.bookingId, nextStatus);

      closeQuickAction();
    }
  };

  return (
    <div className="admin-dashboard">
      <main className="admin-main">
        <AdminTopBar
          label="STAYEASE ADMINISTRATION"
          title="Good morning, Admin."
          subtitle="Here&apos;s what&apos;s happening at StayEase today."
          rightContent={
            <>
              <button
                className="admin-notification-box"
                onClick={onOpenNotifications}
              >
                <DashboardIcon
                  src={notificationIcon}
                  alt="Notifications"
                  className="notification-icon-box"
                />

                <div>
                  <strong>
                    {unreadCount} Notifications
                  </strong>

                  <span>
                    {unreadCount} unread notifications
                  </span>
                </div>
              </button>

              <AdminDateBox
                value={calendarDate}
                onChange={setCalendarDate}
              />
            </>
          }
        />

        <section className="dashboard-section overview-section">
          {bookingLoadError && (
            <p className="booking-form-error" role="alert">
              Could not load live reservations: {bookingLoadError}
            </p>
          )}
          <div className="section-heading">
            <div>
              <span>HOTEL AT A GLANCE</span>
              <h2>Today&apos;s activity</h2>
            </div>
          </div>

          <div className="main-stat-grid">
            <div className="main-stat-card arrivals-card">
              <div className="stat-card-top">
                <div className="stat-card-title">
                  <DashboardIcon
                    src={arrivalsIcon}
                    alt="Arrivals"
                    className="arrivals-icon"
                  />

                  <span className="stat-label">ARRIVALS</span>
                </div>

                <span className="stat-card-accent"></span>
              </div>

              <div className="stat-value">{arrivalsToday}</div>
              <h3>Today&apos;s Check-ins</h3>
              <p>Guests arriving today</p>
            </div>

            <div className="main-stat-card departures-card">
              <div className="stat-card-top">
                <div className="stat-card-title">
                  <DashboardIcon
                    src={departuresIcon}
                    alt="Departures"
                    className="departures-icon"
                  />

                  <span className="stat-label">DEPARTURES</span>
                </div>

                <span className="stat-card-accent"></span>
              </div>

              <div className="stat-value">{departuresToday}</div>
              <h3>Today&apos;s Check-outs</h3>
              <p>Guests leaving today</p>
            </div>

            <div className="main-stat-card occupancy-card">
              <div className="stat-card-top">
                <div className="stat-card-title">
                  <DashboardIcon
                    src={occupancyIcon}
                    alt="Occupancy"
                    className="occupancy-icon"
                  />

                  <span className="stat-label">OCCUPANCY</span>
                </div>

                <span className="stat-card-accent"></span>
              </div>

              <div className="stat-value">{checkedInCount}</div>
              <h3>Checked-in Guests</h3>
              <p>Based on current reservations</p>
            </div>

            <div className="main-stat-card available-card">
              <div className="stat-card-top">
                <div className="stat-card-title">
                  <DashboardIcon
                    src={roomsReadyIcon}
                    alt="Reservations"
                    className="rooms-ready-icon"
                  />

                  <span className="stat-label">RESERVATIONS</span>
                </div>

                <span className="stat-card-accent"></span>
              </div>

              <div className="stat-value">{bookings.length}</div>
              <h3>Total Reservations</h3>
              <p>Saved reservations</p>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span>TODAY&apos;S NUMBERS</span>
              <h2>Booking & Payments</h2>
            </div>
          </div>

          <div className="performance-grid">
            <div className="performance-card">
              <DashboardIcon
                src={pendingBookingsIcon}
                alt="Pending bookings"
                className="pending-bookings-icon"
              />

              <div className="performance-content">
                <span className="performance-label">
                  PENDING BOOKINGS
                </span>

                <strong>{pendingBookings}</strong>
                <p>Need confirmation</p>
              </div>
            </div>

            <div className="performance-card">
              <DashboardIcon
                src={pendingPaymentIcon}
                alt="Pending payments"
                className="pending-payment-icon"
              />

              <div className="performance-content">
                <span className="performance-label">
                  PENDING PAYMENTS
                </span>

                <strong>
                  ₱{pendingPaymentAmount.toLocaleString()}
                </strong>

                <p>Awaiting review</p>
              </div>
            </div>

            <div className="performance-card">
              <DashboardIcon
                src={todaysRevenueIcon}
                alt="Today's revenue"
                className="todays-revenue-icon"
              />

              <div className="performance-content">
                <span className="performance-label">
                  TODAY&apos;S REVENUE
                </span>

                <strong>
                  ₱{todaysRevenue.toLocaleString()}
                </strong>

                <p>Collected today</p>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span>ROOM STATUS</span>
              <h2>Room operations</h2>
            </div>
          </div>

          <div className="room-section-card">
            <div className="room-status-overview">
              <div className="room-status-total">
                <span>Total Reservations</span>
                <strong>{bookings.length}</strong>
              </div>

              <div className="room-status-item available-status">
                <span className="room-status-dot"></span>

                <div>
                  <strong>
                    {bookings.filter(
                      (booking) => booking.status === "Confirmed"
                    ).length}
                  </strong>

                  <span>Confirmed</span>
                </div>
              </div>

              <div className="room-status-item occupied-status">
                <span className="room-status-dot"></span>

                <div>
                  <strong>{checkedInCount}</strong>
                  <span>Checked-in</span>
                </div>
              </div>

              <div className="room-status-item cleaning-status">
                <span className="room-status-dot"></span>

                <div>
                  <strong>
                    {bookings.filter(
                      (booking) => booking.status === "Pending"
                    ).length}
                  </strong>

                  <span>Pending</span>
                </div>
              </div>

              <div className="room-status-item maintenance-status">
                <span className="room-status-dot"></span>

                <div>
                  <strong>
                    {bookings.filter(
                      (booking) => booking.status === "Cancelled"
                    ).length}
                  </strong>

                  <span>Cancelled</span>
                </div>
              </div>
            </div>

            <div className="room-status-total-bar">
              <div
                className="room-bar-available"
                style={{
                  width: `${bookings.length ? (bookings.filter((booking) => booking.status === "Confirmed").length / bookings.length) * 100 : 0}%`
                }}
              ></div>

              <div
                className="room-bar-occupied"
                style={{
                  width: `${bookings.length ? (checkedInCount / bookings.length) * 100 : 0}%`
                }}
              ></div>

              <div
                className="room-bar-cleaning"
                style={{
                  width: `${bookings.length ? (bookings.filter((booking) => booking.status === "Pending").length / bookings.length) * 100 : 0}%`
                }}
              ></div>

              <div
                className="room-bar-maintenance"
                style={{
                  width: `${bookings.length ? (bookings.filter((booking) => booking.status === "Cancelled").length / bookings.length) * 100 : 0}%`
                }}
              ></div>
            </div>

            <div className="room-status-note">
              <div className="room-operation">
                <DashboardIcon
                  src={cleaningIcon}
                  alt="Pending"
                  className="cleaning-icon"
                />

                <div>
                  <span>RESERVATIONS</span>

                  <strong>
                    {pendingBookings} bookings need confirmation
                  </strong>
                </div>

                <button onClick={() => goToBookings()}>
                  View bookings
                </button>
              </div>

              <div className="room-operation">
                <DashboardIcon
                  src={maintenanceIcon}
                  alt="Payments"
                  className="maintenance-icon"
                />

                <div>
                  <span>PAYMENTS</span>

                  <strong>
                    {pendingPayments.length} payments need review
                  </strong>
                </div>

                <button onClick={() => setPage("payments")}>
                  View payments
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading section-heading-with-action">
            <div>
              <span>RECENT BOOKINGS</span>
              <h2>Latest reservations</h2>
            </div>

            <button
              className="text-action"
              onClick={() => goToBookings()}
            >
              View all bookings
            </button>
          </div>

          <div className="recent-bookings-card">
            <div className="booking-table-header">
              <span>GUEST</span>
              <span>ROOM</span>
              <span>CHECK-IN</span>
              <span>STATUS</span>
              <span>AMOUNT</span>
              <span>ACTION</span>
            </div>

            {recentBookings.length === 0 ? (
              <div className="reservation-empty">
                <strong>No reservations yet</strong>
                <span>
                  Create a reservation to see it here.
                </span>
              </div>
            ) : (
              recentBookings.map((booking) => (
                <div
                  className="booking-table-row"
                  key={booking.id}
                >
                  <div className="booking-guest">
                    <div className="guest-avatar">
                      {booking.guest.charAt(0)}
                    </div>

                    <div>
                      <strong>{booking.guest}</strong>

                      <span>#{booking.id}</span>
                    </div>
                  </div>

                  <span className="booking-room">
                    {booking.room}
                  </span>

                  <span className="booking-date">
                    {booking.checkIn}
                  </span>

                  <span
                    className={`booking-status ${booking.status
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {booking.status}
                  </span>

                  <strong className="booking-amount">
                    {booking.amount}
                  </strong>

                  <button
                    className="booking-action"
                    onClick={() =>
                      goToBookings("view", booking)
                    }
                  >
                    View
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading section-heading-with-action">
            <div>
              <span>AWAITING YOUR REVIEW</span>
              <h2>Pending reservation requests</h2>
            </div>

            <button
              className="text-action"
              onClick={() => goToBookings()}
            >
              View all requests
            </button>
          </div>

          <div className="recent-bookings-card">
            {pendingReservations.length === 0 ? (
              <div className="reservation-empty">
                <strong>No requests awaiting approval</strong>
                <span>New customer reservations will appear here.</span>
              </div>
            ) : (
              pendingReservations.map((booking) => (
                <div
                  className="booking-table-row pending-request-row"
                  key={booking.id}
                >
                  <div className="booking-guest">
                    <div className="guest-avatar">
                      {booking.guest.charAt(0)}
                    </div>
                    <div>
                      <strong>{booking.guest}</strong>
                      <span>#{booking.id}</span>
                    </div>
                  </div>
                  <span className="booking-room">{booking.room}</span>
                  <span className="booking-date">{booking.checkIn}</span>
                  <span className="booking-status pending">Pending</span>
                  <strong className="booking-amount">{booking.amount}</strong>
                  <div className="booking-action-group">
                    <button
                      className="booking-action"
                      onClick={() => goToBookings("view", booking)}
                    >
                      Review
                    </button>
                    <button
                      className="confirm-reservation-button"
                      onClick={() =>
                        onBookingStatusChange(booking.id, "Confirmed")
                      }
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dashboard-section bottom-dashboard-section">
          <div className="bottom-grid">
            <div className="alerts-card">
              <div className="section-heading">
                <div>
                  <span>ATTENTION REQUIRED</span>
                  <h2>Alerts</h2>
                </div>
              </div>

              <div className="alert-item">
                <DashboardIcon
                  src={pendingPaymentIcon}
                  alt="Pending payment"
                  className="alert-payment-icon"
                />

                <div className="alert-content">
                  <strong>
                    {pendingPayments.length} payments need review
                  </strong>

                  <p>
                    Review payment transactions that need attention.
                  </p>
                </div>

                <button
                  onClick={() => setPage("payments")}
                >
                  Review
                </button>
              </div>

              <div className="alert-item">
                <DashboardIcon
                  src={maintenanceIcon}
                  alt="Cancelled reservations"
                  className="alert-maintenance-icon"
                />

                <div className="alert-content">
                  <strong>
                    {bookings.filter(
                      (booking) => booking.status === "Cancelled"
                    ).length} cancelled reservations
                  </strong>

                  <p>
                    These reservations are no longer proceeding.
                  </p>
                </div>

                <button onClick={() => goToBookings()}>
                  View
                </button>
              </div>

              <div className="alert-item">
                <DashboardIcon
                  src={cleaningIcon}
                  alt="Pending reservations"
                  className="alert-cleaning-icon"
                />

                <div className="alert-content">
                  <strong>
                    {pendingBookings} reservations pending
                  </strong>

                  <p>
                    Review reservations waiting for confirmation.
                  </p>
                </div>

                <button onClick={() => goToBookings()}>
                  View
                </button>
              </div>
            </div>

            <div className="quick-actions-card">
              <div className="section-heading">
                <div>
                  <span>QUICK ACTIONS</span>
                  <h2>Manage StayEase</h2>
                </div>
              </div>

              <div className="quick-actions-grid">
                <button
                  onClick={() => setDashboardAction("new")}
                >
                  New Booking
                </button>

                <button
                  onClick={() => setDashboardAction("checkin")}
                >
                  Check In Guest
                </button>

                <button
                  onClick={() => setDashboardAction("checkout")}
                >
                  Check Out Guest
                </button>

                <button onClick={() => setPage("rooms")}>
                  Manage Rooms
                </button>

                <button onClick={() => setPage("payments")}>
                  Verify Payments
                </button>
              </div>
            </div>
          </div>
        </section>

        {dashboardAction && (
          <div
            className="modal-backdrop"
            onClick={closeQuickAction}
          >
            <div
              className="dashboard-action-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={closeQuickAction}
              >
                ×
              </button>

              {dashboardAction === "new" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitQuickAction();
                  }}
                >
                  <div className="booking-modal-header">
                    <div>
                      <span>RESERVATION</span>
                      <h2>New Reservation</h2>
                    </div>
                  </div>

                  <div className="booking-form-grid">
                    <div className="booking-form-group full">
                      <label htmlFor="quickGuestName">
                        Guest Name
                      </label>

                      <input
                        id="quickGuestName"
                        value={quickForm.guest}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            guest: event.target.value
                          })
                        }
                        placeholder="Enter guest name"
                      />
                    </div>

                    <div className="booking-form-group full">
                      <label htmlFor="quickRoomName">
                        Room Type
                      </label>

                      <select
                        id="quickRoomName"
                        value={quickForm.room}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            room: event.target.value
                          })
                        }
                      >
                        <option value="">
                          Select room type
                        </option>

                        {officialRoomNames.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="booking-form-group">
                      <label htmlFor="quickCheckIn">
                        Check-in
                      </label>

                      <input
                        id="quickCheckIn"
                        type="date"
                        value={quickForm.checkIn}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            checkIn: event.target.value
                          })
                        }
                      />
                    </div>

                    <div className="booking-form-group">
                      <label htmlFor="quickCheckOut">
                        Check-out
                      </label>

                      <input
                        id="quickCheckOut"
                        type="date"
                        value={quickForm.checkOut}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            checkOut: event.target.value
                          })
                        }
                      />
                    </div>

                    <div className="booking-form-group">
                      <label htmlFor="quickGuests">
                        Guests
                      </label>

                      <input
                        id="quickGuests"
                        type="number"
                        min="1"
                        value={quickForm.guests}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            guests: event.target.value
                          })
                        }
                      />
                    </div>

                    <div className="booking-form-group">
                      <label htmlFor="quickAmount">
                        Amount
                      </label>

                      <input
                        id="quickAmount"
                        type="number"
                        min="0"
                        value={quickForm.amount}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            amount: event.target.value
                          })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div className="booking-form-group full">
                      <label htmlFor="quickStatus">
                        Status
                      </label>

                      <select
                        id="quickStatus"
                        value={quickForm.status}
                        onChange={(event) =>
                          setQuickForm({
                            ...quickForm,
                            status: event.target.value
                          })
                        }
                      >
                        <option>Pending</option>
                        <option>Confirmed</option>
                        <option>Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="booking-modal-footer">
                    <button
                      type="button"
                      className="back-dashboard-button"
                      onClick={closeQuickAction}
                    >
                      Cancel
                    </button>

                    <button
                      className="create-reservation-top-button"
                      type="submit"
                    >
                      Save Reservation
                    </button>
                  </div>
                </form>
              )}

              {(dashboardAction === "checkin" ||
                dashboardAction === "checkout") && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitQuickAction();
                  }}
                >
                  <span>FRONT DESK</span>

                  <h2>
                    {dashboardAction === "checkin"
                      ? "Check In Guest"
                      : "Check Out Guest"}
                  </h2>

                  <p>
                    Select the reservation to update its current stay
                    status.
                  </p>

                  <label className="quick-form-field">
                    Reservation

                    <select
                      value={quickForm.bookingId}
                      onChange={(event) =>
                        setQuickForm({
                          ...quickForm,
                          bookingId: event.target.value
                        })
                      }
                      required
                    >
                      <option value="">
                        Choose a reservation
                      </option>

                      {bookings.map((booking) => (
                        <option
                          key={booking.id}
                          value={booking.id}
                        >
                          {booking.id} · {booking.guest}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    className="primary-modal-button"
                    type="submit"
                  >
                    {dashboardAction === "checkin"
                      ? "Confirm Check-in"
                      : "Confirm Check-out"}
                  </button>
                </form>
              )}

              {dashboardAction === "rooms" && (
                <div>
                  <span>ROOM OPERATIONS</span>
                  <h2>Manage Rooms</h2>
                  <p>
                    Review room availability, maintenance, and
                    housekeeping status.
                  </p>

                  <button
                    className="primary-modal-button"
                    onClick={() => {
                      setPage("rooms");
                      closeQuickAction();
                    }}
                  >
                    Open Room Management
                  </button>
                </div>
              )}

              {dashboardAction === "payments" && (
                <div>
                  <span>FINANCIAL OPERATIONS</span>
                  <h2>Verify Payments</h2>
                  <p>
                    Review payment transactions that need attention.
                  </p>

                  <button
                    className="primary-modal-button"
                    onClick={() => {
                      setPage("payments");
                      closeQuickAction();
                    }}
                  >
                    Open Payment Center
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BookingManagement({
  setPage,
  goToBookings,
  admin,
  onLogout,
  onOpenNotifications,
  unreadCount,
  bookings,
  setBookings,
  onBookingStatusChange,
  bookingLoadError,
  bookingAction,
  setBookingAction,
  calendarDate,
  setCalendarDate
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingBookingId, setEditingBookingId] = useState("");
  const [draft, setDraft] = useState({
    guest: "",
    room: "",
    checkIn: "",
    checkOut: "",
    guests: "2",
    amount: "",
    status: "Pending"
  });
  const [formError, setFormError] = useState("");

  const filteredBookings = bookings.filter((booking) => {
    const guest = String(booking.guest || "").toLowerCase();
    const room = String(booking.room || "").toLowerCase();
    const id = String(booking.id || "").toLowerCase();

    const matchesSearch =
      guest.includes(search.toLowerCase()) ||
      room.includes(search.toLowerCase()) ||
      id.includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      booking.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = bookings.filter(
    (booking) => booking.status === "Pending"
  ).length;

  const confirmedCount = bookings.filter(
    (booking) => booking.status === "Confirmed"
  ).length;

  const cancelledCount = bookings.filter(
    (booking) => booking.status === "Cancelled"
  ).length;

  const createBooking = (event) => {
    event.preventDefault();

    if (
      !draft.guest.trim() ||
      !draft.room ||
      !draft.checkIn ||
      !draft.checkOut ||
      !draft.amount
    ) {
      setFormError("Please complete all booking fields.");
      return;
    }

    const bookingValues = {
      guest: draft.guest.trim(),
      room: draft.room,
      checkIn: formatDisplayDate(draft.checkIn),
      checkOut: formatDisplayDate(draft.checkOut),
      guests: Number(draft.guests) || 1,
      amount: `₱${Number(draft.amount).toLocaleString()}`,
      status: draft.status
    };

    setBookings((current) =>
      editingBookingId
        ? current.map((booking) =>
            booking.id === editingBookingId
              ? { ...booking, ...bookingValues }
              : booking
          )
        : [
            {
              id: generateBookingId(current),
              ...bookingValues
            },
            ...current
          ]
    );

    setDraft({
      guest: "",
      room: "",
      checkIn: "",
      checkOut: "",
      guests: "2",
      amount: "",
      status: "Pending"
    });

    setFormError("");
    setBookingAction("");
    setEditingBookingId("");
  };

  const toggleBookingStatus = (id, nextStatus) => {
    onBookingStatusChange(id, nextStatus);
  };

  const deleteBooking = (id) => {
    if (window.confirm("Delete this reservation?")) {
      setBookings((current) =>
        current.filter((booking) => booking.id !== id)
      );
    }
  };

  return (
    <div className="booking-management-main">
      <AdminTopBar
        label="STAYEASE ADMINISTRATION"
        title="Booking management"
        subtitle="Review, confirm, and manage reservations in real time."
        className="booking-management-topbar"
        rightContent={
          <>
            <button
              className="admin-notification-box"
              onClick={onOpenNotifications}
            >
              <DashboardIcon
                src={notificationIcon}
                alt="Notifications"
                className="notification-icon-box"
              />

              <div>
                <strong>{unreadCount} Notifications</strong>
                <span>
                  {unreadCount} unread notifications
                </span>
              </div>
            </button>

            <AdminDateBox
              value={calendarDate}
              onChange={setCalendarDate}
            />
          </>
        }
      />

      <div className="reservation-stat-grid">
        <div className="reservation-stat-card pending-stat">
          <span>PENDING</span>
          <strong>{pendingCount}</strong>
          <p>Awaiting confirmation</p>
        </div>
        <div className="reservation-stat-card confirmed-stat">
          <span>CONFIRMED</span>
          <strong>{confirmedCount}</strong>
          <p>Ready for arrival</p>
        </div>

        <div className="reservation-stat-card cancelled-stat">
          <span>CANCELLED</span>
          <strong>{cancelledCount}</strong>
          <p>Not proceeding</p>
        </div>

        <div className="reservation-stat-card">
          <span>TOTAL</span>
          <strong>{bookings.length}</strong>
          <p>Active reservations</p>
        </div>
      </div>
      {bookingLoadError && (
        <p className="booking-form-error" role="alert">
          Could not load live reservations: {bookingLoadError}
        </p>
      )}

      <div className="reservation-workspace">
        <div className="reservation-toolbar">
          <div>
            <span>BOOKINGS</span>
            <h2>Reservations</h2>
          </div>

          <div className="reservation-toolbar-controls">
            <button
              className="create-reservation-top-button"
              onClick={() => {
                setEditingBookingId("");
                setDraft({
                  guest: "",
                  room: "",
                  checkIn: "",
                  checkOut: "",
                  guests: "2",
                  amount: "",
                  status: "Pending"
                });
                setFormError("");
                setBookingAction("create");
              }}
            >
              NEW RESERVATION
            </button>

            <div className="reservation-search">
              <input
                type="text"
                placeholder="Search guest, room, or code"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              className="reservation-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Checked-in">Checked-in</option>
              <option value="Checked-out">Checked-out</option>
            </select>
          </div>
        </div>

        {bookingAction === "create" && (
          <div
            className="modal-backdrop"
            onClick={() => setBookingAction("")}
          >
            <div
              className="booking-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="booking-modal-header">
                <div>
                  <span>RESERVATION</span>
                  <h2>
                    {editingBookingId
                      ? "Edit Reservation"
                      : "New Reservation"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="notification-close"
                  onClick={() => setBookingAction("")}
                >
                  ×
                </button>
              </div>

              <form
                className="booking-form"
                onSubmit={createBooking}
              >
                <div className="booking-form-grid">
                  <div className="booking-form-group full">
                    <label htmlFor="guestName">
                      Guest Name
                    </label>

                    <input
                      id="guestName"
                      type="text"
                      value={draft.guest}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          guest: event.target.value
                        })
                      }
                      placeholder="Enter guest name"
                    />
                  </div>

                  <div className="booking-form-group full">
                    <label htmlFor="roomName">
                      Room Type
                    </label>

                    <select
                      id="roomName"
                      value={draft.room}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          room: event.target.value
                        })
                      }
                    >
                      <option value="">
                        Select room type
                      </option>

                      {officialRoomNames.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="booking-form-group">
                    <label htmlFor="checkInDate">
                      Check-in
                    </label>

                    <input
                      id="checkInDate"
                      type="date"
                      value={toInputDate(draft.checkIn)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          checkIn: event.target.value
                        })
                      }
                    />
                  </div>

                  <div className="booking-form-group">
                    <label htmlFor="checkOutDate">
                      Check-out
                    </label>

                    <input
                      id="checkOutDate"
                      type="date"
                      value={toInputDate(draft.checkOut)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          checkOut: event.target.value
                        })
                      }
                    />
                  </div>

                  <div className="booking-form-group">
                    <label htmlFor="guestCount">
                      Guests
                    </label>

                    <input
                      id="guestCount"
                      type="number"
                      min="1"
                      value={draft.guests}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          guests: event.target.value
                        })
                      }
                    />
                  </div>

                  <div className="booking-form-group">
                    <label htmlFor="bookingAmount">
                      Amount
                    </label>

                    <input
                      id="bookingAmount"
                      type="number"
                      min="0"
                      value={draft.amount}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          amount: event.target.value
                        })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="booking-form-group full">
                    <label htmlFor="bookingStatus">
                      Status
                    </label>

                    <select
                      id="bookingStatus"
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value
                        })
                      }
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {formError && (
                  <div className="booking-form-error">
                    {formError}
                  </div>
                )}

                <div className="booking-modal-footer">
                  <button
                    type="button"
                    className="back-dashboard-button"
                    onClick={() => setBookingAction("")}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="create-reservation-top-button"
                  >
                    {editingBookingId
                      ? "Update Reservation"
                      : "Save Reservation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {bookingAction === "view" && (
          <div
            className="modal-backdrop"
            onClick={() => setBookingAction("")}
          >
            <div
              className="booking-details-modal"
              onClick={(event) => event.stopPropagation()}
            >
              {(() => {
                const storedBooking = localStorage.getItem(
                  "stayeaseSelectedBooking"
                );

                let selectedBooking = null;

                if (storedBooking) {
                  try {
                    const parsed = JSON.parse(storedBooking);

                    if (typeof parsed === "object" && parsed !== null) {
                      selectedBooking =
                        bookings.find(
                          (booking) => booking.id === parsed.id
                        ) || parsed;
                    }
                  } catch {
                    selectedBooking = null;
                  }
                }

                return selectedBooking ? (
                  <>
                    <div className="booking-modal-header">
                      <div>
                        <span>RESERVATION DETAILS</span>
                        <h2>{selectedBooking.guest}</h2>
                      </div>

                      <button
                        className="modal-close"
                        onClick={() =>
                          setBookingAction("")
                        }
                      >
                        ×
                      </button>
                    </div>

                    <div className="details-grid">
                      <strong>
                        Room:
                        <span>{selectedBooking.room}</span>
                      </strong>

                      <strong>
                        Status:
                        <span>{selectedBooking.status}</span>
                      </strong>

                      <strong>
                        Check-in:
                        <span>{selectedBooking.checkIn}</span>
                      </strong>

                      <strong>
                        Check-out:
                        <span>{selectedBooking.checkOut}</span>
                      </strong>

                      <strong>
                        Guests:
                        <span>{selectedBooking.guests}</span>
                      </strong>

                      <strong>
                        Amount:
                        <span>{selectedBooking.amount}</span>
                      </strong>
                    </div>

                    <div className="booking-modal-footer">
                      <button
                        className="secondary-modal-button"
                        onClick={() =>
                          setBookingAction("")
                        }
                      >
                        Close
                      </button>

                      {selectedBooking.status !== "Confirmed" && (
                        <button
                          className="primary-modal-button"
                          onClick={() =>
                            toggleBookingStatus(
                              selectedBooking.id,
                              "Confirmed"
                            )
                          }
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="reservation-empty">
                    <strong>Reservation not found</strong>
                    <span>
                      This reservation may have been deleted.
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div className="reservation-table-scroll">
          {filteredBookings.length === 0 ? (
            <div className="reservation-empty">
              <strong>No reservations found</strong>
              <span>
                Try adjusting your filters or create a new booking.
              </span>
            </div>
          ) : (
            <div className="reservation-table">
              <div className="reservation-table-header">
                <span>GUEST</span>
                <span>STAY</span>
                <span>GUESTS</span>
                <span>AMOUNT</span>
                <span>STATUS</span>
                <span>ACTIONS</span>
              </div>

              {filteredBookings.map((booking) => (
                <div
                  className={`reservation-table-row ${
                    booking.status === "Pending"
                      ? "pending-row"
                      : ""
                  }`}
                  key={booking.id}
                >
                  <div className="reservation-guest-cell">
                    <div className="reservation-avatar">
                      {booking.guest.charAt(0)}
                    </div>

                    <div>
                      <strong>{booking.guest}</strong>
                      <span>#{booking.id}</span>
                    </div>
                  </div>

                  <div className="reservation-stay-cell">
                    <strong>{booking.room}</strong>

                    <span>
                      {booking.checkIn} - {booking.checkOut}
                    </span>
                  </div>

                  <div className="reservation-guests-cell">
                    {booking.guests} guests
                  </div>

                  <div className="reservation-amount-cell">
                    {booking.amount}
                  </div>

                  <div
                    className={`booking-status ${booking.status
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {booking.status}
                  </div>

                  <div className="reservation-actions">
                    <button
                      className="view-reservation-button"
                      type="button"
                      onClick={() => {
                        localStorage.setItem(
                          "stayeaseSelectedBooking",
                          JSON.stringify(booking)
                        );

                        setBookingAction("view");
                      }}
                    >
                      View
                    </button>

                    {booking.status !== "Confirmed" &&
                      booking.status !== "Cancelled" &&
                      booking.status !== "Checked-in" &&
                      booking.status !== "Checked-out" && (
                        <button
                          className="confirm-reservation-button"
                          type="button"
                          onClick={() =>
                            toggleBookingStatus(
                              booking.id,
                              "Confirmed"
                            )
                          }
                        >
                          Confirm
                        </button>
                      )}

                    {booking.status === "Confirmed" && (
                      <button
                        className="confirm-reservation-button"
                        type="button"
                        onClick={() =>
                          toggleBookingStatus(booking.id, "Checked-in")
                        }
                      >
                        Check in
                      </button>
                    )}

                    {booking.status === "Checked-in" && (
                      <button
                        className="confirm-reservation-button"
                        type="button"
                        onClick={() =>
                          toggleBookingStatus(booking.id, "Checked-out")
                        }
                      >
                        Check out
                      </button>
                    )}

                    {!booking.apiBacked && (
                      <button
                        className="edit-reservation-button"
                        type="button"
                        onClick={() => {
                          setDraft({
                            guest: booking.guest,
                            room: officialRoomNames.includes(
                              booking.room
                            )
                              ? booking.room
                              : "",
                            checkIn: toInputDate(
                              booking.checkIn
                            ),
                            checkOut: toInputDate(
                              booking.checkOut
                            ),
                            guests: String(booking.guests),
                            amount: String(
                              booking.amount
                            ).replace(/[^\d]/g, ""),
                            status: booking.status
                          });

                          setEditingBookingId(booking.id);
                          setFormError("");
                          setBookingAction("create");
                        }}
                      >
                        Edit
                      </button>
                    )}

                    {!booking.apiBacked && (
                      <button
                        className="delete-reservation-button"
                        type="button"
                        onClick={() =>
                          deleteBooking(booking.id)
                        }
                      >
                        Delete
                      </button>
                    )}

                    {["Pending", "Confirmed"].includes(booking.status) && (
                      <button
                        className="cancel-action-button"
                        type="button"
                        onClick={() =>
                          toggleBookingStatus(
                            booking.id,
                            "Cancelled"
                          )
                        }
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppAdmin() {
  const [loggedIn, setLoggedIn] = useState(() => {
    const requestedLogin = new URLSearchParams(
      window.location.search
    ).get("login") === "true";

    return !requestedLogin &&
      localStorage.getItem("stayeaseAdminLoggedIn") === "true";
  });

  const [page, setPage] = useState("dashboard");
  const [bookingAction, setBookingAction] = useState("");
  const [dashboardAction, setDashboardAction] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.has("login")) {
      url.searchParams.delete("login");
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  const [calendarDate, setCalendarDate] = useState(
    () =>
      localStorage.getItem("stayeaseAdminCalendarDate") ||
      getTodayInputDate()
  );

  const [bookings, setBookings] = useState(() => {
    const saved = localStorage.getItem("stayease_bookings");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  });
  const [bookingLoadError, setBookingLoadError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [paymentAlerts, setPaymentAlerts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      "stayease_bookings",
      JSON.stringify(bookings)
    );
  }, [bookings]);

  useEffect(() => {
    if (!loggedIn) return undefined;

    let active = true;
    const refreshBookings = async () => {
      try {
        const records = await requestAdminApi("reservations");
        if (active) {
          const apiBookings = (Array.isArray(records) ? records : []).map(
            mapApiReservation
          );
          setBookings((current) => [
            ...apiBookings,
            ...current.filter((booking) => !booking.apiBacked)
          ]);
          setBookingLoadError("");
        }
      } catch (error) {
        if (active) setBookingLoadError(error.message);
      }
    };

    refreshBookings();
    const refreshInterval = window.setInterval(refreshBookings, 15000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return undefined;

    let active = true;
    const refreshPayments = async () => {
      try {
        const records = await requestAdminApi("payments");
        if (active) setPaymentAlerts(Array.isArray(records) ? records : []);
      } catch (error) {
        if (active) console.error("Could not load payment alerts:", error);
      }
    };

    const createCheckoutReminders = async () => {
      try {
        await requestAdminApi("checkout-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
      } catch (error) {
        if (active) console.error("Could not create checkout reminders:", error);
      }
    };

    refreshPayments();
    createCheckoutReminders();
    const paymentInterval = window.setInterval(refreshPayments, 15000);
    const reminderInterval = window.setInterval(createCheckoutReminders, 15 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(paymentInterval);
      window.clearInterval(reminderInterval);
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;

    let readIds = [];
    let dismissedIds = [];
    try {
      readIds = JSON.parse(localStorage.getItem("stayease_admin_notification_reads") || "[]");
      dismissedIds = JSON.parse(localStorage.getItem("stayease_admin_notification_dismissed") || "[]");
    } catch {
      readIds = [];
      dismissedIds = [];
    }

    const today = getTodayInputDate();
    const tomorrowDate = new Date(`${today}T00:00:00`);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
    const alerts = [
      ...bookings
        .filter((booking) => booking.status === "Pending")
        .map((booking) => ({
          id: `booking-pending:${booking.id}`,
          title: "Reservation needs approval",
          message: `${booking.guest} · ${booking.room} · ${booking.checkIn}`,
          time: "Review booking",
          page: "bookings",
          action: "view",
          bookingId: booking.id
        })),
      ...paymentAlerts
        .filter((payment) => payment.payment_status === "For review")
        .map((payment) => ({
          id: `payment-review:${payment.payment_id}`,
          title: "Payment needs verification",
          message: `${payment.customer_name || "Guest"} · ${payment.reservation_id} · ₱${Number(payment.amount).toLocaleString()}`,
          time: "Verify in payment center",
          page: "payments"
        })),
      ...bookings
        .filter((booking) => {
          const checkOut = toInputDate(booking.checkOut);
          return (
            ["Confirmed", "Checked-in"].includes(booking.status) &&
            (checkOut === today || checkOut === tomorrow)
          );
        })
        .map((booking) => {
          const isToday = toInputDate(booking.checkOut) === today;
          return {
            id: `checkout:${booking.id}:${toInputDate(booking.checkOut)}`,
            title: isToday ? "Check-out due today" : "Check-out due tomorrow",
            message: `${booking.guest} · ${booking.room} · reservation ${booking.id}`,
            time: isToday ? "Prepare departure" : "Upcoming departure",
            page: "bookings",
            action: "view",
            bookingId: booking.id
          };
        })
    ];

    setNotifications(
      alerts
        .filter((notification) => !dismissedIds.includes(notification.id))
        .map((notification) => ({
          ...notification,
          unread: !readIds.includes(notification.id)
        }))
    );
  }, [bookings, paymentAlerts, loggedIn]);

  useEffect(() => {
    localStorage.setItem(
      "stayeaseAdminCalendarDate",
      calendarDate
    );
  }, [calendarDate]);

  const admin = useMemo(() => {
    const saved = localStorage.getItem("stayeaseAdmin");

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          username: "admin",
          name: "StayEase Administrator",
          role: "Administrator"
        };
      }
    }

    return {
      username: "admin",
      name: "StayEase Administrator",
      role: "Administrator"
    };
  }, [loggedIn]);

  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  const handleLogin = () => {
    setLoggedIn(true);
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("stayeaseAdminLoggedIn");
    setLoggedIn(false);
    setPage("dashboard");
  };

  const goToBookings = (
    action = "",
    booking = null
  ) => {
    setBookingAction(action);

    if (booking) {
      localStorage.setItem(
        "stayeaseSelectedBooking",
        JSON.stringify(booking)
      );
    } else {
      localStorage.removeItem(
        "stayeaseSelectedBooking"
      );
    }

    setPage("bookings");
  };

  const handleBookingStatusChange = async (id, status) => {
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;

    if (!booking.apiBacked) {
      setBookings((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      );
      return;
    }

    try {
      await requestAdminApi("reservation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: id, status })
      });
      setBookings((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      );
    } catch (error) {
      window.alert(`Could not update reservation: ${error.message}`);
    }
  };

  const markAllNotificationsRead = () => {
    localStorage.setItem(
      "stayease_admin_notification_reads",
      JSON.stringify(notifications.map((notification) => notification.id))
    );
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false
      }))
    );
  };

  const handleNotificationClick = (notification) => {
    const readIds = JSON.parse(
      localStorage.getItem("stayease_admin_notification_reads") || "[]"
    );
    localStorage.setItem(
      "stayease_admin_notification_reads",
      JSON.stringify([...new Set([...readIds, notification.id])])
    );
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, unread: false }
          : item
      )
    );

    const relatedBooking = bookings.find(
      (booking) => booking.id === notification.bookingId
    );
    if (relatedBooking) {
      localStorage.setItem(
        "stayeaseSelectedBooking",
        JSON.stringify(relatedBooking)
      );
    } else {
      localStorage.removeItem("stayeaseSelectedBooking");
    }

    setShowNotifications(false);
    setPage(notification.page || "dashboard");
    setBookingAction(relatedBooking ? notification.action || "view" : "");
  };

  const deleteNotification = (id) => {
    const dismissedIds = JSON.parse(
      localStorage.getItem("stayease_admin_notification_dismissed") || "[]"
    );
    localStorage.setItem(
      "stayease_admin_notification_dismissed",
      JSON.stringify([...new Set([...dismissedIds, id])])
    );
    setNotifications((current) =>
      current.filter(
        (notification) => notification.id !== id
      )
    );
  };

  const openNotificationsPage = () => {
    setShowNotifications(false);
    setPage("notifications");
  };

  if (!loggedIn) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <>
      <div className="admin-app-shell">
        <Sidebar
          page={page}
          setPage={setPage}
          admin={admin}
          onLogout={handleLogout}
          onOpenNotifications={() =>
            setShowNotifications(true)
          }
          unreadCount={unreadCount}
        />

        <div className="admin-page-shell">
          {page === "dashboard" && (
            <AdminDashboard
              setPage={setPage}
              goToBookings={goToBookings}
              admin={admin}
              onLogout={handleLogout}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
              bookings={bookings}
              setBookings={setBookings}
              onBookingStatusChange={handleBookingStatusChange}
              paymentRecords={paymentAlerts}
              bookingLoadError={bookingLoadError}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              dashboardAction={dashboardAction}
              setDashboardAction={setDashboardAction}
            />
          )}

          {page === "bookings" && (
            <BookingManagement
              setPage={setPage}
              goToBookings={goToBookings}
              admin={admin}
              onLogout={handleLogout}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
              bookings={bookings}
              setBookings={setBookings}
              onBookingStatusChange={handleBookingStatusChange}
              bookingLoadError={bookingLoadError}
              bookingAction={bookingAction}
              setBookingAction={setBookingAction}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
            />
          )}

          {page === "rooms" && (
            <RoomManagement
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
              onRoomStatusChange={() =>
                setPage("rooms")
              }
            />
          )}

          {page === "customers" && (
            <CustomerManagement
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
            />
          )}

          {page === "payments" && (
            <PaymentManagement
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
            />
          )}

          {page === "reports" && (
            <ReportsManagement
              bookings={bookings}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
            />
          )}

          {page === "notifications" && (
            <NotificationsManagement
              notifications={notifications}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
              onMarkAllRead={markAllNotificationsRead}
              onNotificationClick={
                handleNotificationClick
              }
              onDeleteNotification={
                deleteNotification
              }
            />
          )}

          {page === "room-amenities" && (
            <RoomAmenitiesManagement
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
            />
          )}

          {["amenities"].includes(page) && (
            <ManagementPage
              page={page}
              onOpenNotifications={() =>
                setShowNotifications(true)
              }
              unreadCount={unreadCount}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
            />
          )}
        </div>
      </div>

      {showNotifications && (
        <>
          <div
            className="notification-panel-overlay"
            onClick={() =>
              setShowNotifications(false)
            }
          ></div>

          <NotificationPanel
            notifications={notifications}
            onClose={() =>
              setShowNotifications(false)
            }
            onMarkAllRead={markAllNotificationsRead}
            onNotificationClick={
              handleNotificationClick
            }
            onViewAll={openNotificationsPage}
          />
        </>
      )}
    </>
  );
}

export default AppAdmin;