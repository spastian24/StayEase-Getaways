import { useEffect, useState } from "react";
import RoomCard from "./RoomCard";
import "./RoomAmenities.css";

import Standard from "./assets/Standard.png";
import StandardToiletries from "./assets/StandardToiletries.png";
import WifiTelephone from "./assets/WifiTelephone.png";
import Twin from "./assets/Twin.png";
import MiniRef from "./assets/MiniRef.png";
import Closet from "./assets/Closet.png";
import Deluxe from "./assets/Deluxe.png";
import PremiumToiletries from "./assets/PremiumToiletries.png";
import Television from "./assets/Television.png";
import Triple from "./assets/Triple.png";
import Quadruple from "./assets/Quadruple.png";
import Sofa from "./assets/Sofa.png";
import Balcony from "./assets/Balcony.png";
import DiningTable from "./assets/DiningTable.png";
import IroningBoard from "./assets/IroningBoard.png";

import pool from "./assets/pool.png";
import spa from "./assets/spa.png";
import bfast from "./assets/bfast.png";
import restau from "./assets/restau.png";
import gym from "./assets/gym.png";
import meeting from "./assets/meeting.png";

const rooms = [
  {
    id: "standard",
    name: "One Bedroom",
    minPax: 1,
    maxPax: 2,
    pricingDay: 1999,
    pricingOvernight: 2999,
    capacity: "1–2 GUESTS",
    description: "Simple, cozy, and comfortable.",
    longDescription:
      "A welcoming choice for solo travelers or couples looking for a comfortable space to rest and recharge.",
    images: [Standard, StandardToiletries, WifiTelephone],
    highlights: [
      "Cozy and practical space",
      "Air conditioning",
      "Free Wi-Fi",
      "Private bathroom",
      "Blackout curtains",
    ],
  },
  {
    id: "twin",
    name: "Deluxe Twin",
    minPax: 1,
    maxPax: 2,
    pricingDay: 2499,
    pricingOvernight: 3499,
    capacity: "1–2 GUESTS",
    description: "More room to share.",
    longDescription:
      "With twin beds and added conveniences, the Deluxe Twin Room is ideal for friends, family, or travel companions who want to stay comfortably together.",
    images: [Twin, MiniRef, Closet, StandardToiletries, WifiTelephone],
    highlights: [
      "Twin beds",
      "Mini refrigerator",
      "Work desk",
      "Large closet",
      "Comfortable shared space",
    ],
  },
  {
    id: "deluxe",
    name: "Deluxe Queen Room",
    minPax: 1,
    maxPax: 3,
    pricingDay: 2999,
    pricingOvernight: 3999,
    capacity: "1–3 GUESTS",
    description: "Settle in and relax.",
    longDescription:
      "Enjoy the comfort of a queen bed with upgraded in-room amenities, making this a great choice for couples or guests looking for a more refined stay.",
    images: [
      Deluxe,
      PremiumToiletries,
      Television,
      MiniRef,
      Closet,
      WifiTelephone,
    ],
    highlights: [
      "Queen bed",
      "Premium toiletries",
      "Hairdryer",
      "TV with cable",
      "Mini refrigerator",
      "Work desk",
    ],
  },
  {
    id: "triple",
    name: "Superior Triple Room",
    minPax: 3,
    maxPax: 6,
    pricingDay: 3499,
    pricingOvernight: 4499,
    capacity: "3–6 GUESTS",
    description: "More space for the people you love.",
    longDescription:
      "Designed for families and small groups, this spacious room gives you more room to relax, with a private balcony for an added touch of comfort.",
    images: [
      Triple,
      Sofa,
      Balcony,
      Television,
      MiniRef,
      PremiumToiletries,
      WifiTelephone,
    ],
    highlights: [
      "Spacious seating area",
      "Private balcony",
      "Smart TV",
      "Premium linens",
      "Mini refrigerator",
      "Work desk",
    ],
  },
  {
    id: "quadruple",
    name: "Superior Quadruple Room",
    minPax: 4,
    maxPax: 8,
    pricingDay: 3999,
    pricingOvernight: 5499,
    capacity: "4–8 GUESTS",
    description: "Room for the whole family.",
    longDescription:
      "Our most spacious room is made for larger families and groups, offering plenty of room to relax, gather, and enjoy your stay together.",
    images: [
      Quadruple,
      Sofa,
      Balcony,
      DiningTable,
      Television,
      IroningBoard,
      MiniRef,
    ],
    highlights: [
      "Spacious seating area",
      "Private balcony",
      "Dining table",
      "Smart TV",
      "Premium linens",
      "Iron & ironing board",
      "Mini refrigerator",
    ],
  },
];

const amenities = [
  {
    title: "Swimming Pool",
    image: pool,
    text: "Take a refreshing pause in a calm and comfortable pool setting.",
  },
  {
    title: "Wellness & Spa",
    image: spa,
    text: "Make space for rest, relaxation, and a slower pace.",
  },
  {
    title: "Breakfast & Dining",
    image: bfast,
    text: "Start your morning with comforting food and thoughtful service.",
  },
  {
    title: "Restaurant",
    image: restau,
    text: "Enjoy relaxed dining throughout your stay.",
  },
  {
    title: "Fitness Center",
    image: gym,
    text: "Keep your routine going in a convenient fitness space.",
  },
  {
    title: "Meeting Facilities",
    image: meeting,
    text: "Flexible spaces for meetings, gatherings, and events.",
  },
];

