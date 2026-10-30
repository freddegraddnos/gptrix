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
  senderName?: string;
  preview?: string;
  link?: string;
}

const Email = ({ senderName, preview, link }: Props) => {
  const name = senderName || "Someone";
  const url = link || "https://www.inksimulator.com/messages";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${name} sent you a message on InkSimulator`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>INKSIMULATOR</Text>
          <Heading style={h1}>New message</Heading>
          <Text style={text}>
            <strong>{name}</strong> wrote to you in the app:
          </Text>
          {preview ? (
            <Section style={quote}>
              <Text style={quoteText}>{preview}</Text>
            </Section>
          ) : null}
          <Button href={url} style={button}>
            Open the conversation
          </Button>
          <Text style={muted}>
            You can turn off these notifications under Profile → Notifications in the app.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `New message from ${data?.senderName || "a user"} — InkSimulator`,
  displayName: "New message",
  previewData: {
    senderName: "Nordic Ink Studio",
    preview: "Hi! We have a slot open on Friday if you want to book your session.",
    link: "https://www.inksimulator.com/messages",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: '"DM Mono", Consolas, monospace' };
const container = {
  backgroundColor: "#F6F2EA",
  border: "2px solid #161616",
  padding: "32px 28px",
  maxWidth: "520px",
};
const brand = {
  fontSize: "12px",
  letterSpacing: "4px",
  color: "#8A5BF2",
  margin: "0 0 16px",
  fontWeight: 700 as const,
};
const h1 = {
  fontFamily: 'Impact, "Arial Narrow", sans-serif',
  fontSize: "28px",
  margin: "0 0 12px",
  color: "#161616",
  textTransform: "uppercase" as const,
};
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333", margin: "0 0 12px" };
const quote = {
  backgroundColor: "#f4f4f5",
  borderRadius: "4px",
  padding: "14px 16px",
  margin: "0 0 20px",
};
const quoteText = { fontSize: "15px", lineHeight: "23px", color: "#111111", margin: "0" };
const button = {
  backgroundColor: "#161616",
  color: "#ffffff",
  borderRadius: "4px",
  padding: "13px 22px",
  fontSize: "14px",
  fontWeight: 700 as const,
  textDecoration: "none",
  display: "inline-block",
};
const muted = { fontSize: "12px", color: "#777777", margin: "24px 0 0" };
