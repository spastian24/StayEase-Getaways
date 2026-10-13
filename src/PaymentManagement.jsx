import { useEffect, useState } from "react";
import CalendarControl from "./CalendarControl.jsx";
import "./PaymentManagement.css";
import notificationIcon from "./assets/notification.png";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}/stayease-api/stayease.php`;

async function requestPaymentApi(action, options = {}) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("action", action);
  const response = await fetch(url, {
    credentials: "include",
    ...options
  });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `The request failed (${response.status}).`);
    error.data = result.data;
    error.status = response.status;
    throw error;
  }

  return result.data;
}

function mapApiPayment(payment) {
  return {
    id: payment.payment_id,
    booking: payment.reservation_id,
    customer: payment.customer_name || "Guest",
    method: payment.payment_method || "GCash",
    amount: `₱${Number(payment.amount).toLocaleString()}`,
    date: payment.payment_date || "",
    status: payment.payment_status || "For review",
    confirmationEmailSentAt: payment.confirmation_email_sent_at || null,
    apiBacked: true
  };
}

const emptyPayment = {
  booking: "",
  customer: "",
  method: "GCash",
  amount: "",
  date: "",
  status: "For review"
};

export default function PaymentManagement({
  calendarDate,
  setCalendarDate,
  onOpenNotifications,
  unreadCount
}) {
  const [payments, setPayments] = useState(() => {
    const saved = localStorage.getItem("stayease_payments");

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

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [modal, setModal] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyPayment);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const refreshPayments = async () => {
      try {
        const records = await requestPaymentApi("payments");
        if (!active) return;
        const apiPayments = (Array.isArray(records) ? records : []).map(mapApiPayment);
        const apiBookingIds = new Set(apiPayments.map((payment) => payment.booking));
        setPayments((current) => [
          ...apiPayments,
          ...current.filter(
            (payment) =>
              !payment.apiBacked &&
              !apiBookingIds.has(payment.booking)
          )
        ]);
        setLoadError("");
      } catch (requestError) {
        if (active) setLoadError(requestError.message);
      }
    };

    refreshPayments();
    const interval = window.setInterval(refreshPayments, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "stayease_payments",
      JSON.stringify(payments)
    );
  }, [payments]);

  useEffect(() => {
    const syncBookings = () => {
      const saved = localStorage.getItem("stayease_bookings");

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setBookings(Array.isArray(parsed) ? parsed : []);
        } catch {
          setBookings([]);
        }
      } else {
        setBookings([]);
      }
    };

    syncBookings();

    window.addEventListener("storage", syncBookings);

    const interval = setInterval(syncBookings, 500);

    return () => {
      window.removeEventListener("storage", syncBookings);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!bookings.length) {
      return;
    }

    setPayments((current) => {
      const existingBookingIds = new Set(
        current.map((payment) => payment.booking)
      );

      const newPayments = bookings
        .filter(
          (booking) =>
            booking.status !== "Cancelled" &&
            !booking.apiBacked &&
            !existingBookingIds.has(booking.id)
        )
        .map((booking) => ({
          id: `PAY-${String(Date.now() + Math.random()).slice(-6)}`,
          booking: booking.id,
          customer: booking.guest,
          method: "GCash",
          amount: booking.amount,
          date: booking.checkIn || "",
          status: "For review"
        }));

      return newPayments.length
        ? [...newPayments, ...current]
        : current;
    });
  }, [bookings]);

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = `${payment.id} ${payment.booking} ${payment.customer}`
      .toLowerCase()
      .includes(search.toLowerCase());

    return (
      matchesSearch &&
      (filter === "All" || payment.status === filter)
    );
  });

  const openForm = (payment = null) => {
    setEditingId(payment?.id || "");
    setForm(
      payment
        ? { ...payment }
        : { ...emptyPayment }
    );
    setError("");
    setModal("form");
  };

  const submitPayment = async (event) => {
    event.preventDefault();

    if (
      !form.booking.trim() ||
      !form.customer.trim() ||
      !form.amount.trim() ||
      !form.date.trim()
    ) {
      setError(
        "Please complete the booking, customer, amount, and date fields."
      );
      return;
    }

    const values = {
      ...form,
      booking: form.booking.trim(),
      customer: form.customer.trim(),
      amount: form.amount.trim()
    };

    if (editingId) {
      setPayments((current) =>
        current.map((payment) =>
          payment.id === editingId
            ? { ...payment, ...values }
            : payment
        )
      );
    } else {
      const amount = Number(values.amount.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        setError("Enter a valid payment amount.");
        return;
      }

      try {
        await requestPaymentApi("payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: values.booking,
            customer_name: values.customer,
            payment_method: values.method,
            amount,
            payment_status: "For review"
          })
        });
        const records = await requestPaymentApi("payments");
        setPayments((current) => [
          ...(Array.isArray(records) ? records : []).map(mapApiPayment),
          ...current.filter((payment) => !payment.apiBacked)
        ]);
      } catch (requestError) {
        setError(`Could not record payment: ${requestError.message}`);
        return;
      }
    }

    setModal("");
    setEditingId("");
    setForm({ ...emptyPayment });
  };

  const updateStatus = async (payment, status) => {
    if (
      status === "Paid" &&
      payment.status !== "Paid" &&
      !window.confirm(
        "Have you independently verified this transaction in GCash or the bank? Only mark it received after confirming the amount and reference."
      )
    ) {
      return;
    }

    if (!payment.apiBacked) {
      setPayments((current) =>
        current.map((item) =>
          item.id === payment.id ? { ...item, status } : item
        )
      );
      return;
    }

    setError("");
    try {
      await requestPaymentApi("payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: payment.id,
          payment_status: status
        })
      });
      setPayments((current) =>
        current.map((item) =>
          item.id === payment.id
            ? {
                ...item,
                status,
                confirmationEmailSentAt:
                  status === "Paid"
                    ? item.confirmationEmailSentAt || new Date().toISOString()
                    : item.confirmationEmailSentAt
              }
            : item
        )
      );
    } catch (requestError) {
      if (requestError.data?.payment_status) {
        setPayments((current) =>
          current.map((item) =>
            item.id === payment.id
              ? { ...item, status: requestError.data.payment_status }
              : item
          )
        );
      }
      setError(
        requestError.data?.payment_status
          ? requestError.message
          : `Could not update payment: ${requestError.message}`
      );
    }
  };

  const deletePayment = (id) => {
    if (window.confirm("Delete this payment transaction?")) {
      setPayments((current) =>
        current.filter((payment) => payment.id !== id)
      );
    }
  };

  const collectedAmount = payments
    .filter((payment) => payment.status === "Paid")
    .reduce(
      (sum, payment) =>
        sum +
        Number(
          String(payment.amount || "").replace(/[^\d]/g, "")
        ),
      0
    );

  const reviewCount = payments.filter(
    (payment) => payment.status === "For review"
  ).length;

  return (
    <main className="admin-main payment-management-page">
      <header className="admin-topbar">
        <div className="admin-welcome">
          <span className="admin-page-label">
            STAYEASE ADMINISTRATION / PAYMENTS
          </span>

          <h1>Payment center</h1>

          <p>
            View, monitor, and manage every payment transaction.
          </p>
        </div>

        <div className="admin-topbar-right">
          <button
            className="admin-notification-box"
            onClick={onOpenNotifications}
          >
            <img
              className="payment-notification-icon"
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

      <section className="payment-summary-row">
        <div>
          <span>COLLECTED</span>
          <strong>
            ₱{collectedAmount.toLocaleString()}
          </strong>
        </div>

        <div>
          <span>FOR REVIEW</span>
          <strong>{reviewCount}</strong>
        </div>

        <div>
          <span>TRANSACTIONS</span>
          <strong>{payments.length}</strong>
        </div>
      </section>

      <section className="payment-workspace">
        <p className="payment-verification-note">
          For GCash and bank transfers, compare the transaction in the provider's
          official app or statement before marking it received. StayEase does not
          verify payments automatically.
        </p>
        {loadError && <p className="payment-error">{`Could not load shared payments: ${loadError}`}</p>}
        {error && <p className="payment-error">{error}</p>}
        <div className="payment-toolbar">
          <div>
            <span>FINANCIAL OPERATIONS</span>
            <h2>Transactions</h2>
          </div>

          <div className="payment-toolbar-actions">
            <input
              placeholder="Search payment, booking, or customer"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
            >
              <option>All</option>
              <option>Paid</option>
              <option>For review</option>
              <option>Refunded</option>
              <option>Failed</option>
            </select>

            <button
              className="payment-primary-button"
              onClick={() => openForm()}
            >
              New Payment
            </button>
          </div>
        </div>

        <div className="payment-table-scroll">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <strong>{payment.id}</strong>
                    <small>{payment.booking}</small>
                  </td>

                  <td>{payment.customer}</td>

                  <td>{payment.method}</td>

                  <td>
                    <strong>{payment.amount}</strong>
                  </td>

                  <td>{payment.date}</td>

                  <td>
                    <button
                      type="button"
                      className={`payment-status status-${payment.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                      disabled
                    >
                      {payment.status}
                    </button>
                  </td>

                  <td>
                    <div className="payment-row-actions">
                      <button
                        onClick={() =>
                          setModal(payment.id)
                        }
                      >
                        View
                      </button>

                      {payment.apiBacked ? (
                        payment.status === "For review" ? (
                          <button onClick={() => updateStatus(payment, "Paid")}>
                            Verify received
                          </button>
                        ) : payment.status === "Paid" &&
                          !payment.confirmationEmailSentAt ? (
                          <button onClick={() => updateStatus(payment, "Paid")}>
                            Send confirmation
                          </button>
                        ) : null
                      ) : (
                        <>
                          <button onClick={() => openForm(payment)}>Edit</button>
                          <button
                            className="danger"
                            onClick={() => deletePayment(payment.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredPayments.length && (
            <div className="payment-empty">
              No transactions match your filters.
            </div>
          )}
        </div>
      </section>

      {modal && (
        <div
          className="payment-modal-backdrop"
          onClick={() => setModal("")}
        >
          <section
            className="payment-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {modal === "form" ? (
              <form onSubmit={submitPayment}>
                <div className="payment-modal-heading">
                  <div>
                    <span>
                      {editingId
                        ? "UPDATE TRANSACTION"
                        : "NEW TRANSACTION"}
                    </span>

                    <h2>
                      {editingId
                        ? "Edit payment"
                        : "New payment"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModal("")}
                  >
                    ×
                  </button>
                </div>

                <div className="payment-form-grid">
                  <label>
                    Booking ID
                    <input
                      value={form.booking}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          booking: event.target.value
                        })
                      }
                      placeholder="SE-1006"
                    />
                  </label>

                  <label>
                    Customer
                    <input
                      value={form.customer}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          customer: event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Payment method
                    <select
                      value={form.method}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          method: event.target.value
                        })
                      }
                    >
                      <option>GCash</option>
                      <option>Bank transfer</option>
                      <option>Cash</option>
                      <option>Credit card</option>
                    </select>
                  </label>

                  <label>
                    Amount
                    <input
                      value={form.amount}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amount: event.target.value
                        })
                      }
                      placeholder="₱0"
                    />
                  </label>

                  <label>
                    Date
                    <input
                      value={form.date}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          date: event.target.value
                        })
                      }
                      placeholder="Sep 16, 2026"
                    />
                  </label>

                  <label>
                    Status
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value
                        })
                      }
                    >
                      <option>For review</option>
                      <option>Paid</option>
                      <option>Refunded</option>
                      <option>Failed</option>
                    </select>
                  </label>
                </div>

                {error && (
                  <p className="payment-form-error">
                    {error}
                  </p>
                )}

                <div className="payment-modal-actions">
                  <button
                    type="button"
                    onClick={() => setModal("")}
                  >
                    Cancel
                  </button>

                  <button className="payment-primary-button">
                    {editingId
                      ? "Update Payment"
                      : "Save Payment"}
                  </button>
                </div>
              </form>
            ) : (
              (() => {
                const payment = payments.find(
                  (item) => item.id === modal
                );

                return (
                  payment && (
                    <>
                      <div className="payment-modal-heading">
                        <div>
                          <span>
                            TRANSACTION DETAILS
                          </span>

                          <h2>{payment.id}</h2>
                        </div>

                        <button
                          onClick={() => setModal("")}
                        >
                          ×
                        </button>
                      </div>

                      <div className="payment-profile-grid">
                        <span>
                          Customer
                          <strong>
                            {payment.customer}
                          </strong>
                        </span>

                        <span>
                          Booking
                          <strong>
                            {payment.booking}
                          </strong>
                        </span>

                        <span>
                          Method
                          <strong>
                            {payment.method}
                          </strong>
                        </span>

                        <span>
                          Amount
                          <strong>
                            {payment.amount}
                          </strong>
                        </span>

                        <span>
                          Status
                          <strong>
                            {payment.status}
                          </strong>
                        </span>

                        <span>
                          Date
                          <strong>
                            {payment.date}
                          </strong>
                        </span>
                      </div>

                      <div className="payment-modal-actions">
                        <button
                          onClick={() =>
                            openForm(payment)
                          }
                        >
                          Edit transaction
                        </button>

                        <button
                          className="payment-primary-button"
                          onClick={() =>
                            setModal("")
                          }
                        >
                          Close
                        </button>
                      </div>
                    </>
                  )
                );
              })()
            )}
          </section>
        </div>
      )}
    </main>
  );
}