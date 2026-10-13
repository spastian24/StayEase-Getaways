import { useState } from "react";

const formatInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function ReservationDatePicker({
  label,
  value,
  onChange,
  disabledRanges,
  minDate,
  isCheckout = false,
  checkInDate = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => parseInputDate(value) || parseInputDate(minDate) || new Date()
  );
  const selectedDate = parseInputDate(value);
  const monthStart = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  );
  const days = Array.from(
    {
      length:
        monthStart.getDay() +
        new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth() + 1,
          0
        ).getDate(),
    },
    (_, index) => (index < monthStart.getDay() ? null : index - monthStart.getDay() + 1)
  );

  const isDisabled = (day) => {
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    );
    const dateValue = formatInputDate(date);

    if (dateValue < minDate) return true;

    if (isCheckout) {
      if (!checkInDate || dateValue <= checkInDate) return true;
      return disabledRanges.some(
        (range) => range.start < dateValue && range.end > checkInDate
      );
    }

    return disabledRanges.some(
      (range) => range.start <= dateValue && range.end > dateValue
    );
  };

  const selectDay = (day) => {
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    );
    onChange(formatInputDate(date));
    setOpen(false);
  };

  const moveMonth = (amount) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
    const minimum = parseInputDate(minDate);

    if (
      !isCheckout &&
      minimum &&
      nextMonth < new Date(minimum.getFullYear(), minimum.getMonth(), 1)
    ) {
      return;
    }

    setVisibleMonth(nextMonth);
  };

  return (
    <div className="reservation-date-picker">
      <span>{label}</span>
      <button
        type="button"
        className={`reservation-date-trigger ${disabled ? "disabled" : ""}`}
        disabled={disabled}
        onClick={() => {
          setVisibleMonth(selectedDate || parseInputDate(minDate) || new Date());
          setOpen((current) => !current);
        }}
        aria-expanded={open}
      >
        {selectedDate
          ? selectedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })
          : "Select date"}
      </button>
      {open && !disabled && (
        <div className="reservation-calendar-popover">
          <div className="reservation-calendar-header">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <strong>
              {visibleMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="reservation-calendar-grid weekdays">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="reservation-calendar-grid">
            {days.map((day, index) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled(day)}
                  className={
                    selectedDate &&
                    selectedDate.getFullYear() === visibleMonth.getFullYear() &&
                    selectedDate.getMonth() === visibleMonth.getMonth() &&
                    selectedDate.getDate() === day
                      ? "selected"
                      : ""
                  }
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              )
            )}
          </div>
          <small>Available room counts are checked after you search.</small>
        </div>
      )}
    </div>
  );
}
