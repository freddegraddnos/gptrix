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
  date?: string;
  time?: string;
  address?: string;
  link?: string;
  calendarLink?: string;
}

const Email = ({ studioName, date, time, address, link, calendarLink }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reminder: your tattoo appointment is coming up</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={h1}>Your appointment is coming up</Heading>
        <Text style={text}>
          A quick reminder about your session at {studioName || "the studio"}.
        </Text>
        <Section style={quote}>
          <Text style={quoteText}>
            {date || "—"}
            {time ? ` at ${time}` : ""}
            {address ? ` · ${address}` : ""}
          </Text>
        </Section>
        <Button href={link || "https://www.inksimulator.com/bookings"} style={button}>
          View my bookings
        </Button>
        {calendarLink ? (
          <Text style={text}>
            <a href={calendarLink} style={{ color: "#7A45E5", fontWeight: 700 }}>
              Add to my calendar
            </a>
          </Text>
        ) : null}
        <Text style={muted}>
          Need to change the time? Open the app and reschedule or cancel from your bookings.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Reminder: your tattoo appointment — InkSimulator",
  displayName: "Booking reminder",
  previewData: {
    studioName: "Nordic Ink Studio",
    date: "2026-09-04",
    time: "14:00",
    address: "Storgatan 1, Stockholm",
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
