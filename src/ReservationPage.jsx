import { useEffect, useMemo, useState } from "react";
import "./ReservationPage.css";
import ReservationDatePicker from "./ReservationDatePicker";

import Standard from "./assets/Standard.png";
import Twin from "./assets/Twin.png";
import Deluxe from "./assets/Deluxe.png";
import Triple from "./assets/Triple.png";
import Quadruple from "./assets/Quadruple.png";

import SiteChrome from "./SiteChrome";

const rooms = [
  {
    id: "standard",
    databaseId: "1",
    totalRooms: 5,
    name: "Standard Room",
    minPax: 1,
    maxPax: 2,
    pricingDay: 1999,
    pricingOvernight: 2999,
    image: Standard,
    includedAmenities: ["fitness-center"],
    highlights: ["Cozy and practical space", "Air conditioning", "Free Wi-Fi", "Private bathroom", "Blackout curtains"],
  },
  {
    id: "twin",
    databaseId: "2",
    totalRooms: 4,
    name: "Deluxe Twin Room",
    minPax: 1,
    maxPax: 2,
    pricingDay: 2499,
    pricingOvernight: 3499,
    image: Twin,
    includedAmenities: ["fitness-center", "swimming-pool"],
    highlights: ["Twin beds", "Mini refrigerator", "Work desk", "Large closet", "Comfortable shared space"],
  },
  {
    id: "deluxe",
    databaseId: "3",
    totalRooms: 3,
    name: "Deluxe Queen",
    minPax: 1,
    maxPax: 3,
    pricingDay: 2999,
    pricingOvernight: 3999,
    image: Deluxe,
    includedAmenities: ["fitness-center", "swimming-pool", "complimentary-breakfast"],
    highlights: ["Queen bed", "Premium toiletries", "Hairdryer", "TV with cable", "Mini refrigerator", "Work desk"],
  },
  {
    id: "triple",
    databaseId: "4",
    totalRooms: 3,
    name: "Superior Triple",
    minPax: 3,
    maxPax: 6,
    pricingDay: 3499,
    pricingOvernight: 4499,
    image: Triple,
    includedAmenities: ["fitness-center", "swimming-pool", "complimentary-breakfast", "meeting-facilities", "balcony"],
    highlights: ["Spacious seating area", "Private balcony", "Smart TV", "Premium linens", "Mini refrigerator", "Work desk"],
  },
  {
    id: "quadruple",
    databaseId: "5",
    totalRooms: 2,
    name: "Superior Quadruple Room",
    minPax: 4,
    maxPax: 8,
    pricingDay: 3999,
    pricingOvernight: 5499,
    image: Quadruple,
    includedAmenities: ["fitness-center", "swimming-pool", "complimentary-breakfast", "meeting-facilities", "balcony", "luxury-spa", "fine-dining"],
    highlights: ["Spacious seating area", "Private balcony", "Dining table", "Smart TV", "Premium linens", "Iron & ironing board", "Mini refrigerator"],
  },
];

const amenityOptions = [
  {
    name: "Gym",
    displayName: "Fitness Center",
    packageKey: "fitness-center",
    price: 300,
    description: "Access to the hotel fitness facilities.",
  },
  {
    name: "Spa",
    displayName: "Luxury Spa",
    packageKey: "luxury-spa",
    price: 500,
    description: "Spa access during your stay.",
  },
  {
    name: "Restaurant",
    displayName: "Fine Dining Restaurant",
    packageKey: "fine-dining",
    price: 500,
    description: "Restaurant service during your stay.",
  },
  {
    name: "Meeting Facilities",
    displayName: "Meeting Facilities",
    packageKey: "meeting-facilities",
    price: 500,
    description: "Private meeting and event facilities.",
  },
];

