import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  studioName?: string;
  heading?: string;
  message?: string;
  lang?: "sv" | "en";
}

/** Booking confirmation / reminder to a customer, with the studio's own text. */
const Email = ({ studioName, heading, message, lang = "en" }: Props) => (
  <Html lang={lang} dir="ltr">
    <Head />
    <Preview>{heading || studioName || "InkSimulator"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{(studioName || "INKSIMULATOR").toUpperCase()}</Text>
        <Heading style={h1}>{heading || (lang === "sv" ? "Din bokning" : "Your booking")}</Heading>
        {(message || "").split("\n").map((line, i) => (
          <Text key={i} style={text}>
            {line}
          </Text>
        ))}
        <Text style={foot}>
          {lang === "sv" ? "Bokad via InkSimulator" : "Booked via InkSimulator"}
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => d?.heading || "Your booking",
  displayName: "Studio booking message",
  previewData: {
    studioName: "1891frs",
    heading: "Your booking is confirmed",
    message: "Hi Anna! Your appointment at 1891frs is booked for 4 Oct at 14:00.",
    lang: "en",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "520px" };
const brand = {
  fontSize: "12px",
  letterSpacing: "4px",
  color: "#8a5bf2",
  margin: "0 0 16px",
  fontWeight: 700 as const,
};
const h1 = { fontSize: "24px", margin: "0 0 12px", color: "#111111" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333", margin: "0 0 12px" };
const foot = { fontSize: "12px", color: "#8a8a8a", margin: "24px 0 0" };
