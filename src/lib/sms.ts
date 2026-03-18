// src/lib/sms.ts

// These should ideally be moved to .env in the future
const SMS_USER = "gayatri1";
const SMS_PASS = "8b898f7c2bXX";
const SMS_SENDER = "GVPRUS";
const SMS_TEMPLATE_ID = "1707173598509565396";

export async function sendAbsenteeSMS(mobile: string, rollNumber: string, name: string) {
    try {
        const message = `Dear Parent, Your ward Roll No: ${rollNumber} Name: ${name} is Absent for today's first hour. Regards, GAYATRI VIDYA PARISHAD COLLEGE`;

        const url = new URL('http://sms.platinumsms.co.in/sendsms.jsp');
        url.searchParams.append('user', SMS_USER);
        url.searchParams.append('password', SMS_PASS);
        url.searchParams.append('senderid', SMS_SENDER);
        url.searchParams.append('mobiles', mobile);
        url.searchParams.append('sms', message);
        url.searchParams.append('tempid', SMS_TEMPLATE_ID);

        const response = await fetch(url.toString(), {
            method: 'GET',
        });

        const data = await response.text();

        // PlatinumSMS typically returns a string containing the status.
        // E.g. "sent,000,success,..." or "error,..."
        const isSuccess = data.toLowerCase().includes('success') || data.toLowerCase().includes('sent');

        return {
            success: isSuccess,
            response: data.trim()
        };
    } catch (error: any) {
        console.error('Error sending SMS to ' + mobile + ':', error);
        return {
            success: false,
            response: error?.message || 'Unknown network error'
        };
    }
}
