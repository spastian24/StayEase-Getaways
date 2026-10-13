import { useState } from "react";
import CalendarControl from "./CalendarControl.jsx";
import "./ReportsManagement.css";
import notificationIcon from "./assets/notification.png";

const reportPeriods = ["Daily", "Weekly", "Monthly", "Annual"];
const TOTAL_ROOMS = 50;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBookingDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed);
}

function formatReportDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default function ReportsManagement({
  bookings,
  calendarDate,
  setCalendarDate,
  onOpenNotifications,
  unreadCount
}) {
  const [period, setPeriod] = useState("Daily");
  const selectedDate = new Date(`${calendarDate}T00:00:00`);
  const rangeStart = new Date(selectedDate);
  let rangeEnd = new Date(selectedDate);

  if (period === "Daily") {
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else if (period === "Weekly") {
    const daysFromMonday = (rangeStart.getDay() + 6) % 7;
    rangeStart.setDate(rangeStart.getDate() - daysFromMonday);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
  } else if (period === "Monthly") {
    rangeStart.setDate(1);
    rangeEnd = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth() + 1,
      1
    );
  } else {
    rangeStart.setMonth(0, 1);
    rangeEnd = new Date(rangeStart.getFullYear() + 1, 0, 1);
  }

  const rangeStartKey = dateKey(rangeStart);
  const rangeEndKey = dateKey(rangeEnd);
  const reportBookings = bookings.filter((booking) => {
    const bookingDate = parseBookingDate(
      booking.reportDate || booking.createdAt || booking.checkIn
    );
    return (
      bookingDate &&
      bookingDate >= rangeStartKey &&
      bookingDate < rangeEndKey
    );
  });

  const pending = reportBookings.filter(
    (booking) => booking.status === "Pending"
  ).length;

  const confirmed = reportBookings.filter(
    (booking) => booking.status === "Confirmed"
  ).length;

  const checkedIn = reportBookings.filter(
    (booking) => booking.status === "Checked-in"
  ).length;

  const checkedOut = reportBookings.filter(
    (booking) => booking.status === "Checked-out"
  ).length;

  const cancelled = reportBookings.filter(
    (booking) => booking.status === "Cancelled"
  ).length;

  const activeBookings = reportBookings.filter(
    (booking) =>
      booking.status === "Confirmed" ||
      booking.status === "Checked-in"
  );

  const revenue = reportBookings
    .filter((booking) => booking.status !== "Cancelled")
    .reduce(
      (total, booking) =>
        total +
        Number(String(booking.amount || "").replace(/[^\d.-]/g, "")),
      0
    );

  const occupancyCount = Math.min(activeBookings.length, TOTAL_ROOMS);
  const occupancyPercentage =
    TOTAL_ROOMS > 0
      ? Math.round((occupancyCount / TOTAL_ROOMS) * 100)
      : 0;

  const periodCopy = {
    Daily: "Daily booking report",
    Weekly: "Weekly booking report",
    Monthly: "Monthly booking report",
    Annual: "Annual booking report"
  };

  const rangeLabel =
    period === "Daily"
      ? formatReportDate(rangeStart)
      : `${formatReportDate(rangeStart)} – ${formatReportDate(
          new Date(rangeEnd.getTime() - 86400000)
        )}`;

  const reportRows = reportBookings.map((booking) => ({
    booking: booking.id,
    date: parseBookingDate(
      booking.reportDate || booking.createdAt || booking.checkIn
    ),
    guest: booking.guest,
    room: booking.room,
    amount: booking.amount,
    status: booking.status
  }));

  const trendBuckets =
    period === "Daily"
      ? Array.from({ length: 6 }, (_, index) => ({
          key: index,
          label: ["12a", "4a", "8a", "12p", "4p", "8p"][index],
          count: 0
        }))
      : period === "Weekly"
        ? Array.from({ length: 7 }, (_, index) => {
            const date = new Date(rangeStart);
            date.setDate(date.getDate() + index);
            return {
              key: dateKey(date),
              label: date.toLocaleDateString("en-US", { weekday: "short" }),
              count: 0
            };
          })
        : period === "Monthly"
          ? Array.from(
              {
                length: Math.ceil(
                  (rangeEnd - rangeStart) / 86400000 / 7
                )
              },
              (_, index) => ({
                key: index,
                label: `Week ${index + 1}`,
                count: 0
              })
            )
          : Array.from({ length: 12 }, (_, index) => ({
              key: index,
              label: new Date(rangeStart.getFullYear(), index, 1)
                .toLocaleDateString("en-US", { month: "short" }),
              count: 0
            }));

  reportBookings.forEach((booking) => {
    const bookingDate = parseBookingDate(
      booking.reportDate || booking.createdAt || booking.checkIn
    );
    if (!bookingDate) return;

    let bucketIndex;
    if (period === "Daily") {
      const hour = Number(booking.createdAt?.slice(11, 13));
      bucketIndex = Number.isFinite(hour) ? Math.floor(hour / 4) : 3;
    } else if (period === "Weekly") {
      bucketIndex = trendBuckets.findIndex((bucket) => bucket.key === bookingDate);
    } else if (period === "Monthly") {
      bucketIndex = Math.floor((Number(bookingDate.slice(8, 10)) - 1) / 7);
    } else {
      bucketIndex = Number(bookingDate.slice(5, 7)) - 1;
    }

    if (trendBuckets[bucketIndex]) trendBuckets[bucketIndex].count += 1;
  });

  const maxTrendValue = Math.max(
    ...trendBuckets.map((bucket) => bucket.count),
    1
  );

  const downloadExcel = () => {
    const header = [
      "Report period",
      "Booking date",
      "Booking",
      "Guest",
      "Room",
      "Amount",
      "Status"
    ];

    const rows = reportRows.map((row) => [
      period,
      row.date,
      row.booking,
      row.guest,
      row.room,
      row.amount,
      row.status
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value).replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `stayease-${period.toLowerCase()}-report-${rangeStartKey}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    window.print();
  };

  return (
    <main className="admin-main reports-page">
      <header className="admin-topbar">
        <div className="admin-welcome">
          <span className="admin-page-label">
            STAYEASE ADMINISTRATION / REPORTS
          </span>

          <h1>Reports &amp; Analytics</h1>

          <p>
            View booking, payment, and occupancy performance across every reporting period.
          </p>
        </div>

        <div className="admin-topbar-right">
          <button
            className="admin-notification-box"
            onClick={onOpenNotifications}
          >
            <img
              className="notification-icon-box"
              src={notificationIcon}
              alt="Notifications"
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
        </div>
      </header>

      <section className="reports-hero">
        <div>
          <span>OPERATIONS INTELLIGENCE</span>

          <h2>{periodCopy[period]}</h2>

          <p>
            Bookings created {rangeLabel}. Choose a date above to set the reporting period.
          </p>
        </div>

        <div className="reports-controls">
          <div className="report-period-tabs">
            {reportPeriods.map((item) => (
              <button
                key={item}
                className={period === item ? "active" : ""}
                onClick={() => setPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="report-download-actions">
            <button onClick={downloadPdf}>Download PDF</button>
            <button onClick={downloadExcel}>Download Excel</button>
          </div>
        </div>
      </section>

      <section className="reports-metric-grid">
        <article>
          <span>RESERVATIONS</span>
          <strong>{reportBookings.length}</strong>
          <small>{pending} pending review</small>
        </article>

        <article>
          <span>CONFIRMED BOOKINGS</span>
          <strong>{confirmed}</strong>
          <small>{cancelled} cancelled</small>
        </article>

        <article>
          <span>REVENUE</span>
          <strong>₱{revenue.toLocaleString()}</strong>
          <small>From active bookings</small>
        </article>

        <article>
          <span>OCCUPANCY</span>
          <strong>{occupancyPercentage}%</strong>
          <small>
            {occupancyCount} of {TOTAL_ROOMS} rooms
          </small>
        </article>
      </section>

      <section className="reports-content-grid">
        <article className="report-panel report-chart-panel">
          <div className="report-panel-heading">
            <div>
              <span>BOOKING TREND</span>
              <h3>{period} reservations</h3>
            </div>

            <strong>{reportBookings.length} total</strong>
          </div>

          {reportBookings.length > 0 ? (
            <div className="report-bars">
              {trendBuckets.map((bucket) => {
                const barHeight = (bucket.count / maxTrendValue) * 100;

                return (
                  <div
                    className="report-bar-column"
                    key={bucket.key}
                    title={`${bucket.label}: ${bucket.count} booking${bucket.count === 1 ? "" : "s"}`}
                  >
                    <div
                      className="report-bar"
                      style={{
                        height: `${barHeight}%`,
                        minHeight: 0
                      }}
                    ></div>

                    <small>{bucket.label}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="report-empty-state">
              <strong>No booking data yet</strong>
              <span>
                New reservations will appear here once they are added.
              </span>
            </div>
          )}
        </article>

        <article className="report-panel">
          <div className="report-panel-heading">
            <div>
              <span>STATUS MIX</span>
              <h3>Reservation health</h3>
            </div>
          </div>

          <div className="report-status-list">
            <div>
              <span className="report-dot confirmed"></span>
              <span>Confirmed</span>
              <strong>{confirmed}</strong>
            </div>

            <div>
              <span className="report-dot pending"></span>
              <span>Pending</span>
              <strong>{pending}</strong>
            </div>

            <div>
              <span className="report-dot confirmed"></span>
              <span>Checked-in</span>
              <strong>{checkedIn}</strong>
            </div>

            <div>
              <span className="report-dot cancelled"></span>
              <span>Checked-out</span>
              <strong>{checkedOut}</strong>
            </div>

            <div>
              <span className="report-dot cancelled"></span>
              <span>Cancelled</span>
              <strong>{cancelled}</strong>
            </div>
          </div>

          <div className="report-occupancy-band">
            <span>ROOM OCCUPANCY</span>

            <strong>{occupancyPercentage}%</strong>

            <div>
              <i
                style={{
                  width: `${occupancyPercentage}%`
                }}
              ></i>
            </div>

            <small>
              {checkedIn > 0
                ? `${checkedIn} checked-in reservation${checkedIn > 1 ? "s" : ""}`
                : activeBookings.length > 0
                ? `${activeBookings.length} active reservation${activeBookings.length > 1 ? "s" : ""}`
                : "No occupied rooms yet"}
            </small>
          </div>
        </article>
      </section>

      <section className="report-panel reports-table-panel">
        <div className="report-panel-heading">
          <div>
            <span>{period.toUpperCase()} REPORT VIEW</span>
            <h3>Bookings in this period</h3>
          </div>

          <strong>{reportRows.length} rows</strong>
        </div>

        <div className="reports-table-scroll">
          {reportBookings.length > 0 ? (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Booking date</th>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Stay</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {reportRows.map((booking) => (
                  <tr key={booking.id}>
                    <td>{formatReportDate(new Date(`${booking.date}T00:00:00`))}</td>
                    <td>{booking.booking}</td>
                    <td>{booking.guest}</td>
                    <td>{booking.room}</td>
                    <td>{booking.amount}</td>
                    <td>
                      <span
                        className={`report-status ${booking.status.toLowerCase()}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="report-empty-table">
              <strong>No bookings in this reporting period</strong>
              <span>
                Choose a different date or period to view more bookings.
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}