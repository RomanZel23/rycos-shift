/**
 * Odczyt daty wykonania zdjęcia z metadanych EXIF.
 *
 * Po co: zdjęcie wybrane z galerii może być zrobione tydzień temu i na innym
 * placu. Raport zapisuje moment dodania do dokumentu, więc bez tej daty
 * fotorelacja przestaje być dowodem „tak wyglądało wtedy tam". Datę bierzemy
 * z ORYGINALNEGO pliku — przerysowanie zdjęcia na canvasie (kompresja przed
 * wysyłką) kasuje wszystkie metadane.
 *
 * Bez biblioteki: potrzebne jest jedno pole z jednego segmentu, a doklejanie
 * paczki do czytania EXIF-a ciągnęłoby ze sobą kilkadziesiąt kilobajtów kodu
 * na telefon pracujący w terenie.
 *
 * Świadome ograniczenia:
 *   - obsługiwany jest JPEG; HEIC i PNG zwracają null (Safari i tak przekazuje
 *     zdjęcia z galerii jako JPEG),
 *   - czas jest zapisany w EXIF bez strefy — traktujemy go jako czas lokalny
 *     w miejscu wykonania zdjęcia i tak też pokazujemy,
 *   - cokolwiek podejrzanego w strukturze pliku kończy się wartością null.
 *     Brak daty jest bezpieczny; data zmyślona nie.
 */

const ZNACZNIK_APP1 = 0xffe1;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME_DIGITIZED = 0x9004;
const TAG_DATE_TIME = 0x0132;

/** "2026:09:05 14:32:07" -> "2026-09-05T14:32:07". Zwraca null dla bzdur. */
function naIso(surowa: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(surowa.trim());
  if (!m) return null;
  const [, rok, mies, dzien, godz, min, sek] = m;
  const r = Number(rok);
  // Aparaty z rozładowaną baterią potrafią wpisać 1970 albo 2000-01-01.
  if (r < 1995 || r > 2100) return null;
  if (Number(mies) < 1 || Number(mies) > 12 || Number(dzien) < 1 || Number(dzien) > 31) return null;
  return `${rok}-${mies}-${dzien}T${godz}:${min}:${sek}`;
}

function czytajAscii(widok: DataView, poczatek: number, dlugosc: number): string {
  let tekst = "";
  for (let i = 0; i < dlugosc; i += 1) {
    const kod = widok.getUint8(poczatek + i);
    if (kod === 0) break;
    tekst += String.fromCharCode(kod);
  }
  return tekst;
}

/**
 * Przechodzi katalog IFD i zwraca wartości interesujących nas tagów.
 * `tiff` to pozycja początku bloku TIFF — wszystkie przesunięcia w EXIF liczą
 * się właśnie od niego, a nie od początku pliku.
 */
function czytajIfd(
  widok: DataView,
  tiff: number,
  ifd: number,
  bigEndian: boolean
): { daty: Map<number, string>; wskaznikExif: number | null } {
  const daty = new Map<number, string>();
  let wskaznikExif: number | null = null;

  const liczbaWpisow = widok.getUint16(ifd, !bigEndian);
  // Zdrowy rozsądek: prawdziwy IFD ma kilkanaście wpisów, nie tysiące.
  if (liczbaWpisow > 512) return { daty, wskaznikExif };

  for (let i = 0; i < liczbaWpisow; i += 1) {
    const wpis = ifd + 2 + i * 12;
    if (wpis + 12 > widok.byteLength) break;

    const tag = widok.getUint16(wpis, !bigEndian);
    const typ = widok.getUint16(wpis + 2, !bigEndian);
    const liczba = widok.getUint32(wpis + 4, !bigEndian);

    if (tag === TAG_EXIF_IFD && typ === 4) {
      wskaznikExif = tiff + widok.getUint32(wpis + 8, !bigEndian);
      continue;
    }

    const interesujacy =
      tag === TAG_DATE_TIME_ORIGINAL || tag === TAG_DATE_TIME_DIGITIZED || tag === TAG_DATE_TIME;
    if (!interesujacy || typ !== 2 || liczba < 19 || liczba > 64) continue;

    // Wartości do czterech bajtów siedzą w samym wpisie; dłuższe — pod adresem.
    const pozycja = liczba <= 4 ? wpis + 8 : tiff + widok.getUint32(wpis + 8, !bigEndian);
    if (pozycja + liczba > widok.byteLength) continue;

    daty.set(tag, czytajAscii(widok, pozycja, liczba));
  }

  return { daty, wskaznikExif };
}

/**
 * Data wykonania zdjęcia jako "RRRR-MM-DDTGG:MM:SS" (czas lokalny, bez strefy)
 * albo null, gdy pliku nie da się odczytać lub nie ma w nim daty.
 */
export function readExifDateTaken(bufor: ArrayBuffer): string | null {
  try {
    const widok = new DataView(bufor);
    if (widok.byteLength < 16) return null;
    if (widok.getUint16(0) !== 0xffd8) return null; // nie JPEG

    let pozycja = 2;
    // Segmenty JPEG idą jeden po drugim aż do danych obrazu (SOS, 0xFFDA).
    while (pozycja + 4 <= widok.byteLength) {
      if (widok.getUint8(pozycja) !== 0xff) break;
      const znacznik = widok.getUint16(pozycja);
      if (znacznik === 0xffda || znacznik === 0xffd9) break;

      const dlugosc = widok.getUint16(pozycja + 2);
      if (dlugosc < 2 || pozycja + 2 + dlugosc > widok.byteLength) break;

      if (znacznik === ZNACZNIK_APP1) {
        const naglowek = czytajAscii(widok, pozycja + 4, 4);
        if (naglowek === "Exif") {
          const tiff = pozycja + 10; // 4 (znacznik + długość) + 6 ("Exif\0\0")
          if (tiff + 8 > widok.byteLength) return null;

          const kolejnosc = widok.getUint16(tiff);
          if (kolejnosc !== 0x4949 && kolejnosc !== 0x4d4d) return null;
          const bigEndian = kolejnosc === 0x4d4d;
          if (widok.getUint16(tiff + 2, !bigEndian) !== 42) return null;

          const ifd0 = tiff + widok.getUint32(tiff + 4, !bigEndian);
          if (ifd0 + 2 > widok.byteLength) return null;

          const zerowy = czytajIfd(widok, tiff, ifd0, bigEndian);
          const daty = new Map(zerowy.daty);

          if (zerowy.wskaznikExif !== null && zerowy.wskaznikExif + 2 <= widok.byteLength) {
            for (const [tag, wartosc] of czytajIfd(widok, tiff, zerowy.wskaznikExif, bigEndian).daty) {
              daty.set(tag, wartosc);
            }
          }

          // Kolejność nieprzypadkowa: DateTimeOriginal to moment naciśnięcia
          // migawki, DateTime bywa datą ostatniej edycji pliku.
          for (const tag of [TAG_DATE_TIME_ORIGINAL, TAG_DATE_TIME_DIGITIZED, TAG_DATE_TIME]) {
            const surowa = daty.get(tag);
            const iso = surowa ? naIso(surowa) : null;
            if (iso) return iso;
          }
          return null;
        }
      }

      pozycja += 2 + dlugosc;
    }
    return null;
  } catch {
    return null;
  }
}

/** "2026-09-05T14:32:07" -> "5.09.2026, 14:32". Do pokazania pod opisem. */
export function formatDateTaken(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  const [, rok, mies, dzien, godz, min] = m;
  return `${Number(dzien)}.${mies}.${rok}, ${godz}:${min}`;
}
