import { useState, useEffect } from "react";
import logo  from '../../Assets/icons/logo.png'
import { requestCode, type Session, verifyCode } from "../api";
interface LoginProps {
  onLoginSuccess?: (session: Session) => Promise<void> | void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendHover, setSendHover] = useState(false);
  const [loginHover, setLoginHover] = useState(false);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Lora:wght@500;600&family=Source+Sans+3:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  async function handleSendCode() {
    if (!email || !name || !mobile) return;
    setError("");
    setIsSending(true);
    try {
      await requestCode(name.trim(), email.trim(), mobile.trim());
      setCodeSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send a verification code.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
  e.preventDefault();

  if (!email || !codeSent || !code) {
    return;
  }

  setError("");
  setIsLoggingIn(true);
  try {
    const session = await verifyCode(email.trim(), code.trim());
    await onLoginSuccess?.(session);
  } catch (requestError) {
    setError(requestError instanceof Error ? requestError.message : "Unable to complete your booking.");
  } finally {
    setIsLoggingIn(false);
  }
}

  return (
    <div
    style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "rgb(255, 255, 255)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
    }}
    >
      <div
        style={{
            maxWidth: "400px",
            backgroundColor: "#ffffff",
            border: "1px solid #a9c5e6",
            borderRadius: "10px",
            padding: "2.25rem 2.25rem",
            boxShadow: "0 10px 30px rgba(23, 61, 97, 0.29)",
            width: "100%",
        }}
      >
        {/* Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            marginBottom: "1.25rem",
          }}
        >
          <RguktEmblem />
          <div>
            <h1
              style={{
                fontFamily: "'Lora', Georgia, serif",
                fontSize: "1.5rem",
                fontWeight: 600,
                color: "#991A02",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "0.04em",
              }}
            >
              RGUKT
            </h1>
            <p
              style={{
                fontSize: "0.65rem",
                color: "#991A02",
                margin: "3px 0 0",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Guest House Portal
            </p>
          </div>
        </div>

        <hr style={{ borderColor: "#e8eef4", borderTopWidth: "1px", marginBottom: "1.25rem" }} />

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div>
            <label htmlFor="Name" 
            style={{
              display : "block",
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "#244f77",
              marginBottom: "6px",
            }}>Name
            </label>
            <input
              id="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              style={{
                flex: 1,
                border: "1px solid #c8d4de",
                borderRadius: "6px",
                padding: "0.55rem 0.75rem",
                fontSize: "0.875rem",
                color: "#1e2d3d",
                backgroundColor: "#ffffff",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#244f77")}
              onBlur={(e) => (e.target.style.borderColor = "#c8d4de")}
            />
          </div>
          <div>
            <label htmlFor="mobile" style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "#244f77", marginBottom: "6px" }}>
              Mobile Number
            </label>
            <input
              id="mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Enter your mobile number"
              required
              style={{
                flex: 1,
                border: "1px solid #c8d4de",
                borderRadius: "6px",
                padding: "0.55rem 0.75rem",
                fontSize: "0.875rem",
                color: "#1e2d3d",
                backgroundColor: "#ffffff",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#244f77")}
              onBlur={(e) => (e.target.style.borderColor = "#c8d4de")}
            />
          </div>
          {/* Email row */}
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "#244f77",
                marginBottom: "6px",
              }}
            >
              Email
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  flex: 1,
                  border: "1px solid #c8d4de",
                  borderRadius: "6px",
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.875rem",
                  color: "#1e2d3d",
                  backgroundColor: "#ffffff",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#244f77")}
                onBlur={(e) => (e.target.style.borderColor = "#c8d4de")}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!email || !name || !mobile || isSending}
                onMouseEnter={() => setSendHover(true)}
                onMouseLeave={() => setSendHover(false)}
                style={{
                  flexShrink: 0,
                  border: "1px solid #244f77",
                  borderRadius: "6px",
                  padding: "0.45rem 0.65rem",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#0e406e",
                  backgroundColor: sendHover && email ? "#eef3f8" : "#ffffff",
                  cursor: email && name && mobile ? "pointer" : "not-allowed",
                  opacity: email && name && mobile ? 1 : 0.45,
                  transition: "background-color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {isSending ? "Sending…" : codeSent ? "Resend" : "Send Code"}
              </button>
            </div>
            {codeSent && (
              <p style={{ fontSize: "0.72rem", color: "#416585", marginTop: "5px" }}>
                A verification code has been sent to your email.
              </p>
            )}
          </div>

          {/* Verification code */}
          <div>
            <label
              htmlFor="code"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "#244f77",
                marginBottom: "6px",
              }}
            >
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter verification code"
              required
              style={{
                width: "100%",
                border: "1px solid #c8d4de",
                borderRadius: "6px",
                padding: "0.55rem 0.75rem",
                fontSize: "0.875rem",
                color: "#1e2d3d",
                backgroundColor: "#ffffff",
                outline: "none",
                transition: "border-color 0.15s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#244f77")}
              onBlur={(e) => (e.target.style.borderColor = "#c8d4de")}
            />
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={!codeSent || !code || isLoggingIn}
            onMouseEnter={() => setLoginHover(true)}
            onMouseLeave={() => setLoginHover(false)}
            style={{
                width: "100%",
                backgroundColor:
                    !codeSent || !code
                    ? "#9aaabd"
                    : loginHover
                        ? "#1a3b5c"
                        : "#244f77",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.7rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: !codeSent || !code ? "not-allowed" : "pointer",
                transition: "background-color 0.15s",
                marginTop: "0.25rem",
                }}
        >
            {isLoggingIn ? "Confirming…" : "Login"}
          </button>
        </form>

        {error && <p role="alert" style={{ marginTop: "0.8rem", color: "#a82020", fontSize: "0.78rem" }}>{error}</p>}

        <p
          style={{
            marginTop: "1.75rem",
            textAlign: "center",
            fontSize: "0.68rem",
            color: "#a82020",
            lineHeight: 1.6,
          }}
        >
          Rajiv Gandhi University of Knowledge Technologies
          <br />
          Guest House Reservation System
        </p>
      </div>
    </div>
  );
}

