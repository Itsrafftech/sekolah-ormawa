import { ImageResponse } from "next/og";

export const alt = "Sekolah Ormawa Eksekutif PKU - Angkatan 63";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#f2eadb",
          color: "#241917",
          display: "flex",
          height: "100%",
          padding: "64px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid #702330",
            borderRadius: "999px",
            height: "410px",
            position: "absolute",
            right: "70px",
            top: "95px",
            width: "410px",
          }}
        />
        <div
          style={{
            alignItems: "center",
            background: "#702330",
            borderRadius: "999px",
            color: "#f2eadb",
            display: "flex",
            fontSize: 118,
            height: "310px",
            justifyContent: "center",
            position: "absolute",
            right: "120px",
            top: "145px",
            width: "310px",
          }}
        >
          63
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "650px" }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Eksekutif PKU · DRAFT
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#702330", display: "flex", fontSize: 76, lineHeight: 1 }}>Sekolah</div>
            <div style={{ display: "flex", fontSize: 104, lineHeight: 0.95 }}>Ormawa</div>
            <div style={{ display: "flex", fontSize: 25, marginTop: 28 }}>Belajar organisasi dari dalam, bertumbuh bersama.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
