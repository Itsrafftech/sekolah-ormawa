import { ImageResponse } from "next/og";

export const alt = "Sekolah Ormawa PKU - Angkatan 63";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#f5f7fb",
          color: "#0b1220",
          display: "flex",
          height: "100%",
          padding: "64px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "2px solid #0035ad",
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
            background: "#f4e11b",
            borderRadius: "999px",
            color: "#00205b",
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
            Ormawa PKU
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#0035ad", display: "flex", fontSize: 76, lineHeight: 1 }}>Sekolah</div>
            <div style={{ display: "flex", fontSize: 104, lineHeight: 0.95 }}>Ormawa</div>
            <div style={{ display: "flex", fontSize: 25, marginTop: 28 }}>Kenali organisasi. Temukan peran. Bertumbuh bersama.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
