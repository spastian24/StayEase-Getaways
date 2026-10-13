import { useEffect, useState } from "react";
import "./RoomAmenities.css";
import love from "./assets/love.png";

export default function RoomCard({ room, onViewDetails }) {
  const [currentImage, setCurrentImage] = useState(0);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(
      localStorage.getItem("stayeaseFavorites") || "[]"
    );
    setFavorite(saved.includes(room.id));
  }, [room.id]);

  const toggleFavorite = (e) => {
    e.stopPropagation();

    const saved = JSON.parse(
      localStorage.getItem("stayeaseFavorites") || "[]"
    );

    const updated = saved.includes(room.id)
      ? saved.filter((id) => id !== room.id)
      : [...saved, room.id];

    localStorage.setItem("stayeaseFavorites", JSON.stringify(updated));
    setFavorite(updated.includes(room.id));
    window.dispatchEvent(new Event("stayeaseFavoritesUpdated"));
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImage((value) => (value + 1) % room.images.length);
  };

  const previousImage = (e) => {
    e.stopPropagation();
    setCurrentImage(
      (value) => (value - 1 + room.images.length) % room.images.length
    );
  };

  return (
    <article className="room-card">
      <div className="room-card-gallery">
        <img
          className="room-card-main-image"
          src={room.images[currentImage]}
          alt={room.name}
        />

        <button
          className={`room-favorite ${favorite ? "active" : ""}`}
          onClick={toggleFavorite}
          aria-label={
            favorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <img src={love} alt="" />
        </button>

        {room.images.length > 1 && (
          <>
            <button className="gallery-arrow left" onClick={previousImage}>
              ‹
            </button>

            <button className="gallery-arrow right" onClick={nextImage}>
              ›
            </button>
          </>
        )}
      </div>

      <div className="room-card-thumbnails">
        {room.images.map((image, index) => (
          <button
            key={`${room.id}-${index}`}
            className={currentImage === index ? "selected" : ""}
            onClick={() => setCurrentImage(index)}
          >
            <img src={image} alt="" />
          </button>
        ))}
      </div>

      <div className="room-card-content">
        <div className="room-card-topline">
          <span>{room.capacity}</span>
          <span>
            ₱{room.pricingDay.toLocaleString()} / DAY
          </span>
        </div>

        <h3>{room.name}</h3>

        <p className="room-short">{room.description}</p>

        <p className="room-long">{room.longDescription}</p>

        <button
          className="room-details-button"
          onClick={() => onViewDetails(room)}
        >
          VIEW ROOM DETAILS <span>→</span>
        </button>
      </div>
    </article>
  );
}
