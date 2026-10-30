import React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

const Email = ({ studioName, lang }: { studioName?: string; lang?: string }) => {
  const sv = lang === "sv";
  return (
    <Html lang={sv ? "sv" : "en"} dir="ltr">
      <Head />
      <Preview>{sv ? "Testavisering från InkSimulator" : "Test notification from InkSimulator"}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "monospace" }}>
        <Container style={{ padding: "24px" }}>
          <Text style={{ fontSize: "12px", letterSpacing: "2px", color: "#8A5BF2" }}>INKSIMULATOR</Text>
          <Heading style={{ fontSize: "22px", color: "#161616" }}>{sv ? "Aviseringen fungerar" : "Notifications work"}</Heading>
          <Text style={{ fontSize: "15px", color: "#161616" }}>
            {sv
              ? `Hit skickas nya kundförfrågningar för ${studioName || "din studio"}.`
              : `New client requests for ${studioName || "your studio"} will be sent here.`}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => (d?.lang === "sv" ? "Testavisering · InkSimulator" : "Test notification · InkSimulator"),
  displayName: "Studio test notice",
  previewData: { studioName: "Demo Studio", lang: "sv" },
} satisfies TemplateEntry;
