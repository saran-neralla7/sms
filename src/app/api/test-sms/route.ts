import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Replace these with the actual credentials shown in the user's screenshot
const SMS_USER = "gayatri1";
const SMS_PASS = "8b898f7c2bXX"; // Make sure to use literal URL encoding if needed later, but this looks safe
const SMS_SENDER = "GVPRUS"; // As requested by user
const SMS_BASE_URL = "http://sms.platinumsms.co.in/sendsms.jsp";

// Optional variables observed in the HTTP example:
// accusage=1&unicode=1&scheduletime=yyyy-mm-dd hh:mm:ss&clientsmsid=2007&responsein=csv&shorturl=1
// We will only use basic ones first.

export async function POST(request: Request) {
    // Basic auth check
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD", "FACULTY"].includes(session.user?.role || "")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { testCases, templateId } = body;

        // testCases expected as: [{ mobile: "91...", rollNumber: "22...", name: "John" }]

        if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
            return NextResponse.json({ error: "Missing test cases" }, { status: 400 });
        }

        const results = [];

        // In a real bulk scenario, providers often allow comma separated mobiles.
        // However, since the message text is dynamic PER user ({#var#} Name/Roll),
        // we must send individual requests or use a provider-specific batch API.
        // For testing, we will just loop and send sequentially.

        for (const tc of testCases) {
            // Validate mobile
            const cleanMobile = tc.mobile.replace(/\D/g, "");

            // Format message
            const messageText = `Dear Parent, Your ward Roll No: ${tc.rollNumber} Name: ${tc.name} is Absent for today's first hour. Regards, GAYATRI VIDYA PARISHAD COLLEGE`;

            // Build URL
            const params = new URLSearchParams({
                user: SMS_USER,
                password: SMS_PASS,
                senderid: SMS_SENDER,
                mobiles: cleanMobile,
                sms: messageText,
            });

            // If the user specified the explicit template ID we saw in the image (1707173598509565396)
            if (templateId) {
                params.append('templateid', templateId);
            }

            const url = `${SMS_BASE_URL}?${params.toString()}`;

            let hitResult = null;
            let success = false;
            let responseText = "";

            try {
                // Send Request
                const apiRes = await fetch(url, { method: "GET" });
                responseText = await apiRes.text();

                // PlatinumSMS usually returns comma separated ID or "Error" string natively.
                if (apiRes.ok && !responseText.toLowerCase().includes("error") && !responseText.toLowerCase().includes("invalid")) {
                    success = true;
                }
            } catch (fetchErr: any) {
                responseText = fetchErr.message;
            }

            results.push({
                mobile: cleanMobile,
                rollNumber: tc.rollNumber,
                name: tc.name,
                urlSent: url, // Useful for debugging
                success,
                response: responseText
            });
        }

        return NextResponse.json({ results });
    } catch (error: any) {
        console.error("SMS Test Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
