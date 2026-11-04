import { EDITORIAL_IMAGES } from "./editorialImages";
import { useLocation } from "react-router-dom";
import { readPublicLocale } from "../publicSite/locale";
export default function EditorialVisual({
  kind = "family",
  compact = false,
}: {
  kind?: "family" | "lifestyle";
  compact?: boolean;
}) {
  const location = useLocation();
  const es = readPublicLocale(location.search) === "es";
  const ownedImage = EDITORIAL_IMAGES[location.pathname === "/tax-planning-report-card" ? "/tax-review-report-card" : location.pathname];
  if (location.pathname !== "/" && !ownedImage) return null;
  const lifestyle = kind === "lifestyle";
  return (
    <figure
      id={`editorial-${kind}`}
      className={`editorial-visual${compact ? " editorial-visual--compact" : ""}`}
    >
      <img
        src={
          ownedImage?.src ??
          `/images/editorial/${lifestyle ? "considered-home" : "family-terrace"}.webp`
        }
        width="1536"
        height="1024"
        loading="lazy"
        alt={
          ownedImage
            ? es
              ? ownedImage.altEs
              : ownedImage.alt
            : lifestyle
              ? es
                ? "Casa de piedra con terraza y paisaje natural"
                : "A thoughtfully designed home overlooking the hills"
              : es
                ? "Una familia de varias generaciones comparte una tarde en una terraza"
                : "A multigenerational family sharing time on a terrace"
        }
      />
      <figcaption>
        <span>
          {location.pathname === "/report-cards"
            ? es ? "TU PERSPECTIVA FINANCIERA" : "YOUR FINANCIAL PERSPECTIVE"
            : lifestyle
            ? es
              ? "LA VIDA QUE HAS CREADO"
              : "THE LIFE YOU HAVE CREATED"
            : es
              ? "LAS PERSONAS QUE MÁS IMPORTAN"
              : "THE PEOPLE WHO MATTER MOST"}
        </span>
        <small>
          {es ? "Imagen editorial ilustrativa" : "Illustrative editorial image"}
        </small>
      </figcaption>
    </figure>
  );
}
