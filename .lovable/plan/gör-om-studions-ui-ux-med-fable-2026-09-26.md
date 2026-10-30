# Gör om studions UI/UX med Fable

## Målet
Ge studion en sammanhängande, genomarbetad arbetsyta från inloggning till dagligt arbete. Fable får själv bestämma komposition, prioriteringar, storlekar, rytm och uttryck; jag styr inte dess formgivning med en färdig skiss eller detaljerade estetiska instruktioner. InkVisions befintliga svart/vitt/cyan-identitet behålls som varumärkesram.

## Omfattning
- Gör om studioinloggningen och den privata studiopanelen, inklusive profil, motiv och galleri, bokningar och kalender, förfrågningar och meddelanden, kunder, ekonomi och guide.
- Ge sammanhörande studioverktyg en konsekvent navigation och tydlig skillnad mellan studioarbete och kundvy. Anpassa arbetsflödena för mobil och större skärmar.
- Behåll alla befintliga funktioner och kopplingar, bland annat Fortnox, Posture Pro, kalender och betalningar. Den nyligen gjorda offentliga studioguiden kan återanvändas men får anpassas där den ingår i arbetsflödet.
- Ändra inte AR-motorn, datamodellen eller kundernas studiosökning.

## Genomförande
1. Ta bilder av de faktiska studiovyerna och ge Fable deras nuvarande innehåll, flöden och tekniska gränser. Låt Fable utforma helheten från grunden utan att jag föreskriver en layout.
2. Integrera Fables valda utformning i studioytorna. Återanvänd befintliga handlingar och datakopplingar i stället för att ersätta fungerande logik.
3. Kontrollera navigering och centrala handlingar i mobil och desktop: inloggning, profiländring, motiv/galleri, bokning/förfrågan, ekonomi och guide. Rätta visuella eller funktionella regressioner innan arbetet lämnas över.

## Tekniska ramar
Fable 5.1 används för designarbetet. Arbetet hålls i presentationslagret; AR-filer och AR-beteende lämnas orörda. Projektets semantiska färgtokens och befintliga autentisering används fortsatt. Tester och förhandsvisning verifierar resultatet.
