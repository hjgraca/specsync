import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function QRButton() {
  const [show, setShow] = useState(false);
  const url = window.location.href;

  return (
    <>
      <button
        onClick={() => setShow(!show)}
        style={{
          padding: "4px 10px",
          borderRadius: "4px",
          border: "1px solid #e0e0e0",
          background: "#fff",
          fontSize: "0.75rem",
          cursor: "pointer",
          color: "#555",
        }}
      >
        {show ? "Hide QR" : "QR"}
      </button>
      {show && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: "8px",
          padding: "12px",
          background: "#fff",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          border: "1px solid #e0e0e0",
          zIndex: 1000,
        }}>
          <QRCodeSVG value={url} size={200} />
          <p style={{ fontSize: "0.7rem", color: "#666", marginTop: "8px", textAlign: "center" }}>
            Scan to open on phone
          </p>
        </div>
      )}
    </>
  );
}
