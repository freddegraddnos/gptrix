import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { BookingPhoto } from "./booking-photo";

interface Props {
  studioName?: string;
  date?: string;
  time?: string;
  address?: string;
  bodyArea?: string;
  sizeCm?: string;
  link?: string;
  calendarLink?: string;
  greeting?: string;
  answers?: { question: string; answer: string }[];
  photoUrl?: string;
}

const Email = ({
  studioName,
  date,
  time,
  address,
  bodyArea,
  sizeCm,
  link,
  calendarLink,
  greeting,
  answers,
  photoUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We sent your booking request to the studio</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={h1}>Your request is on its way</Heading>
        <Text style={text}>
          {studioName || "The studio"} has received your booking request. Nothing is booked yet —
          your appointment is confirmed only when the studio accepts the request. You will get
          another email as soon as they do, and a reminder the day before your session.
        </Text>
        <Section style={quote}>
          <Text style={quoteText}>
            {date || "—"}
            {time ? ` at ${time}` : ""}
            {address ? ` · ${address}` : ""}
            {bodyArea ? ` · ${bodyArea}` : ""}
            {sizeCm ? ` · ${sizeCm} cm` : ""}
          </Text>
        </Section>
        <BookingPhoto photoUrl={photoUrl} bodyArea={bodyArea} sizeCm={sizeCm} />
        {greeting ? <Text style={text}>{greeting}</Text> : null}
        {answers && answers.length > 0 ? (
          <Section style={quote}>
            {answers.map((a, i) => (
              <Text key={i} style={quoteText}>
                {a.question}: {a.answer || "—"}
              </Text>
            ))}
          </Section>
        ) : null}
        <Button href={link || "https://www.inksimulator.com/bookings"} style={button}>
          View my bookings
        </Button>
        {calendarLink ? (
          <Text style={text}>
            <Link href={calendarLink} style={linkStyle}>
              Add this time to my calendar
            </Link>
          </Text>
        ) : null}
        <Text style={muted}>
          Times are shown in the studio&apos;s local time. Need to change something? Open the app
          and reschedule or cancel from your bookings.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "We received your booking request — InkSimulator",
  displayName: "Booking received (client)",
  previewData: {
    studioName: "Nordic Ink Studio",
    date: "2026-09-04",
    time: "14:00",
    address: "Storgatan 1, Stockholm",
    bodyArea: "Forearm",
    sizeCm: "12",
    link: "https://www.inksimulator.com/bookings",
    calendarLink: "https://calendar.google.com/calendar/render?action=TEMPLATE",
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
  borderLeft: "3px solid #8A5BF2",
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
const linkStyle = { color: "#7A45E5", fontWeight: 700 as const };
const muted = { fontSize: "12px", color: "#8a8a8a", margin: "24px 0 0" };
