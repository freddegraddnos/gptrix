import React from "react";
import { Img, Link, Section } from "@react-email/components";

/** The saved booking photo already has a private, signed storage URL. */
export function BookingPhoto({ photoUrl, bodyArea, sizeCm }: {
  photoUrl?: string;
  bodyArea?: string;
  sizeCm?: string;
}) {
  if (!photoUrl) return null;
  return (
    <Section style={{ margin: "0 0 20px" }}>
      <Link href={photoUrl}>
        <Img
          src={photoUrl}
          alt={`Booking photo${bodyArea ? ` — ${bodyArea}` : ""}${sizeCm ? ` · ${sizeCm} cm` : ""}`}
          width="464"
          style={{ display: "block", width: "100%", maxWidth: "464px", height: "auto" }}
        />
      </Link>
      <Link href={photoUrl} style={{ color: "#7A45E5", fontSize: "14px" }}>
        View booking photo
      </Link>
    </Section>
  );
}