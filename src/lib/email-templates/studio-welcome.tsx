import { publicSiteUrl } from "@/lib/publicOrigin";
import React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { studioName?: string; email?: string; password?: string }

const Email = ({ studioName, email, password }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Välkommen till InkSimulator – dina inloggningsuppgifter</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>INKSIMULATOR</Text>
        <Heading style={h1}>Välkommen till InkSimulator</Heading>
        <Text style={p}>Hej!</Text>
        <Text style={p}>Ert studiokonto för <b>{studioName || "er studio"}</b> är nu skapat och godkänt.</Text>
        <Text style={p}>
          <b>Dina inloggningsuppgifter:</b><br />
          Användarnamn: {email}<br />
          Tillfälligt lösenord: {password}
        </Text>
        <Text style={small}>Vid första inloggningen blir du ombedd att välja ett eget lösenord.</Text>
        <Button href={publicSiteUrl("/auth")} style={btn}>Logga in</Button>
        <Text style={p}>
          <b>Kom igång:</b><br />
          1. Logga in på studiopanelen.<br />
          2. Se över profilen och lägg upp ditt första motiv så kunder kan prova det i AR.<br />
          3. Dela er studiolänk och ta emot kundförfrågningar.
        </Text>
        <Text style={p}>
          <b>Frågor, hjälp eller synpunkter?</b><br />
          Fredrik<br />
          E-post: fredrik@inksimulator.com<br />
          Telefon: 079 328 80 98
        </Text>
        <Text style={p}>Varmt välkommen!</Text>
        <Text style={p}>Bästa hälsningar<br />Fredrik och resten av InkSimulator!</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Välkommen till InkSimulator – inloggningsuppgifter till din studio",
  displayName: "Studio welcome",
  previewData: { studioName: "Demo Studio", email: "demo@example.com", password: "InkStudio2026!" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "monospace" };
const container = { padding: "24px", maxWidth: "560px" };
const brand = { fontSize: "12px", letterSpacing: "2px", color: "#8A5BF2" };
const h1 = { fontSize: "22px", color: "#161616" };
const p = { fontSize: "15px", color: "#161616", lineHeight: "1.5" };
const small = { fontSize: "13px", color: "#444444" };
const btn = { backgroundColor: "#8A5BF2", color: "#ffffff", padding: "12px 20px", borderRadius: "6px", textDecoration: "none", fontSize: "15px" };
