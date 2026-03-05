import LogoSpinner from "@/components/LogoSpinner";

export default function Loading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <LogoSpinner fullScreen={false} />
        </div>
    );
}
