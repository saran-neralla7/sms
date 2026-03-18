export function formatISTDate(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";

    // en-IN default format with these options is DD/MM/YYYY
    const formattedDate = d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

    // Replace slashes with hyphens to guarantee DD-MM-YYYY
    return formattedDate.replace(/\//g, "-");
}

export function formatISTDateTime(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";

    const formattedDate = d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    // Custom formatting to resemble something like: 01 Oct 2024, 10:30 am
    return formattedDate;
}
