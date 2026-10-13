import { useState } from "react";
import CalendarControl from "./CalendarControl.jsx";
import "./RoomAmenitiesManagement.css";
import notificationIcon from "./assets/notification.png";
import standardIcon from "./assets/standard.png";
import twinIcon from "./assets/twin.png";
import deluxeQueenImage from "./assets/Deluxe.png";
import tripleIcon from "./assets/triple.png";
import quadrupleIcon from "./assets/quadruple.png";

const availableAmenities = [
  "Wi-Fi", "Air Conditioning", "TV", "Private Bathroom", "Mini Refrigerator",
  "Breakfast", "Hair Dryer", "Hot Shower", "Towels", "Coffee Maker",
  "Wardrobe", "Work Desk"
];

const initialPropertyAmenities = [
  { id: "pool", name: "Swimming Pool", description: "Take a refreshing pause in a calm and comfortable pool setting.", enabled: true },
  { id: "spa", name: "Wellness & Spa", description: "Make space for rest, relaxation, and a slower pace.", enabled: true },
  { id: "breakfast", name: "Breakfast & Dining", description: "Start your morning with comforting food and thoughtful service.", enabled: true },
  { id: "restaurant", name: "Restaurant", description: "Enjoy relaxed dining throughout your stay.", enabled: true },
  { id: "fitness", name: "Fitness Center", description: "Keep your routine going in a convenient fitness space.", enabled: true },
  { id: "meeting", name: "Meeting Facilities", description: "Flexible spaces for meetings, gatherings, and events.", enabled: true }
];

