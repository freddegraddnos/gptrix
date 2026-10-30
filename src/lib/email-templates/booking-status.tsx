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

interface Props {
  studioName?: string;
  status?: string;
  date?: string;
  time?: string;
  link?: string;
  reason?: string;
}

const Email = ({ studioName, status, date, time, link, reason }: Props) => {
  const url = link || "https://www.inksimulator.com/bookings";
  const confirmed = status === "confirmed";
  const moved = status === "moved";
  const cancelled = status === "cancelled";
  const requested = status === "requested";
  const proposed = status === "proposed";
  const headline = proposed
    ? "The studio proposed a new time"
    : confirmed
      ? "Appointment confirmed"
      : requested
        ? "Request sent — awaiting studio approval"
        : moved
          ? "Appointment moved"
          : cancelled
            ? "Appointment cancelled"
            : "Booking declined";
  const verb = proposed
    ? "proposed a new time for"
    : confirmed
      ? "confirmed"
      : requested
        ? "received a booking request from you for"
        : moved
          ? "moved"
          : cancelled
            ? "cancelled"
            : "declined";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>INKSIMULATOR</Text>
          <Heading style={h1}>{headline}</Heading>
          <Text style={text}>
            {studioName || "The studio"} {verb}
            {requested ? "" : " your appointment"}.
          </Text>
          {reason ? <Text style={text}>Message from the studio: {reason}</Text> : null}
          <Section style={quote}>
            <Text style={quoteText}>
              {date || "—"}
              {time ? ` at ${time}` : ""}
            </Text>
          </Section>
          <Button href={url} style={button}>
            View my bookings
          </Button>
          <Text style={muted}>
            {proposed
              ? "Open your bookings to accept or decline the new time. Nothing is confirmed until you accept."
              : requested
                ? "Your booking is confirmed once the studio accepts the request. We will email you as soon as they do."
                : confirmed
                  ? "See you soon — bring your 1:1 preview from the app."
                  : "You can send a new request with another date, or find another studio in the app."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.status === "confirmed"
      ? "Your tattoo appointment is confirmed — InkSimulator"
      : "Update on your booking request — InkSimulator",
  displayName: "Booking status",
  previewData: {
    studioName: "Nordic Ink Studio",
    status: "confirmed",
    date: "2026-09-04",
    time: "14:00",
    link: "https://www.inksimulator.com/bookings",
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
const muted = { fontSize: "12px", color: "#8a8a8a", margin: "24px 0 0" };
