// src/lib/sms.ts

const SMS_USER = process.env.SMS_USER || "";
const SMS_PASS = process.env.SMS_PASS || "";
const SMS_SENDER = process.env.SMS_SENDER || "GVPRUS";
const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || "";

export async function sendAbsenteeSMS(mobile: string, rollNumber: string, name: string) {
    try {
        const message = `Dear Parent, Your ward Roll No: ${rollNumber} Name: ${name} is Absent for today's first hour. Regards, GAYATRI VIDYA PARISHAD COLLEGE`;

        const url = new URL('https://sms.platinumsms.co.in/sendsms.jsp');
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

export const SMS_MARKS_TEMPLATE_ID = process.env.SMS_MARKS_TEMPLATE_ID || "";

export async function sendMarksSMS(
    mobile: string,
    studentName: string,
    rollNumber: string,
    year: string,
    semester: string,
    subjects: { name: string; marks: string | number }[],
    examType: string
) {
    try {
        // Pad the subjects array to exactly 5 elements
        const paddedSubjects = [...subjects];
        while (paddedSubjects.length < 5) {
            paddedSubjects.push({ name: "N/A", marks: "-" });
        }

        // Convert numeric year, semester, and examType to Roman numerals
        const toRoman = (num: string | number): string => {
            const map: Record<string, string> = {
                "1": "I",
                "2": "II",
                "3": "III",
                "4": "IV",
                "I": "I",
                "II": "II",
                "III": "III",
                "IV": "IV"
            };
            return map[String(num)] || String(num);
        };

        const yearRoman = toRoman(year);
        const semRoman = toRoman(semester);
        const midRoman = examType === "MID_II" ? "II" : "I";

        // Construct DLT-compliant message text with exact newlines matching the screenshot
        const message = `Dear Parent,
Your ward ${studentName},
${yearRoman} Year ${semRoman} sem ${midRoman} Mid
Examination marks are as
follows:
subject 1:${paddedSubjects[0].name} Marks:
${paddedSubjects[0].marks}
subject 2:${paddedSubjects[1].name}
Marks: ${paddedSubjects[1].marks}
subject 3:${paddedSubjects[2].name} Marks:
${paddedSubjects[2].marks}
subject 4:${paddedSubjects[3].name} Marks:
${paddedSubjects[3].marks}
subject 5:${paddedSubjects[4].name} Marks: ${paddedSubjects[4].marks}
Please Contact HOD for any
queries.
Gayatri Vidya Parishad`;

        const url = new URL('https://sms.platinumsms.co.in/sendsms.jsp');
        url.searchParams.append('user', SMS_USER);
        url.searchParams.append('password', SMS_PASS);
        url.searchParams.append('senderid', SMS_SENDER);
        url.searchParams.append('mobiles', mobile);
        url.searchParams.append('sms', message);
        url.searchParams.append('tempid', SMS_MARKS_TEMPLATE_ID);

        const response = await fetch(url.toString(), {
            method: 'GET',
        });

        const data = await response.text();
        const isSuccess = data.toLowerCase().includes('success') || data.toLowerCase().includes('sent');

        return {
            success: isSuccess,
            response: data.trim()
        };
    } catch (error: any) {
        console.error('Error sending Marks SMS to ' + mobile + ':', error);
        return {
            success: false,
            response: error?.message || 'Unknown network error'
        };
    }
}