function RguktEmblem() {
  return (
    <img src={logo} alt="RGUKT emblem" width="46" height="46" style={{ flexShrink: 0 }} />
  );
}

    //   xmlns="http://www.w3.org/2000/svg"
    //   aria-label="RGUKT emblem"
    //   style={{ flexShrink: 0 }}
    // >
    //   <circle cx="23" cy="23" r="22" stroke="#244f77" strokeWidth="1.5" fill="white" />
    //   <circle cx="23" cy="23" r="18.5" stroke="#244f77" strokeWidth="0.6" fill="white" />
    //   {/* Torch flame */}
    //   <path
    //     d="M23 9.5 C21 12.5 19 14 20 16.5 C20.5 18 22 17.5 23 16 C24 17.5 25.5 18 26 16.5 C27 14 25 12.5 23 9.5Z"
    //     fill="#244f77"
    //   />
    //   {/* Torch handle */}
    //   <rect x="22" y="15.5" width="2" height="6.5" rx="0.5" fill="#244f77" />
    //   <rect x="20.5" y="21.5" width="5" height="1.5" rx="0.5" fill="#244f77" />
    //   {/* Open book */}
    //   <path
    //     d="M14 26 L14 32 Q18.5 30.5 23 32 Q27.5 30.5 32 32 L32 26 Q27.5 27.5 23 26 Q18.5 27.5 14 26Z"
    //     fill="none"
    //     stroke="#244f77"
    //     strokeWidth="1"
    //     strokeLinejoin="round"
    //   />
    //   <line x1="23" y1="26" x2="23" y2="32" stroke="#244f77" strokeWidth="0.75" />
    //   {/* Decorative dots */}
    //   <circle cx="17.5" cy="24.5" r="0.9" fill="#244f77" />
    //   <circle cx="28.5" cy="24.5" r="0.9" fill="#244f77" />
    // </svg>
    
