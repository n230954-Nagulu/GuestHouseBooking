import { transporter } from "../config/mail.js";

async function sendToRecipient(type, email, mailOptions) {
    try {
        const info = await transporter.sendMail({ ...mailOptions, to: email });
        console.info(`Booking email accepted by SMTP (${type}).`, info.messageId);
        return { recipientType: type, status: "SMTP_ACCEPTED", messageId: info.messageId };
    } catch (error) {
        console.error(`Booking email failed (${type}):`, error.message);
        return { recipientType: type, status: "FAILED", error: error.message };
    }
}

export async function sendAccessCode(email, code) {

    const mailOptions = {
        from: `"Hotel Booking System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Hotel Booking Verification Code",
        text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.messageId);

    return info;
}

export async function sendBookingConfirmationEmails(details, facultyInChargeEmail = details?.FacultyInChargeEmail) {
    if (!details) {
        throw new Error("Booking details are required to send post-payment emails.");
    }

    const bookingId = details.BookingId || details.bookingId || "N/A";
    const bookingReference = details.BookingReference || details.bookingReference || `BOOKING-${bookingId}`;
    const isDemoBooking = details.PaymentMethod === "DEMO";
    const occupantName = details.FullName || details.fullName || details.OccupantName || "Guest";
    const occupantEmail = details.Email || details.email || details.OccupantEmail;
    const initiatorName = details.BookingInitiatorName || details.InitiatorName || occupantName;
    const initiatorEmail = details.BookingInitiatorEmail || details.InitiatorEmail || occupantEmail;
    const facultyInChargeName = details.FacultyInChargeName || details.facultyInChargeName || "Faculty In-Charge";
    const securityEmail = details.SecurityEmail || process.env.SECURITY_EMAIL || "security@rguktn.ac.in";
    const roomSummary = Array.isArray(details.rooms) ? details.rooms.map((room) => room.RoomNo || room.roomNo || "N/A").join(", ") : "N/A";
    const paymentAmount = Number(details.totalAmount || details.TotalAmount || 0);
    const paymentStatus = details.PaymentStatus || "SUCCESS";
    const checkIn = details.InDate || details.inDate || "N/A";
    const checkOut = details.OutDate || details.outDate || "N/A";
    const roomLabel = details.RoomName || roomSummary || "Guest Room";

    const recipients = [
        { email: occupantEmail, name: occupantName, type: "occupant" },
        { email: facultyInChargeEmail, name: facultyInChargeName, type: "faculty-in-charge" },
        { email: securityEmail, name: "Security In-Charge", type: "security" },
        { email: initiatorEmail, name: initiatorName, type: "booking-initiator" },
    ].filter((entry) => entry.email && /^\S+@\S+\.\S+$/.test(entry.email));

    if (!facultyInChargeEmail || !/^\S+@\S+\.\S+$/.test(facultyInChargeEmail)) {
        throw new Error("A valid faculty in-charge email is required to send booking notifications.");
    }

    const uniqueRecipients = [];
    const seen = new Set();
    for (const recipient of recipients) {
        const key = recipient.email.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueRecipients.push(recipient);
        }
    }

    const results = [];

    for (const recipient of uniqueRecipients) {
        const subjectPrefix = isDemoBooking ? "[DEMO] " : "";
        const subject = recipient.type === "occupant"
            ? `${subjectPrefix}Booking Confirmation - ${bookingReference}`
            : recipient.type === "faculty-in-charge"
                ? `${subjectPrefix}Guest House Booking Notification - ${bookingReference}`
                : recipient.type === "security"
                    ? `${subjectPrefix}Security Check-in Notification - ${bookingReference}`
                    : `${subjectPrefix}Booking Confirmation for Initiator - ${bookingReference}`;

        const text = [
            `Booking confirmation for ${recipient.name}`,
            `Booking ID: ${bookingId}`,
            `Reference: ${bookingReference}`,
            `Occupant Name: ${occupantName}`,
            `Booking Initiator: ${initiatorName}`,
            `Faculty In-Charge: ${facultyInChargeName}`,
            `Room: ${roomLabel}`,
            `Check-in: ${formatDate(checkIn)}`,
            `Check-out: ${formatDate(checkOut)}`,
            `Payment Status: ${paymentStatus}`,
            ...(isDemoBooking ? ["Demo Booking — Payment not processed through Razorpay."] : []),
            `Amount: ${formatCurrency(paymentAmount)}`,
        ].join("\n");

        const result = await sendToRecipient(recipient.type, recipient.email, {
            from: `"Hotel Booking System" <${process.env.EMAIL_USER}>`,
            subject,
            text,
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isDemoBooking ? "[DEMO] " : ""}Booking Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#f2f5f8;color:#243447;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f2f5f8;">
        <tr><td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4eaf0;border-radius:14px;overflow:hidden;">
                <tr>
                    <td style="padding:30px 32px;background:#173b5e;color:#fff;">
                        <p style="margin:0 0 10px;color:#d9c28f;font-size:12px;letter-spacing:2px;text-transform:uppercase;">RGUKT Guest House</p>
                        <h1 style="margin:0;font-size:25px;line-height:1.3;">${isDemoBooking ? "Demo booking confirmed" : "Booking confirmed"}</h1>
                        <p style="margin:10px 0 0;color:#e4edf5;font-size:14px;line-height:1.6;">${isDemoBooking ? "This booking is for demonstration purposes; payment was not processed through Razorpay." : "Your stay has been confirmed. We look forward to welcoming you."}</p>
                    </td>
                </tr>
                <tr><td style="padding:26px 32px 12px;">
                    <p style="margin:0 0 18px;font-size:15px;">Dear <strong>${escapeHtml(recipient.name)}</strong>,</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f8fb;border:1px solid #e4eaf0;border-radius:10px;">
                        <tr>
                            <td style="padding:15px 18px;">
                                <p style="margin:0 0 5px;color:#60758a;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Booking reference</p>
                                <p style="margin:0;color:#173b5e;font-size:20px;font-weight:700;">${escapeHtml(bookingReference)}</p>
                            </td>
                            <td align="right" style="padding:15px 18px;">
                                <span style="display:inline-block;padding:7px 11px;border-radius:20px;background:${isDemoBooking ? "#fff3d8" : "#e6f4ec"};color:${isDemoBooking ? "#875d00" : "#237447"};font-size:12px;font-weight:700;">${isDemoBooking ? "DEMO" : escapeHtml(paymentStatus)}</span>
                            </td>
                        </tr>
                    </table>
                </td></tr>
                <tr><td style="padding:14px 32px 4px;">
                    <h2 style="margin:0 0 12px;color:#173b5e;font-size:16px;">Stay details</h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        <tr><td style="padding:11px;border:1px solid #e7edf2;background:#f8fafc;color:#60758a;font-size:13px;">Check-in</td><td style="padding:11px;border:1px solid #e7edf2;font-size:14px;font-weight:600;">${escapeHtml(formatDate(checkIn))}</td></tr>
                        <tr><td style="padding:11px;border:1px solid #e7edf2;background:#f8fafc;color:#60758a;font-size:13px;">Check-out</td><td style="padding:11px;border:1px solid #e7edf2;font-size:14px;font-weight:600;">${escapeHtml(formatDate(checkOut))}</td></tr>
                        <tr><td style="padding:11px;border:1px solid #e7edf2;background:#f8fafc;color:#60758a;font-size:13px;">Room(s)</td><td style="padding:11px;border:1px solid #e7edf2;font-size:14px;">${escapeHtml(roomLabel)}</td></tr>
                    </table>
                </td></tr>
                <tr><td style="padding:18px 32px 4px;">
                    <h2 style="margin:0 0 10px;color:#173b5e;font-size:16px;">Guest and booking contacts</h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        <tr><td style="padding:7px 0;color:#60758a;font-size:13px;width:38%;">Occupant</td><td style="padding:7px 0;font-size:14px;">${escapeHtml(occupantName)}</td></tr>
                        <tr><td style="padding:7px 0;color:#60758a;font-size:13px;">Booking initiator</td><td style="padding:7px 0;font-size:14px;">${escapeHtml(initiatorName)}</td></tr>
                        <tr><td style="padding:7px 0;color:#60758a;font-size:13px;">Faculty in-charge</td><td style="padding:7px 0;font-size:14px;">${escapeHtml(facultyInChargeName)}</td></tr>
                    </table>
                </td></tr>
                <tr><td style="padding:18px 32px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#173b5e;border-radius:10px;">
                        <tr>
                            <td style="padding:15px 18px;color:#fff;">
                                <p style="margin:0 0 5px;color:#d9e5ef;font-size:12px;">Payment status: ${escapeHtml(paymentStatus)}</p>
                                <p style="margin:0;font-size:13px;">${isDemoBooking ? "No payment was processed" : "Booking total"}</p>
                            </td>
                            <td align="right" style="padding:15px 18px;color:#fff;font-size:20px;font-weight:700;">${escapeHtml(formatCurrency(paymentAmount))}</td>
                        </tr>
                    </table>
                    <p style="margin:16px 0 0;color:#718096;font-size:12px;">Booking ID: ${escapeHtml(bookingId)}</p>
                </td></tr>
                <tr><td align="center" style="padding:17px 24px;background:#f5f8fb;border-top:1px solid #e4eaf0;color:#718096;font-size:12px;line-height:1.6;">RGUKT Guest House · Nuzvid<br>Please keep this email for your records.</td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>
`,
        });
        results.push(result);
    }

    return results;
}