export default function RoomAmenities({ onBookNow }) {
  const [detailRoom, setDetailRoom] = useState(null);
  const [detailImage, setDetailImage] = useState(0);

  useEffect(() => {
    document.body.style.overflow = detailRoom ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [detailRoom]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDetailRoom(null);
      }

      if (detailRoom && event.key === "ArrowRight") {
        setDetailImage((current) =>
          current === detailRoom.images.length - 1 ? 0 : current + 1
        );
      }

      if (detailRoom && event.key === "ArrowLeft") {
        setDetailImage((current) =>
          current === 0 ? detailRoom.images.length - 1 : current - 1
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailRoom]);

  const openDetails = (room) => {
    setDetailRoom(room);
    setDetailImage(0);
  };

  const closeDetails = () => {
    setDetailRoom(null);
    setDetailImage(0);
  };

  const nextImage = () => {
    if (!detailRoom) return;

    setDetailImage((current) =>
      current === detailRoom.images.length - 1 ? 0 : current + 1
    );
  };

  const previousImage = () => {
    if (!detailRoom) return;

    setDetailImage((current) =>
      current === 0 ? detailRoom.images.length - 1 : current - 1
    );
  };

  return (
    <main className="rooms-page">
      <section className="rooms-hero">
        <div className="rooms-hero-layer layer-one" />
        <div className="rooms-hero-layer layer-two" />

        <div className="rooms-hero-content">
          <span>STAYEASE ROOMS & AMENITIES</span>

          <h1>
            Find a room,
            <em>that feels like yours.</em>
          </h1>

          <p>
            Comfortable spaces, thoughtful details, and everything you need
            for a stay that feels easy.
          </p>
        </div>
      </section>

      <section className="rooms-section">
        <div className="rooms-heading">
          <div>
            <span>OUR ROOMS</span>
            <h2>
              Find your
              <br />
              <em>comfort.</em>
            </h2>
          </div>

          <p>
            Choose from comfortable rooms for couples to spacious
            accommodations for families and groups. Each room offers its own
            features and comforts to suit different types of stays.
          </p>
        </div>

        <div className="rooms-grid">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onViewDetails={openDetails}
            />
          ))}
        </div>
      </section>

      <section className="included-section">
        <div className="included-heading">
          <span>COMFORT, INCLUDED</span>

          <h2>
            What's Included
            <br />
            <em>in Your Room</em>
          </h2>
        </div>

        <div className="included-list">
          <div>
            <strong>EVERY STAY</strong>
            <p>Air conditioning</p>
            <p>Private bathroom</p>
            <p>Complimentary Wi-Fi</p>
            <p>Blackout curtains</p>
            <p>Fresh linens</p>
          </div>

          <div>
            <strong>THOUGHTFUL DETAILS</strong>
            <p>Work desk</p>
            <p>Television</p>
            <p>Comfortable seating</p>
            <p>Bathroom toiletries</p>
            <p>Telephone</p>
          </div>

          <div>
            <strong>ADDED COMFORT</strong>
            <p>Mini refrigerator</p>
            <p>Premium toiletries</p>
            <p>Private balcony on selected rooms</p>
            <p>Dining space on selected rooms</p>
            <p>Ironing facilities on selected rooms</p>
          </div>
        </div>
      </section>

      <section className="beyond-section">
        <div className="beyond-heading">
          <span>BEYOND YOUR ROOM</span>

          <h2>
            More ways to
            <br />
            <em>make yourself comfortable.</em>
          </h2>
        </div>

        <div className="amenities-grid">
          {amenities.map((amenity) => (
            <article className="amenity-card" key={amenity.title}>
              <img src={amenity.image} alt={amenity.title} />

              <div>
                <h3>{amenity.title}</h3>
                <p>{amenity.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {detailRoom && (
        <div
          className="room-detail-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetails();
            }
          }}
        >
          <div className="room-detail-modal">
            <button
              type="button"
              className="detail-close"
              onClick={closeDetails}
              aria-label="Close room details"
            >
              ×
            </button>

            <div className="detail-gallery">
              <button
                type="button"
                className="detail-gallery-arrow detail-gallery-arrow-left"
                onClick={previousImage}
                aria-label="Previous image"
              >
                ‹
              </button>

              <img
                src={detailRoom.images[detailImage]}
                alt={detailRoom.name}
              />

              <button
                type="button"
                className="detail-gallery-arrow detail-gallery-arrow-right"
                onClick={nextImage}
                aria-label="Next image"
              >
                ›
              </button>

              <div className="detail-thumbnails">
                {detailRoom.images.map((image, index) => (
                  <button
                    type="button"
                    key={index}
                    className={detailImage === index ? "selected" : ""}
                    onClick={() => setDetailImage(index)}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            </div>

            <div className="detail-content">
              <span>{detailRoom.capacity}</span>

              <h2>{detailRoom.name}</h2>

              <p className="detail-description">
                {detailRoom.longDescription}
              </p>

              <div className="detail-price">
                <div>
                  <small>DAY STAY</small>
                  <strong>
                    ₱{detailRoom.pricingDay.toLocaleString()}
                  </strong>
                </div>

                <div>
                  <small>OVERNIGHT</small>
                  <strong>
                    ₱{detailRoom.pricingOvernight.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="detail-highlights">
                <span>ROOM HIGHLIGHTS</span>

                <ul>
                  {detailRoom.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                className="primary-button detail-book-button"
                onClick={() => {
                  closeDetails();
                  onBookNow?.({ roomId: detailRoom.id });
                }}
              >
                BOOK THIS ROOM
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