const packageOnlyAmenities = [
  {
    key: "swimming-pool",
    name: "Swimming Pool",
    description: "Pool access during your stay.",
  },
  {
    key: "complimentary-breakfast",
    name: "Complimentary Breakfast",
    description: "Breakfast included with this room package.",
  },
  {
    key: "balcony",
    name: "Balcony in Room",
    description: "Private balcony included with this room package.",
  },
];

const addDays = (dateValue, days) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const availableRoomCount = (room, inventory, checkIn, stayEnd) => {
  const roomInventory = inventory.find(
    (entry) => Number(entry.room_id) === Number(room.databaseId)
  );
  if (!roomInventory) return 0;

  let maximumBooked = 0;
  for (let date = checkIn; date < stayEnd; date = addDays(date, 1)) {
    const booked = roomInventory.reservations.reduce(
      (total, reservation) =>
        reservation.check_in <= date && reservation.check_out > date
          ? total + Number(reservation.rooms_count)
          : total,
      0
    );
    maximumBooked = Math.max(maximumBooked, booked);
  }

  return Math.max(0, Number(roomInventory.total_rooms) - maximumBooked);
};

export default function ReservationPage({
  initialData,
  onBack,
  onHome,
  onAmenities,
  onAbout,
  onContact,
  onProfile,
  onLogout,
  onBookingComplete,
  onRooms,
  onCreateReservation,
  userProfile,
}) {
  const [step, setStep] = useState(1);
  const [matches, setMatches] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(
    initialData?.roomId || ""
  );

  const [form, setForm] = useState({
    stayType: "overnight",
    checkIn: "",
    checkOut: "",
    adults: 1,
    children: 0,
    rooms: 1,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    amenities: [],
    confirmed: false,
  });

  const [bookingReference, setBookingReference] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [savingBooking, setSavingBooking] = useState(false);
  const [roomInventory, setRoomInventory] = useState([]);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  useEffect(() => {
    const nameParts = userProfile?.name?.trim().split(/\s+/) || [];
    const firstName = nameParts.shift() || "";
    const lastName = nameParts.join(" ");

    setForm((current) => ({
      ...current,
      firstName: current.firstName || firstName,
      lastName: current.lastName || lastName,
      email: current.email || userProfile?.email || "",
    }));
  }, [userProfile]);

  const totalGuests = Number(form.adults) + Number(form.children);
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const fetchRoomInventory = async () => {
    const response = await fetch(
      `${window.location.protocol}//${window.location.hostname}/stayease-api/stayease.php?action=availability`,
      { credentials: "include" }
    );
    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message ||
          `Could not load room availability (${response.status}).`
      );
    }
    if (!Array.isArray(result.data?.rooms)) {
      throw new Error("The room availability response is invalid.");
    }

    return result.data.rooms;
  };

  useEffect(() => {
    let active = true;
    const loadAvailability = async () => {
      try {
        const inventory = await fetchRoomInventory();
        if (active) {
          setRoomInventory(inventory);
          setAvailabilityError("");
        }
      } catch (error) {
        if (active) setAvailabilityError(error.message);
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    };

    loadAvailability();
    const interval = window.setInterval(loadAvailability, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const chosenRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoom),
    [selectedRoom]
  );

  const includedAmenities = chosenRoom?.includedAmenities || [];

  useEffect(() => {
    setForm((current) => {
      const amenities = current.amenities.filter((name) => {
        const option = amenityOptions.find((amenity) => amenity.name === name);
        return option && !includedAmenities.includes(option.packageKey);
      });

      if (amenities.length === current.amenities.length) {
        return current;
      }

      return { ...current, amenities };
    });
  }, [selectedRoom]);

  const selectedAmenities = useMemo(
    () =>
      amenityOptions.filter((amenity) =>
        form.amenities.includes(amenity.name) &&
        !includedAmenities.includes(amenity.packageKey)
      ),
    [form.amenities, includedAmenities]
  );

  const roomPrice = chosenRoom
    ? form.stayType === "day"
      ? chosenRoom.pricingDay
      : chosenRoom.pricingOvernight
    : 0;

  const roomSubtotal = roomPrice * Number(form.rooms);

  const amenitySubtotal = selectedAmenities.reduce(
    (total, amenity) => total + amenity.price,
    0
  );

  const grandTotal = roomSubtotal + amenitySubtotal;

  const guestDetailsComplete =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.phone.trim();

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const searchRooms = async (e) => {
    e.preventDefault();

    if (availabilityLoading || availabilityError) {
      alert(
        availabilityError ||
          "Please wait while we check confirmed reservation dates."
      );
      return;
    }

    if (!form.checkIn) {
      alert("Please select your check-in date.");
      return;
    }

    if (form.stayType === "overnight" && !form.checkOut) {
      alert("Please select your check-out date.");
      return;
    }

    if (
      form.stayType === "overnight" &&
      form.checkOut &&
      form.checkIn &&
      form.checkOut <= form.checkIn
    ) {
      alert("Your check-out date must be after your check-in date.");
      return;
    }

    const stayEnd =
      form.stayType === "day"
        ? addDays(form.checkIn, 1)
        : form.checkOut;

    if (totalGuests < 1) {
      alert("At least one guest is required.");
      return;
    }

    let latestInventory;
    try {
      latestInventory = await fetchRoomInventory();
      setRoomInventory(latestInventory);
      setAvailabilityError("");
    } catch (error) {
      setAvailabilityError(error.message);
      alert(error.message);
      return;
    }

    const perRoomGuests = Math.ceil(
      totalGuests / Number(form.rooms)
    );

    const available = rooms.filter(
      (room) =>
        room.maxPax >= perRoomGuests &&
        room.minPax <= perRoomGuests
    ).map((room) => ({
      ...room,
      availableRooms: availableRoomCount(
        room,
        latestInventory,
        form.checkIn,
        stayEnd
      ),
    })).filter((room) => room.availableRooms >= Number(form.rooms));

    setMatches(available);
    setSelectedRoom("");

    if (initialData?.roomId) {
      const initialMatch = available.find(
        (room) => room.id === initialData.roomId
      );

      if (initialMatch) {
        setSelectedRoom(initialMatch.id);
      }
    }

    setStep(2);
  };

  const toggleAmenity = (amenity) => {
    const option = amenityOptions.find((item) => item.name === amenity);
    if (!option || includedAmenities.includes(option.packageKey)) {
      return;
    }

    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const goToGuestDetails = () => {
    if (!selectedRoom) {
      alert("Please select a room.");
      return;
    }

    setStep(3);
  };

  const goToReview = () => {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      alert(
        "Please complete all guest details before reviewing your reservation."
      );
      return;
    }

    setStep(4);
  };

  const confirmBooking = async () => {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      alert("Please complete your guest details.");
      setStep(3);
      return;
    }

    if (!form.confirmed) {
      alert("Please confirm the reservation details.");
      return;
    }

    if (!chosenRoom) {
      alert("Please select a room.");
      setStep(2);
      return;
    }

    setSavingBooking(true);
    setBookingError("");

    try {
      const result = await onCreateReservation({
        room_id: chosenRoom.databaseId,
        stay_type: form.stayType,
        check_in: form.checkIn,
        check_out:
          form.stayType === "day" ? form.checkIn : form.checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        rooms_count: Number(form.rooms),
        guest_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        phone: form.phone.trim(),
        amenities: selectedAmenities.map((amenity) => amenity.name),
      });
      if (!result.checkout_url) {
        throw new Error("PayRex did not return a checkout link. Please try again.");
      }
      const reference = result.reservation_id;
      const reservation = {
        id: reference,
        reference,
        status: result.status || "Pending",
        roomId: chosenRoom.id,
        roomName: chosenRoom.name,
        stayType: form.stayType,
        checkIn: form.checkIn,
        checkOut:
          form.stayType === "day" ? form.checkIn : form.checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        rooms: Number(form.rooms),
        guestName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        phone: form.phone.trim(),
        amenities: selectedAmenities.map((amenity) => amenity.name),
        roomSubtotal,
        amenitySubtotal,
        total: grandTotal,
        createdAt: new Date().toLocaleString(),
      };

      const savedReservations = JSON.parse(
        localStorage.getItem("stayeaseReservations") || "[]"
      );

      localStorage.setItem(
        "stayeaseReservations",
        JSON.stringify([reservation, ...savedReservations])
      );

      window.dispatchEvent(new Event("stayeaseReservationsUpdated"));
      setBookingReference(reference);
      setStep(5);
      window.location.assign(result.checkout_url);
    } catch (error) {
      setBookingError(error.message);
    } finally {
      setSavingBooking(false);
    }
  };

  return (
    <main className="reservation-page">

      {step === 1 && (
        <section className="reservation-step">
          <div className="reservation-step-heading">
            <span>STEP 01</span>
            <h2>Find your room.</h2>
            <p>
              Tell us a little about your stay and we'll find rooms that fit
              your group.
            </p>
          </div>

          <form className="reservation-form-card" onSubmit={searchRooms}>
            <div className="stay-toggle">
              <button
                type="button"
                className={
                  form.stayType === "overnight" ? "active" : ""
                }
                onClick={() => update("stayType", "overnight")}
              >
                OVERNIGHT
              </button>

              <button
                type="button"
                className={form.stayType === "day" ? "active" : ""}
                onClick={() => {
                  update("stayType", "day");
                  update("checkOut", "");
                }}
              >
                DAY STAY
              </button>
            </div>

            <div className="reservation-fields">
              <ReservationDatePicker
                label="CHECK-IN"
                value={form.checkIn}
                minDate={todayValue}
                disabledRanges={[]}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    checkIn: value,
                    checkOut:
                      current.checkOut > value ? current.checkOut : "",
                  }))
                }
              />

              <ReservationDatePicker
                label="CHECK-OUT"
                value={form.stayType === "day" ? form.checkIn : form.checkOut}
                minDate={todayValue}
                disabledRanges={[]}
                isCheckout
                checkInDate={form.checkIn}
                disabled={form.stayType === "day"}
                onChange={(value) => update("checkOut", value)}
              />

              <label>
                ADULTS
                <input
                  type="number"
                  min="1"
                  value={form.adults}
                  onChange={(e) =>
                    update(
                      "adults",
                      Math.max(1, Number(e.target.value))
                    )
                  }
                />
              </label>

              <label>
                CHILDREN
                <input
                  type="number"
                  min="0"
                  value={form.children}
                  onChange={(e) =>
                    update(
                      "children",
                      Math.max(0, Number(e.target.value))
                    )
                  }
                />
              </label>

              <label>
                ROOMS
                <input
                  type="number"
                  min="1"
                  max={Math.max(...rooms.map((room) => room.totalRooms))}
                  step="1"
                  value={form.rooms}
                  onChange={(e) => {
                    const maximum = Math.max(
                      ...rooms.map((room) => room.totalRooms)
                    );
                    const requested = Number.parseInt(e.target.value, 10);
                    update(
                      "rooms",
                      Math.min(
                        maximum,
                        Math.max(1, Number.isFinite(requested) ? requested : 1)
                      )
                    );
                  }}
                />
              </label>
            </div>
            {availabilityLoading && (
              <p className="availability-message">
                Checking room inventory…
              </p>
            )}
            {availabilityError && (
              <p className="availability-message error" role="alert">
                Could not load room availability: {availabilityError}
              </p>
            )}
            <p className="availability-message">
              Select up to 5 rooms; the available quantity depends on room type
              and your dates.
            </p>

            <button className="primary-button reservation-next">
              FIND AVAILABLE ROOMS
            </button>
          </form>
        </section>
      )}

      {step === 2 && (
        <section className="reservation-step">
          <div className="reservation-step-heading">
            <span>STEP 02</span>
            <h2>Choose your room.</h2>
            <p>
              Based on {totalGuests} guest{totalGuests !== 1 ? "s" : ""} and{" "}
              {form.rooms} room{form.rooms !== 1 ? "s" : ""}, these options fit
              your stay.
            </p>
          </div>

          <div className="match-grid">
            {matches.map((room) => {
              const price =
                form.stayType === "day"
                  ? room.pricingDay
                  : room.pricingOvernight;

              return (
                <button
                  key={room.id}
                  type="button"
                  className={`match-card ${
                    selectedRoom === room.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedRoom(room.id)}
                >
                  <img
                    className={
                      room.id === "triple" || room.id === "quadruple"
                        ? "room-image-fit"
                        : ""
                    }
                    src={room.image}
                    alt={room.name}
                  />

                  <div>
                    <span>
                      {room.minPax}–{room.maxPax} GUESTS
                    </span>

                    <h3>{room.name}</h3>

                    <strong>
                      ₱{price.toLocaleString()}
                    </strong>

                    <small className="room-price-label">
                      {form.stayType === "day"
                        ? "PER DAY"
                        : "PER NIGHT"}
                    </small>
                    <small className="room-price-label">
                      {room.availableRooms} available for these dates
                    </small>
                  </div>

                  {selectedRoom === room.id && (
                    <i className="selected-check">✓</i>
                  )}
                </button>
              );
            })}
          </div>

          {matches.length === 0 && (
            <div className="no-match">
              No room type has {form.rooms} room
              {form.rooms !== 1 ? "s" : ""} available for those dates and guest
              count.
            </div>
          )}

          <div className="step-actions">
            <button
              className="secondary-button"
              onClick={() => setStep(1)}
            >
              ← CHANGE SEARCH
            </button>

            <button
              className="primary-button"
              disabled={!selectedRoom}
              onClick={goToGuestDetails}
            >
              CONTINUE
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="reservation-step">
          <div className="reservation-step-heading">
            <span>STEP 03</span>
            <h2>Tell us about you.</h2>
            <p>
              We'll use these details to prepare your reservation. All guest
              details are required before you can review your reservation.
            </p>
          </div>

          <div className="reservation-form-card">
            <div className="reservation-fields two">
              <label>
                FIRST NAME
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    update("firstName", e.target.value)
                  }
                  placeholder="First name"
                  required
                />
              </label>

              <label>
                LAST NAME
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    update("lastName", e.target.value)
                  }
                  placeholder="Last name"
                  required
                />
              </label>

              <label>
                EMAIL ADDRESS
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    update("email", e.target.value)
                  }
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                PHONE NUMBER
                <input
                  value={form.phone}
                  onChange={(e) =>
                    update("phone", e.target.value)
                  }
                  placeholder="+63"
                  required
                />
              </label>
            </div>

            <div className="amenity-selection">
              <span>OPTIONAL AMENITIES</span>

              <p className="amenity-helper">
                Select any amenities you'd like to add. Prices are shown below.
              </p>

              <p className="amenity-package-notice">
                Some amenities are already included in your selected room type
                and are therefore unavailable for separate reservation.
              </p>

              {chosenRoom?.id === "quadruple" && (
                <p className="amenity-premium-notice">
                  All premium amenities are already included in the Superior
                  Quadruple Room package. No additional amenity reservation is
                  required.
                </p>
              )}

              <div className="amenity-options">
                {[
                  ...amenityOptions,
                  ...packageOnlyAmenities
                    .filter((amenity) =>
                      includedAmenities.includes(amenity.key)
                    )
                    .map((amenity) => ({
                      name: amenity.key,
                      displayName: amenity.name,
                      packageKey: amenity.key,
                      description: amenity.description,
                    })),
                ].map((amenity) => {
                  const included = includedAmenities.includes(
                    amenity.packageKey
                  );
                  const selected = form.amenities.includes(
                    amenity.name
                  ) && !included;

                  return (
                    <button
                      key={amenity.name}
                      type="button"
                      className={`amenity-option ${
                        selected ? "selected" : ""
                      } ${included ? "included" : ""}`}
                      disabled={included}
                      title={
                        included
                          ? "This amenity is already included in your selected room."
                          : undefined
                      }
                      aria-label={
                        included
                          ? `${amenity.displayName || amenity.name}, included in room package`
                          : amenity.displayName || amenity.name
                      }
                      onClick={() =>
                        toggleAmenity(amenity.name)
                      }
                    >
                      <span className="amenity-option-main">
                        <span className="amenity-option-name">
                          {selected ? "✓ " : ""}
                          {amenity.displayName || amenity.name}
                        </span>

                        {included ? (
                          <strong className="amenity-included-badge">
                            Included
                          </strong>
                        ) : (
                          <strong>
                            ₱{amenity.price.toLocaleString()}
                          </strong>
                        )}
                      </span>

                      <small>
                        {included
                          ? "This amenity is already included in your selected room."
                          : amenity.description}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="step-actions">
            <button
              className="secondary-button"
              onClick={() => setStep(2)}
            >
              ← BACK
            </button>

            <button
              className="primary-button"
              onClick={goToReview}
              disabled={!guestDetailsComplete}
            >
              REVIEW RESERVATION
            </button>
          </div>

          {!guestDetailsComplete && (
            <p className="required-note">
              Please complete your first name, last name, email address, and
              phone number to continue.
            </p>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="reservation-step">
          <div className="reservation-step-heading">
            <span>STEP 04</span>
            <h2>Review & pay.</h2>
            <p>
              Review your reservation, amenities, and total before confirming
              and continuing to PayRex Checkout.
            </p>
          </div>

          <div className="review-layout">
            <div className="review-card">
              <div className="review-room">
                <img
                  className={
                    chosenRoom?.id === "triple" ||
                    chosenRoom?.id === "quadruple"
                      ? "room-image-fit"
                      : ""
                  }
                  src={chosenRoom?.image}
                  alt={chosenRoom?.name}
                />

                <div>
                  <span>SELECTED ROOM</span>
                  <h3>{chosenRoom?.name}</h3>
                </div>
              </div>

              <div className="review-room-highlights">
                <span>INCLUDED IN YOUR ROOM</span>
                <ul>
                  {chosenRoom?.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>

              <div className="review-details">
                <div>
                  <span>STAY TYPE</span>
                  <strong>
                    {form.stayType === "day"
                      ? "DAY STAY"
                      : "OVERNIGHT"}
                  </strong>
                </div>

                <div>
                  <span>DATES</span>
                  <strong>
                    {form.checkIn}
                    {" → "}
                    {form.stayType === "day"
                      ? form.checkIn
                      : form.checkOut}
                  </strong>
                </div>

                <div>
                  <span>GUESTS</span>
                  <strong>
                    {totalGuests} GUEST
                    {totalGuests !== 1 ? "S" : ""}
                  </strong>
                </div>

                <div>
                  <span>ROOMS</span>
                  <strong>{form.rooms}</strong>
                </div>
              </div>

              <div className="review-guest">
                <span>GUEST</span>
                <strong>
                  {form.firstName} {form.lastName}
                </strong>
                <small>{form.email}</small>
                <small>{form.phone}</small>
              </div>

              <div className="review-amenities">
                <span>ADDED AMENITIES</span>

                {selectedAmenities.length > 0 ? (
                  selectedAmenities.map((amenity) => (
                    <div
                      className="review-amenity-row"
                      key={amenity.name}
                    >
                      <span>{amenity.displayName}</span>
                      <strong>
                        ₱{amenity.price.toLocaleString()}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p>No additional amenities selected.</p>
                )}
              </div>
            </div>

            <aside className="payment-card">
              <span>RESERVATION BREAKDOWN</span>

              <h3>Your total.</h3>

              <div className="price-breakdown">
                <div className="price-row">
                  <span>
                    {chosenRoom?.name} × {form.rooms}
                  </span>

                  <strong>
                    ₱{roomSubtotal.toLocaleString()}
                  </strong>
                </div>

                <div className="breakdown-subtext">
                  {form.stayType === "day"
                    ? "Day stay"
                    : "Overnight stay"}
                </div>

                <div className="breakdown-divider" />

                {selectedAmenities.length > 0 && (
                  <>
                    <div className="breakdown-section-title">
                      AMENITIES
                    </div>

                    {selectedAmenities.map((amenity) => (
                      <div
                        className="price-row"
                        key={amenity.name}
                      >
                        <span>{amenity.displayName}</span>
                        <strong>
                          ₱{amenity.price.toLocaleString()}
                        </strong>
                      </div>
                    ))}

                    <div className="breakdown-divider" />
                  </>
                )}

                <div className="price-row total">
                  <span>TOTAL TO PAY</span>
                  <strong>
                    ₱{grandTotal.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="payment-section">
                <span>PAYREX CHECKOUT</span>
                <h4>Choose a payment method.</h4>

                <div className="payrex-checkout-note">
                  <strong>PayRex Checkout</strong>
                  <small>Available methods are managed by your PayRex account.</small>
                </div>

                <p>
                  You will be redirected to PayRex to complete this sandbox
                  payment. Test mode does not move real money.
                </p>
              </div>

              <label className="confirmation-check">
                <input
                  type="checkbox"
                  checked={form.confirmed}
                  onChange={(e) =>
                    update("confirmed", e.target.checked)
                  }
                />

                <span>
                  I confirm that my reservation request details, guest
                  information, selected amenities, and payment total are correct.
                </span>
              </label>

              <button
                className="primary-button"
                onClick={confirmBooking}
                disabled={!form.confirmed || savingBooking}
              >
                {savingBooking ? "OPENING PAYREX CHECKOUT..." : "CONTINUE TO PAYREX CHECKOUT"}
              </button>
              {bookingError && (
                <p className="auth-message" role="alert">
                  {bookingError}
                </p>
              )}
            </aside>
          </div>

          <div className="step-actions">
            <button
              className="secondary-button"
              onClick={() => setStep(3)}
            >
              ← BACK
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="reservation-success">
          <div className="success-card">
            <span>REQUEST RECEIVED · PENDING APPROVAL</span>

            <div className="success-mark">✓</div>

            <h2>Your stay is waiting.</h2>

            <p>
              Your reservation request has been submitted and is awaiting admin
              approval. It is not confirmed yet; the admin must approve it first.
            </p>

            <div className="booking-reference">
              <small>BOOKING REFERENCE</small>
              <strong>{bookingReference}</strong>
            </div>

            <div className="reference-note">
              <strong>Keep this reservation reference safe.</strong>
              <p>
                Save this reference so the admin can look up your reservation
                request.
              </p>
            </div>

            <div className="success-receipt-details">
              <div>
                <span>ROOM</span>
                <strong>{chosenRoom?.name}</strong>
              </div>
              <div>
                <span>DATES</span>
                <strong>
                  {form.checkIn} – {form.stayType === "day" ? form.checkIn : form.checkOut}
                </strong>
              </div>
              <div>
                <span>GUESTS</span>
                <strong>{totalGuests}</strong>
              </div>
              <div>
                <span>TOTAL</span>
                <strong>₱{grandTotal.toLocaleString()}</strong>
              </div>
              <div className="success-included">
                <span>INCLUDED IN YOUR ROOM</span>
                <ul>
                  {chosenRoom?.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              className="primary-button"
              onClick={onBookingComplete || onHome}
            >
              RETURN TO STAYEASE
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
