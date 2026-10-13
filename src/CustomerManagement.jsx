import { useState, useEffect } from "react";
import CalendarControl from "./CalendarControl.jsx";
import "./CustomerManagement.css";
import notificationIcon from "./assets/notification.png";

const emptyCustomer = {
  name: "",
  email: "",
  phone: "",
  stays: "0",
  status: "Active",
  lastStay: ""
};

export default function CustomerManagement({
  calendarDate,
  setCalendarDate,
  onOpenNotifications,
  unreadCount
}) {
  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem("stayease_customers");

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
  const [modal, setModal] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyCustomer);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(
      "stayease_customers",
      JSON.stringify(customers)
    );
  }, [customers]);

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

    setCustomers((current) => {
      const updatedCustomers = [...current];

      bookings
        .filter((booking) => booking.status !== "Cancelled")
        .forEach((booking) => {
          const bookingName = String(booking.guest || "").trim();

          if (!bookingName) {
            return;
          }

          const bookingEmail = String(
            booking.email || booking.customerEmail || ""
          )
            .trim()
            .toLowerCase();

          const bookingPhone = String(
            booking.phone || booking.customerPhone || ""
          ).trim();

          let existingIndex = -1;

          if (bookingEmail) {
            existingIndex = updatedCustomers.findIndex(
              (customer) =>
                String(customer.email || "")
                  .trim()
                  .toLowerCase() === bookingEmail
            );
          }

          if (existingIndex === -1) {
            existingIndex = updatedCustomers.findIndex(
              (customer) =>
                String(customer.name || "")
                  .trim()
                  .toLowerCase() === bookingName.toLowerCase()
            );
          }

          if (existingIndex !== -1) {
            const existingCustomer =
              updatedCustomers[existingIndex];

            const bookingIds = Array.isArray(
              existingCustomer.bookingIds
            )
              ? existingCustomer.bookingIds
              : [];

            if (!bookingIds.includes(booking.id)) {
              const updatedBookingIds = [
                ...bookingIds,
                booking.id
              ];

              updatedCustomers[existingIndex] = {
                ...existingCustomer,
                email:
                  existingCustomer.email ||
                  bookingEmail,
                phone:
                  existingCustomer.phone ||
                  bookingPhone,
                stays: updatedBookingIds.length,
                lastStay:
                  booking.checkOut ||
                  existingCustomer.lastStay ||
                  "",
                bookingIds: updatedBookingIds
              };
            }
          } else {
            updatedCustomers.unshift({
              id: `CUS-${String(
                Date.now() + Math.random()
              ).slice(-6)}`,
              name: bookingName,
              email: bookingEmail,
              phone: bookingPhone,
              stays: 1,
              status: "Active",
              lastStay: booking.checkOut || "",
              bookingIds: [booking.id]
            });
          }
        });

      return updatedCustomers;
    });
  }, [bookings]);

  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.email} ${customer.id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId("");
    setForm({ ...emptyCustomer });
    setError("");
    setModal("form");
  };

  const openEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      ...customer,
      stays: String(customer.stays || 0)
    });
    setError("");
    setModal("form");
  };

  const submitCustomer = (event) => {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      setError(
        "Please complete the customer name, email, and phone number."
      );
      return;
    }

    const values = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      stays: Number(form.stays) || 0
    };

    if (editingId) {
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === editingId
            ? { ...customer, ...values }
            : customer
        )
      );
    } else {
      const newCustomer = {
        ...values,
        id: `CUS-${String(
          Date.now()
        ).slice(-6)}`,
        bookingIds: []
      };

      setCustomers((current) => [
        newCustomer,
        ...current
      ]);
    }

    setModal("");
    setEditingId("");
    setForm({ ...emptyCustomer });
    setError("");
  };

  const deleteCustomer = (id) => {
    if (window.confirm("Remove this customer record?")) {
      setCustomers((current) =>
        current.filter(
          (customer) => customer.id !== id
        )
      );
    }
  };

  const toggleStatus = (id) => {
    setCustomers((current) =>
      current.map((customer) =>
        customer.id === id
          ? {
              ...customer,
              status:
                customer.status === "Inactive"
                  ? "Active"
                  : "Inactive"
            }
          : customer
      )
    );
  };

  return (
    <main className="admin-main customer-management-page">
      <header className="admin-topbar">
        <div className="admin-welcome">
          <span className="admin-page-label">
            STAYEASE ADMINISTRATION / CUSTOMERS
          </span>

          <h1>Customer directory</h1>

          <p>
            View and manage guest records, contact details, and stay history.
          </p>
        </div>

        <div className="admin-topbar-right">
          <button
            className="admin-notification-box"
            onClick={onOpenNotifications}
          >
            <img
              className="customer-notification-icon"
              src={notificationIcon}
              alt="Notifications"
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

          <CalendarControl
            value={calendarDate}
            onChange={setCalendarDate}
          />
        </div>
      </header>

      <section className="customer-summary-row">
        <div>
          <span>ACTIVE RECORDS</span>

          <strong>
            {
              customers.filter(
                (customer) =>
                  customer.status !== "Inactive"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>VIP GUESTS</span>

          <strong>
            {
              customers.filter(
                (customer) =>
                  customer.status === "VIP"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>TOTAL STAYS</span>

          <strong>
            {customers.reduce(
              (total, customer) =>
                total +
                Number(customer.stays || 0),
              0
            )}
          </strong>
        </div>
      </section>

      <section className="customer-workspace">
        <div className="customer-toolbar">
          <div>
            <span>GUEST RELATIONSHIPS</span>
            <h2>Customer records</h2>
          </div>

          <div className="customer-toolbar-actions">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, email, or ID"
            />

            <button
              className="customer-primary-button"
              onClick={openCreate}
            >
              New Customer
            </button>
          </div>
        </div>

        <div className="customer-table-scroll">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Last stay</th>
                <th>Stays</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="customer-name">
                      <span>
                        {customer.name
                          .charAt(0)
                          .toUpperCase()}
                      </span>

                      <div>
                        <strong>
                          {customer.name}
                        </strong>

                        <small>
                          #{customer.id}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <strong>
                      {customer.email ||
                        "No email"}
                    </strong>

                    <small>
                      {customer.phone ||
                        "No phone number"}
                    </small>
                  </td>

                  <td>
                    {customer.lastStay ||
                      "No stay yet"}
                  </td>

                  <td>
                    {customer.stays}
                  </td>

                  <td>
                    <button
                      className={`customer-status status-${customer.status.toLowerCase()}`}
                      onClick={() =>
                        toggleStatus(customer.id)
                      }
                    >
                      {customer.status}
                    </button>
                  </td>

                  <td>
                    <div className="customer-row-actions">
                      <button
                        onClick={() => {
                          setModal("view");
                          setEditingId(
                            customer.id
                          );
                        }}
                      >
                        View
                      </button>

                      <button
                        onClick={() =>
                          openEdit(customer)
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="danger"
                        onClick={() =>
                          deleteCustomer(
                            customer.id
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredCustomers.length && (
            <div className="customer-empty">
              {search
                ? "No customer records match your search."
                : "No customer records yet. Add a reservation or click New Customer to add one."}
            </div>
          )}
        </div>
      </section>

      {modal && (
        <div
          className="customer-modal-backdrop"
          onClick={() => setModal("")}
        >
          <section
            className="customer-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {modal === "form" ? (
              <form onSubmit={submitCustomer}>
                <div className="customer-modal-heading">
                  <div>
                    <span>
                      {editingId
                        ? "UPDATE RECORD"
                        : "NEW RECORD"}
                    </span>

                    <h2>
                      {editingId
                        ? "Edit customer"
                        : "New customer"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setModal("")
                    }
                  >
                    ×
                  </button>
                </div>

                <div className="customer-form-grid">
                  <label>
                    Full name

                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          name: event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Email address

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          email: event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Phone number

                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          phone: event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Total stays

                    <input
                      type="number"
                      min="0"
                      value={form.stays}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          stays:
                            event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Last stay

                    <input
                      placeholder="e.g. Sep 16, 2026"
                      value={form.lastStay}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          lastStay:
                            event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Status

                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status:
                            event.target.value
                        })
                      }
                    >
                      <option>Active</option>
                      <option>VIP</option>
                      <option>Inactive</option>
                    </select>
                  </label>
                </div>

                {error && (
                  <p className="customer-form-error">
                    {error}
                  </p>
                )}

                <div className="customer-modal-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setModal("")
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="customer-primary-button"
                    type="submit"
                  >
                    {editingId
                      ? "Update Customer"
                      : "Save Customer"}
                  </button>
                </div>
              </form>
            ) : (
              (() => {
                const customer =
                  customers.find(
                    (item) =>
                      item.id === editingId
                  );

                return (
                  customer && (
                    <>
                      <div className="customer-modal-heading">
                        <div>
                          <span>
                            CUSTOMER PROFILE
                          </span>

                          <h2>
                            {customer.name}
                          </h2>
                        </div>

                        <button
                          onClick={() =>
                            setModal("")
                          }
                        >
                          ×
                        </button>
                      </div>

                      <div className="customer-profile-grid">
                        <span>
                          Email
                          <strong>
                            {customer.email ||
                              "No email"}
                          </strong>
                        </span>

                        <span>
                          Phone
                          <strong>
                            {customer.phone ||
                              "No phone number"}
                          </strong>
                        </span>

                        <span>
                          Last stay
                          <strong>
                            {customer.lastStay ||
                              "No stay yet"}
                          </strong>
                        </span>

                        <span>
                          Total stays
                          <strong>
                            {customer.stays}
                          </strong>
                        </span>
                      </div>

                      <div className="customer-modal-actions">
                        <button
                          onClick={() =>
                            openEdit(customer)
                          }
                        >
                          Edit record
                        </button>

                        <button
                          className="customer-primary-button"
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