const initialRooms = [
  { id: "standard", name: "Standard Room", description: "A comfortable room suitable for short stays.", price: 2500, maxPax: 2, amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom"], icon: standardIcon },
  { id: "deluxe", name: "Deluxe Twin Room", description: "A spacious room with upgraded facilities and amenities.", price: 3500, maxPax: 2, amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom", "Mini Refrigerator"], icon: twinIcon },
  { id: "triple", name: "Superior Triple Room", description: "A larger room designed for families or small groups.", price: 4500, maxPax: 6, amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom", "Breakfast"], icon: tripleIcon },
  { id: "quadruple", name: "Superior Quadruple Room", description: "A spacious accommodation suitable for larger groups.", price: 5500, maxPax: 8, amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom", "Breakfast", "Mini Refrigerator"], icon: quadrupleIcon },
  { id: "queen", name: "Deluxe Queen Room", description: "A refined room with a comfortable queen bed and upgraded amenities.", price: 4000, maxPax: 3, amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom", "Hair Dryer"], icon: deluxeQueenImage }
];

function loadRooms() {
  const saved = localStorage.getItem("stayeaseRooms");
  if (!saved) return initialRooms;
  try {
    return JSON.parse(saved).map((room) => {
      const defaultRoom = initialRooms.find((item) => item.id === room.id);
      const previousDefaultMaxPax = {
        deluxe: 3,
        triple: 3,
        quadruple: 4,
        queen: 4
      }[room.id];

      return {
        ...room,
        maxPax:
          previousDefaultMaxPax !== undefined &&
          room.maxPax === previousDefaultMaxPax
            ? defaultRoom.maxPax
            : room.maxPax,
        icon: defaultRoom?.icon || standardIcon
      };
    });
  } catch {
    return initialRooms;
  }
}

export default function RoomAmenitiesManagement({ calendarDate, setCalendarDate, onOpenNotifications, unreadCount }) {
  const [rooms, setRooms] = useState(loadRooms);
  const [selectedRoomId, setSelectedRoomId] = useState("standard");
  const [newAmenity, setNewAmenity] = useState("");
  const [message, setMessage] = useState("");
  const [propertyAmenities, setPropertyAmenities] = useState(() => {
    const saved = localStorage.getItem("stayeasePropertyAmenities");
    if (!saved) return initialPropertyAmenities;
    try {
      return JSON.parse(saved).map((amenity) => ({
        ...amenity,
        enabled: amenity.enabled !== false
      }));
    } catch {
      return initialPropertyAmenities;
    }
  });

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || rooms[0];

  const handleRoomChange = (field, value) => {
    setRooms((current) => current.map((room) => room.id === selectedRoomId
      ? { ...room, [field]: field === "price" || field === "maxPax" ? Number(value) : value }
      : room
    ));
  };

  const handleAddRoom = () => {
    const id = `custom-${Date.now()}`;
    const newRoom = {
      id,
      name: "New Room",
      description: "Add a description for this room.",
      price: 0,
      maxPax: 1,
      amenities: [],
      icon: standardIcon
    };

    setRooms((current) => [...current, newRoom]);
    setSelectedRoomId(id);
    setMessage("New room added. Update its details and save your changes.");
  };

  const handleDeleteRoom = () => {
    if (rooms.length <= 1) {
      setMessage("At least one room profile must remain.");
      return;
    }

    if (!window.confirm(`Delete ${selectedRoom.name}?`)) return;

    const remainingRooms = rooms.filter((room) => room.id !== selectedRoomId);
    setRooms(remainingRooms);
    setSelectedRoomId(remainingRooms[0].id);
    setMessage("Room profile deleted. Save Changes to keep this update.");
  };

  const handleAmenityToggle = (amenity) => {
    setRooms((current) => current.map((room) => {
      if (room.id !== selectedRoomId) return room;
      const selected = room.amenities.includes(amenity);
      return { ...room, amenities: selected ? room.amenities.filter((item) => item !== amenity) : [...room.amenities, amenity] };
    }));
  };

  const handleAddAmenity = () => {
    const amenity = newAmenity.trim();
    if (!amenity || selectedRoom.amenities.includes(amenity)) return;
    setRooms((current) => current.map((room) => room.id === selectedRoomId ? { ...room, amenities: [...room.amenities, amenity] } : room));
    setNewAmenity("");
  };

  const handleRemoveAmenity = (amenity) => {
    setRooms((current) => current.map((room) => room.id === selectedRoomId ? { ...room, amenities: room.amenities.filter((item) => item !== amenity) } : room));
  };

  const handleSave = () => {
    localStorage.setItem("stayeaseRooms", JSON.stringify(rooms));
    localStorage.setItem("stayeasePropertyAmenities", JSON.stringify(propertyAmenities));
    setMessage("Room information and property amenities saved.");
    window.setTimeout(() => setMessage(""), 3000);
  };

  const handleReset = () => {
    setRooms(loadRooms());
    setPropertyAmenities(initialPropertyAmenities);
    setMessage("");
  };

  const handlePropertyAmenityChange = (id, value) => {
    setPropertyAmenities((current) => current.map((amenity) =>
      amenity.id === id ? { ...amenity, name: value } : amenity
    ));
  };

  const handlePropertyAmenityToggle = (id) => {
    setPropertyAmenities((current) => current.map((amenity) =>
      amenity.id === id ? { ...amenity, enabled: !amenity.enabled } : amenity
    ));
  };

  const handleAddPropertyAmenity = () => {
    const id = `property-${Date.now()}`;
    setPropertyAmenities((current) => [
      ...current,
      { id, name: "New Hotel Amenity", enabled: true }
    ]);
    setMessage("New hotel amenity added. Rename it and save your changes.");
  };

  const handleDeletePropertyAmenity = (id) => {
    if (!window.confirm("Delete this hotel amenity?")) return;
    setPropertyAmenities((current) => current.filter((amenity) => amenity.id !== id));
    setMessage("Hotel amenity deleted. Save Changes to keep this update.");
  };

  if (!selectedRoom) return null;

  return (
    <main className="admin-main room-amenities-page">
      <header className="admin-topbar">
        <div className="admin-welcome">
          <span className="admin-page-label">STAYEASE ADMINISTRATION / AMENITIES</span>
          <h1>Room &amp; Amenities Management</h1>
          <p>Update room information, prices, and amenities.</p>
        </div>
        <div className="admin-topbar-right">
          <button className="admin-notification-box" onClick={onOpenNotifications}>
            <img className="notification-icon-box" src={notificationIcon} alt="Notifications" />
            <div><strong>{unreadCount} Notifications</strong><span>{unreadCount} unread notifications</span></div>
          </button>
          <CalendarControl value={calendarDate} onChange={setCalendarDate} />
        </div>
      </header>

      {message && <div className="room-amenities-success" role="alert">{message}</div>}

      <section className="room-amenities-layout">
        <aside className="room-amenities-list">
          <div className="room-amenities-list-heading">
            <div><span>ROOM CATALOG</span><h2>Rooms</h2></div>
            <button type="button" className="room-amenities-add-button" onClick={handleAddRoom}>Add Room</button>
          </div>
          <div className="room-selection-list">
            {rooms.map((room) => <button key={room.id} type="button" className={`room-selection-item ${room.id === selectedRoomId ? "active" : ""}`} onClick={() => setSelectedRoomId(room.id)}><img src={room.icon} alt="" /><span>{room.name}</span><small>₱{Number(room.price).toLocaleString()}</small></button>)}
          </div>
        </aside>

        <section className="room-amenities-editor">
          <div className="room-editor-heading"><div><span>EDITING ROOM PROFILE</span><h2>{selectedRoom.name}</h2><p>Update the details that appear across your room catalog.</p></div><div className="room-editor-heading-actions"><img src={selectedRoom.icon} alt="" /><button type="button" className="room-amenities-delete-button" onClick={handleDeleteRoom}>Delete Room</button></div></div>
          <div className="room-amenities-form-grid">
            <label>Room Name<input value={selectedRoom.name} onChange={(event) => handleRoomChange("name", event.target.value)} /></label>
            <label>Room Price<input type="number" min="0" value={selectedRoom.price} onChange={(event) => handleRoomChange("price", event.target.value)} /></label>
            <label>Maximum Guests<input type="number" min="1" value={selectedRoom.maxPax} onChange={(event) => handleRoomChange("maxPax", event.target.value)} /></label>
          </div>
          <label className="room-amenities-description">Room Description<textarea rows="4" value={selectedRoom.description} onChange={(event) => handleRoomChange("description", event.target.value)} /></label>

          <section className="amenities-management-panel"><div className="amenities-panel-heading"><div><span>GUEST EXPERIENCE</span><h3>Room Amenities</h3><p>Select the amenities included in this room.</p></div><strong>{selectedRoom.amenities.length} selected</strong></div><div className="amenities-grid">{availableAmenities.map((amenity) => <label key={amenity} className={`amenity-checkbox ${selectedRoom.amenities.includes(amenity) ? "selected" : ""}`}><input type="checkbox" checked={selectedRoom.amenities.includes(amenity)} onChange={() => handleAmenityToggle(amenity)} /><span>{amenity}</span></label>)}</div><div className="custom-amenity-input"><input value={newAmenity} placeholder="Add a custom amenity" onChange={(event) => setNewAmenity(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleAddAmenity(); } }} /><button type="button" onClick={handleAddAmenity}>Add Amenity</button></div><div className="selected-amenities"><span>SELECTED AMENITIES</span><div className="selected-amenities-list">{selectedRoom.amenities.map((amenity) => <div className="selected-amenity" key={amenity}><span>{amenity}</span><button type="button" onClick={() => handleRemoveAmenity(amenity)} aria-label={`Remove ${amenity}`}>×</button></div>)}</div></div></section>

          <div className="room-amenities-actions"><button type="button" onClick={handleReset}>Reset</button><button type="button" className="room-amenities-save" onClick={handleSave}>Save Changes</button></div>
        </section>
      </section>

      <section className="property-amenities-section">
        <div className="property-amenities-heading">
          <div><span>PROPERTY EXPERIENCE</span><h2>Hotel Amenities</h2><p>Choose which signature amenities are currently available to guests.</p></div>
          <div className="property-amenities-heading-actions"><strong>{propertyAmenities.length} amenities</strong><button type="button" className="room-amenities-add-button" onClick={handleAddPropertyAmenity}>Add Amenity</button></div>
        </div>
        <div className="property-amenities-grid">
          {propertyAmenities.map((amenity, index) => (
            <article className={`property-amenity-card ${amenity.enabled ? "enabled" : "disabled"}`} key={amenity.id}>
              <button type="button" className="property-amenity-check" onClick={() => handlePropertyAmenityToggle(amenity.id)} aria-pressed={amenity.enabled}>
                {amenity.enabled ? "✓" : ""}
              </button>
              <span className="property-amenity-number">0{index + 1}</span>
              <div className="property-amenity-content">
                <label>AMENITY NAME<input value={amenity.name} onChange={(event) => handlePropertyAmenityChange(amenity.id, event.target.value)} /></label>
              </div>
              <button type="button" className="property-amenity-delete" onClick={() => handleDeletePropertyAmenity(amenity.id)} aria-label={`Delete ${amenity.name}`}>×</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
