import { useEffect, useRef, useState } from "react";
import "./CalendarControl.css";

function parseDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarControl({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDate(value));
  const calendarRef = useRef(null);
  const selectedDate = parseDate(value);

  useEffect(() => {
    const closeCalendar = (event) => {
      if (!calendarRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeCalendar);
    return () => document.removeEventListener("mousedown", closeCalendar);
  }, []);

  const monthStart = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  );
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate();
  const days = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return null;
    return index - firstDay + 1;
  });

  const selectDay = (day) => {
    const nextDate = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    );
    onChange(toInputDate(nextDate));
    setIsOpen(false);
  };

  const moveMonth = (amount) => {
    setVisibleMonth(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1)
    );
  };

  return (
    <div className="calendar-control" ref={calendarRef}>
      <button
        type="button"
        className="calendar-control-trigger"
        onClick={() => {
          setVisibleMonth(selectedDate);
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-label="Choose date"
      >
        <span>{selectedDate.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}</span>
        <small>{selectedDate.getFullYear()}</small>
      </button>

      {isOpen && (
        <div className="calendar-popover">
          <div className="calendar-popover-header">
            <strong>
              {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </strong>
            <div>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
              <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="calendar-days">
            {days.map((day, index) => {
              const isSelected = day === selectedDate.getDate() && visibleMonth.getMonth() === selectedDate.getMonth() && visibleMonth.getFullYear() === selectedDate.getFullYear();
              return day ? (
                <button key={day} type="button" className={isSelected ? "selected" : ""} onClick={() => selectDay(day)}>{day}</button>
              ) : <span key={`empty-${index}`}></span>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