export async function sendBookingConfirmation(details, facultyInChargeEmail = details?.FacultyInChargeEmail) {

    if (!details) {
        throw new Error("Booking details are required to send confirmation email.");
    }

    const customerName =
        details.FullName ||
        details.fullName ||
        details.CustomerName ||
        "Guest";

    const customerEmail =
        details.Email ||
        details.email;

    const customerPhone =
        details.Phone ||
        details.phone ||
        "Not provided";

    const facultyInChargeName =
        details.FacultyInChargeName ||
        details.facultyInChargeName ||
        "Faculty In-Charge";

    const bookingId =
        details.BookingId ||
        details.bookingId;

    const bookingReference =
        details.BookingReference ||
        details.bookingReference ||
        details.RequestReference ||
        `BOOKING-${bookingId}`;

    const checkIn =
        details.InDate ||
        details.inDate ||
        details.CheckInDate ||
        details.checkInDate;

    const checkOut =
        details.OutDate ||
        details.outDate ||
        details.CheckOutDate ||
        details.checkOutDate;

    const status =
        details.BookingStatus ||
        details.bookingStatus ||
        details.RequestStatus ||
        "CONFIRMED";

    const pricePerRoomPerDay = Number(details.pricePerRoomPerDay || 300);
    const roomCount = Number(details.roomCount || 0);
    const nights = Number(details.nights || 0);
    const totalAmount = Number(details.totalAmount || 0);
    const formatCurrency = (amount) => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(amount);

    const createdAt =
        details.CreatedAt ||
        details.createdAt ||
        new Date();

    if (!customerEmail) {
        throw new Error("Customer email is missing from booking details.");
    }

    if (!facultyInChargeEmail || !/^\S+@\S+\.\S+$/.test(facultyInChargeEmail)) {
        throw new Error("A valid faculty in-charge email is required to send the booking confirmation.");
    }

    /*
     * bookingDetails() may return rooms in different forms depending
     * on your repository implementation.
     */

    let rooms = [];

    if (Array.isArray(details.rooms)) {
        rooms = details.rooms;
    } else if (Array.isArray(details.Rooms)) {
        rooms = details.Rooms;
    } else if (details.RoomId || details.RoomNo) {
        rooms = [details];
    }

    const roomLines = rooms.length
        ? rooms.map((room, index) => {
            const roomId =
                room.RoomId ||
                room.roomId ||
                "N/A";

            const roomNo =
                room.RoomNo ||
                room.roomNo ||
                "N/A";

            const floor =
                room.Floor ||
                room.floor ||
                "N/A";

            return `${index + 1}. Room ${roomNo} | Room ID: ${roomId} | Floor: ${floor}`;
        }).join("\n")
        : "Room details unavailable";


    const subject =
        `Booking Confirmed - ${bookingReference}`;


    const text = `
HOTEL BOOKING CONFIRMATION
========================================

Dear ${customerName},

Your hotel booking has been successfully confirmed.

BOOKING DETAILS
----------------------------------------
Booking ID       : ${bookingId}
Booking Reference: ${bookingReference}
Status           : ${status}

CHECK-IN / CHECK-OUT
----------------------------------------
Check-in         : ${formatDate(checkIn)}
Check-out        : ${formatDate(checkOut)}

PRICE SUMMARY
----------------------------------------
Rate             : ${formatCurrency(pricePerRoomPerDay)} per room per night
Rooms            : ${roomCount}
Nights           : ${nights}
Total            : ${formatCurrency(totalAmount)}

GUEST DETAILS
----------------------------------------
Name             : ${customerName}
Email            : ${customerEmail}
Phone            : ${customerPhone}
Faculty In-Charge: ${facultyInChargeName}

ROOM DETAILS
----------------------------------------
${roomLines}

BOOKING CREATED
----------------------------------------
${formatDateTime(createdAt)}

Thank you for choosing our Hotel Booking System.

Please keep this email for your records.

Regards,
Hotel Booking System
`.trim();


    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f5f8;font-family:Arial,Helvetica,sans-serif;color:#243447;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f2f5f8;padding:32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4eaf0;">
                    <tr>
                        <td style="padding:30px 32px;background:#173b5e;color:#ffffff;">
                            <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d9c28f;">RGUKT Guest House</p>
                            <h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:700;">Booking confirmed</h1>
                            <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#e4edf5;">Your stay is booked. We look forward to welcoming you.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px 10px;">
                            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">Dear <strong>${escapeHtml(customerName)}</strong>,</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f8fb;border:1px solid #e4eaf0;border-radius:10px;">
                                <tr>
                                    <td style="padding:16px 18px;">
                                        <p style="margin:0 0 5px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#60758a;">Booking reference</p>
                                        <p style="margin:0;font-size:20px;font-weight:700;color:#173b5e;">${escapeHtml(bookingReference)}</p>
                                    </td>
                                    <td align="right" style="padding:16px 18px;">
                                        <span style="display:inline-block;padding:7px 11px;border-radius:20px;background:#e6f4ec;color:#237447;font-size:12px;font-weight:700;">${escapeHtml(status)}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 32px 4px;">
                            <h2 style="margin:0 0 12px;font-size:16px;color:#173b5e;">Stay details</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                                <tr>
                                    <td style="padding:12px;border:1px solid #e7edf2;background:#f8fafc;color:#60758a;font-size:13px;">Check-in</td>
                                    <td style="padding:12px;border:1px solid #e7edf2;font-size:14px;font-weight:600;">${escapeHtml(formatDate(checkIn))}</td>
                                </tr>
                                <tr>
                                    <td style="padding:12px;border:1px solid #e7edf2;background:#f8fafc;color:#60758a;font-size:13px;">Check-out</td>
                                    <td style="padding:12px;border:1px solid #e7edf2;font-size:14px;font-weight:600;">${escapeHtml(formatDate(checkOut))}</td>
                                </tr>
                                <tr>
                                    <td style="padding:12px;border:1px solid #e7edf2;background:#f8fafc;color:#60758a;font-size:13px;">Rooms and nights</td>
                                    <td style="padding:12px;border:1px solid #e7edf2;font-size:14px;">${roomCount} room(s) · ${nights} night(s)</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 4px;">
                            <h2 style="margin:0 0 12px;font-size:16px;color:#173b5e;">Guest details</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                                <tr><td style="padding:8px 0;color:#60758a;font-size:13px;width:38%;">Name</td><td style="padding:8px 0;font-size:14px;">${escapeHtml(customerName)}</td></tr>
                                <tr><td style="padding:8px 0;color:#60758a;font-size:13px;">Email</td><td style="padding:8px 0;font-size:14px;word-break:break-word;">${escapeHtml(customerEmail)}</td></tr>
                                <tr><td style="padding:8px 0;color:#60758a;font-size:13px;">Phone</td><td style="padding:8px 0;font-size:14px;">${escapeHtml(customerPhone)}</td></tr>
                                <tr><td style="padding:8px 0;color:#60758a;font-size:13px;">Faculty in-charge</td><td style="padding:8px 0;font-size:14px;">${escapeHtml(facultyInChargeName)}</td></tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 32px 4px;">
                            <h2 style="margin:0 0 12px;font-size:16px;color:#173b5e;">Room allocation</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                                <thead>
                                    <tr>
                                        <th align="left" style="padding:10px;border:1px solid #e7edf2;background:#f5f8fb;color:#60758a;font-size:12px;">Room</th>
                                        <th align="left" style="padding:10px;border:1px solid #e7edf2;background:#f5f8fb;color:#60758a;font-size:12px;">Room ID</th>
                                        <th align="left" style="padding:10px;border:1px solid #e7edf2;background:#f5f8fb;color:#60758a;font-size:12px;">Floor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${
                                        rooms.length
                                            ? rooms.map((room) => `
                                                <tr>
                                                    <td style="padding:10px;border:1px solid #e7edf2;font-size:13px;">${escapeHtml(room.RoomNo || room.roomNo || "N/A")}</td>
                                                    <td style="padding:10px;border:1px solid #e7edf2;font-size:13px;">${escapeHtml(room.RoomId || room.roomId || "N/A")}</td>
                                                    <td style="padding:10px;border:1px solid #e7edf2;font-size:13px;">${escapeHtml(room.Floor || room.floor || "N/A")}</td>
                                                </tr>
                                            `).join("")
                                            : `<tr><td colspan="3" style="padding:12px;border:1px solid #e7edf2;color:#60758a;font-size:13px;">Room details unavailable</td></tr>`
                                    }
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 28px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#173b5e;border-radius:10px;">
                                <tr>
                                    <td style="padding:16px 18px;color:#ffffff;">
                                        <p style="margin:0 0 5px;font-size:12px;color:#d9e5ef;">Rate: ${escapeHtml(formatCurrency(pricePerRoomPerDay))} per room per night</p>
                                        <p style="margin:0;font-size:13px;color:#ffffff;">Total booking amount</p>
                                    </td>
                                    <td align="right" style="padding:16px 18px;color:#ffffff;font-size:21px;font-weight:700;">${escapeHtml(formatCurrency(totalAmount))}</td>
                                </tr>
                            </table>
                            <p style="margin:18px 0 0;color:#718096;font-size:12px;line-height:1.6;">Booking ID: ${escapeHtml(bookingId)}<br>Created: ${escapeHtml(formatDateTime(createdAt))}</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:18px 24px;background:#f5f8fb;border-top:1px solid #e4eaf0;color:#718096;font-size:12px;line-height:1.6;">
                            RGUKT Guest House · Nuzvid<br>
                            Please keep this email for your booking records.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;


    const mailOptions = {
        from: `"Hotel Booking System" <${process.env.EMAIL_USER}>`,
        subject,
        text,
        html
    };

    const recipients = [{ type: "guest", email: customerEmail }];
    if (facultyInChargeEmail.toLowerCase() !== customerEmail.toLowerCase()) {
        recipients.push({ type: "faculty-in-charge", email: facultyInChargeEmail });
    }

    return Promise.all(recipients.map(({ type, email }) => sendToRecipient(type, email, mailOptions)));
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(amount || 0));
}


/* ---------------- Helper Functions ---------------- */

function formatDate(value) {

    if (!value) {
        return "N/A";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function formatDateTime(value) {

    if (!value) {
        return "N/A";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


const labelStyle = `
    padding: 10px;
    border-bottom: 1px solid #eeeeee;
    color: #666666;
    width: 40%;
`;

const valueStyle = `
    padding: 10px;
    border-bottom: 1px solid #eeeeee;
`;

const headerStyle = `
    padding: 10px;
    border: 1px solid #dddddd;
    background: #f3f4f6;
    text-align: left;
`;

const cellStyle = `
    padding: 10px;
    border: 1px solid #dddddd;
`;
