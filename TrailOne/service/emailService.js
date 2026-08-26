import { transporter } from "../config/mail.js";

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


export async function sendBookingConfirmation(details) {

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
<html>
<head>
    <meta charset="UTF-8">
    <title>Booking Confirmation</title>
</head>

<body style="
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
    font-family: Arial, Helvetica, sans-serif;
">

<div style="
    max-width: 700px;
    margin: 30px auto;
    background: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #dddddd;
">

    <div style="
        background: #1f2937;
        color: white;
        padding: 25px;
        text-align: center;
    ">
        <h1 style="margin: 0;">
            Booking Confirmed
        </h1>

        <p style="margin: 8px 0 0;">
            Thank you for booking with us
        </p>
    </div>


    <div style="padding: 30px;">

        <p>
            Dear <strong>${escapeHtml(customerName)}</strong>,
        </p>

        <p>
            Your hotel booking has been successfully confirmed.
        </p>


        <h2 style="
            border-bottom: 1px solid #dddddd;
            padding-bottom: 10px;
        ">
            Booking Details
        </h2>

        <table style="
            width: 100%;
            border-collapse: collapse;
        ">

            <tr>
                <td style="${labelStyle}">
                    Booking ID
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(bookingId)}
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Booking Reference
                </td>

                <td style="${valueStyle}">
                    <strong>${escapeHtml(bookingReference)}</strong>
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Status
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(status)}
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Check-in
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(formatDate(checkIn))}
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Check-out
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(formatDate(checkOut))}
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Rate
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(formatCurrency(pricePerRoomPerDay))} per room per night
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Total
                </td>

                <td style="${valueStyle}">
                    <strong>${escapeHtml(formatCurrency(totalAmount))}</strong> (${roomCount} room(s) × ${nights} night(s))
                </td>
            </tr>

        </table>


        <h2 style="
            margin-top: 30px;
            border-bottom: 1px solid #dddddd;
            padding-bottom: 10px;
        ">
            Guest Details
        </h2>

        <table style="
            width: 100%;
            border-collapse: collapse;
        ">

            <tr>
                <td style="${labelStyle}">
                    Name
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(customerName)}
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Email
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(customerEmail)}
                </td>
            </tr>

            <tr>
                <td style="${labelStyle}">
                    Phone
                </td>

                <td style="${valueStyle}">
                    ${escapeHtml(customerPhone)}
                </td>
            </tr>

        </table>


        <h2 style="
            margin-top: 30px;
            border-bottom: 1px solid #dddddd;
            padding-bottom: 10px;
        ">
            Room Details
        </h2>

        <table style="
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #dddddd;
        ">

            <thead>
                <tr>
                    <th style="${headerStyle}">
                        #
                    </th>

                    <th style="${headerStyle}">
                        Room Number
                    </th>

                    <th style="${headerStyle}">
                        Room ID
                    </th>

                    <th style="${headerStyle}">
                        Floor
                    </th>
                </tr>
            </thead>

            <tbody>

                ${
                    rooms.length
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

                            return `
                                <tr>
                                    <td style="${cellStyle}">
                                        ${index + 1}
                                    </td>

                                    <td style="${cellStyle}">
                                        ${escapeHtml(roomNo)}
                                    </td>

                                    <td style="${cellStyle}">
                                        ${escapeHtml(roomId)}
                                    </td>

                                    <td style="${cellStyle}">
                                        ${escapeHtml(floor)}
                                    </td>
                                </tr>
                            `;

                        }).join("")
                        : `
                            <tr>
                                <td colspan="4" style="${cellStyle}">
                                    Room details unavailable
                                </td>
                            </tr>
                        `
                }

            </tbody>

        </table>


        <p style="
            margin-top: 30px;
            color: #555555;
        ">
            Booking created on:
            <strong>${escapeHtml(formatDateTime(createdAt))}</strong>
        </p>

        <p style="
            margin-top: 30px;
            color: #555555;
        ">
            Please keep this email for your records.
        </p>

    </div>


    <div style="
        background: #f3f4f6;
        padding: 20px;
        text-align: center;
        color: #666666;
        font-size: 13px;
    ">
        Hotel Booking System
    </div>

</div>

</body>
</html>
`;


    const mailOptions = {
        from: `"Hotel Booking System" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject,
        text,
        html
    };


    const info = await transporter.sendMail(mailOptions);

    console.log(
        "Booking confirmation email sent:",
        info.messageId
    );

    return info;
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
