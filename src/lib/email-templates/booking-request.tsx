import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BookingPhoto } from "./booking-photo";

interface Props {
  studioName?: string;
  clientName?: string;
  date?: string;
  time?: string;
  bodyArea?: string;
  sizeCm?: string;
  note?: string;
  link?: string;
  answers?: { question: string; answer: string }[];
  hasCustomerPhoto?: boolean;
  photoUrl?: string;
}

const Email = ({
  studioName,
  clientName,
  date,
  time,
  bodyArea,
  sizeCm,
  note,
  link,
  answers,
  hasCustomerPhoto,
  photoUrl,
}: Props) => {
  const url = link || "https://www.inksimulator.com/artists/dashboard";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`New booking request${clientName ? ` from ${clientName}` : ""}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>INKSIMULATOR</Text>
          <Heading style={h1}>New booking request</Heading>
          <Text style={text}>
            {clientName || "A client"} wants to book {studioName || "your studio"}.
          </Text>
          <Section style={quote}>
            <Text style={quoteText}>
              Date: {date || "—"}
              {time ? ` at ${time}` : ""}
              <br />
              Placement: {bodyArea || "—"}
              {sizeCm ? ` · ${sizeCm} cm` : ""}
              <br />
              Customer photo:{" "}
              {photoUrl ? "Included below" : hasCustomerPhoto ? "Attached to the private request" : "Open the private request"}
              {note ? (
                <>
                  <br />
                  Note: {note}
                </>
              ) : null}
              {(answers ?? []).map((a, i) => (
                <React.Fragment key={i}>
                  <br />
                  {a.question}: {a.answer || "—"}
                </React.Fragment>
              ))}
            </Text>
          </Section>
          <BookingPhoto photoUrl={photoUrl} bodyArea={bodyArea} sizeCm={sizeCm} />
          <Button href={url} style={button}>
            Confirm or decline
          </Button>
          <Text style={muted}>You can manage all requests in the artist panel.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New booking request${data?.date ? ` — ${data.date}` : ""} · InkSimulator`,
  displayName: "Booking request",
  previewData: {
    studioName: "Nordic Ink Studio",
    clientName: "Fredrik",
    date: "2026-09-04",
    time: "14:00",
    bodyArea: "Forearm",
    sizeCm: "12",
    note: "Fine line snake, black and grey.",
    link: "https://www.inksimulator.com/artists/bookings/00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "520px" };
const brand = {
  fontSize: "12px",
  letterSpacing: "4px",
  color: "#8a8a8a",
  margin: "0 0 16px",
  fontWeight: 700 as const,
};
const h1 = { fontSize: "24px", margin: "0 0 12px", color: "#111111" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333", margin: "0 0 12px" };
const quote = {
  borderLeft: "3px solid #7c3aed",
  padding: "8px 14px",
  backgroundColor: "#f6f6f6",
  margin: "0 0 20px",
};
const quoteText = { fontSize: "15px", lineHeight: "24px", color: "#222222", margin: 0 };
const button = {
  backgroundColor: "#111111",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700 as const,
  textDecoration: "none",
};
const muted = { fontSize: "12px", color: "#8a8a8a", margin: "24px 0 0" };
