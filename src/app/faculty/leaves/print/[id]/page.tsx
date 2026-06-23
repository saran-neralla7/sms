import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateFacultyLeaveQuota } from "@/lib/leaves";
import { formatISTDate } from "@/lib/dateUtils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PrintLeavePage({ params }: Props) {
  const { id } = await params;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      faculty: {
        include: {
          department: true,
        },
      },
      substitute: true,
    },
  });

  if (!leaveRequest) {
    notFound();
  }

  const { faculty, substitute, leaveType, startDate, endDate, numberOfDays, reason, status, hodApprovedAt, directorApprovedAt, hodRemarks, directorRemarks } = leaveRequest;
  const calendarYear = new Date(startDate).getFullYear().toString();

  // Fetch or create quota for the specific calendar year of the request
  const quota = await getOrCreateFacultyLeaveQuota(faculty.id, calendarYear);
  const clRemainingBeforeThis = quota.clQuota - (quota.clConsumed - (status === "APPROVED" && leaveType === "CL" ? numberOfDays : 0));

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-6 sm:p-12 print:p-0">
      {/* Print Controls Bar - Hidden on print */}
      <div className="mb-6 flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-4 print:hidden">
        <div className="text-sm font-medium text-slate-600">
          Print Preview — {leaveType} Leave Application
        </div>
        <button
          id="print-btn"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
        >
          Print Now
        </button>
      </div>

      {leaveType === "OD" ? (
        /* ==================== ON DUTY SLIP LAYOUT ==================== */
        <div className="mx-auto max-w-2xl border-2 border-dashed border-slate-400 p-8 bg-white my-8 rounded-lg shadow-sm print:my-0 print:border-none print:shadow-none print:p-4">
          <div className="relative flex items-center justify-center border-b-2 border-slate-800 pb-4 mb-6">
            <div className="absolute left-0 top-0">
              <img
                src="/gvp-logo.jpg"
                alt="GVP Logo"
                className="h-16 w-16"
              />
            </div>
            <div className="text-center pl-16">
              <h2 className="text-md font-bold uppercase tracking-wide text-slate-950">
                GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE & P.G. COURSES (A)
              </h2>
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 mt-1">
                ON DUTY LEAVE SLIP
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wide">REQUISITION FORM</p>
            </div>
          </div>

          <div className="flex justify-between text-sm font-semibold text-slate-800 mb-6">
            <span>Emp Code: {faculty.empCode}</span>
            <span>Date: {formatISTDate(leaveRequest.createdAt)}</span>
          </div>

          <p className="text-sm leading-relaxed text-slate-900 mb-6">
            I, Mr./Ms. <span className="font-bold underline">{faculty.empName}</span>, working as{" "}
            <span className="font-bold underline">{faculty.designation}</span> in the Department of{" "}
            <span className="font-bold underline">{faculty.department?.name}</span>, will be on Placement / University
            / official / other duty on (details): <span className="font-bold underline">{reason}</span>.
          </p>

          <p className="text-sm leading-relaxed text-slate-900 mb-8">
            I request you to sanction On Duty leave of <span className="font-bold underline">{numberOfDays}</span> days,
            i.e. from <span className="font-bold underline">{formatISTDate(startDate)}</span> to{" "}
            <span className="font-bold underline">{formatISTDate(endDate)}</span>.
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm mb-12 border-t border-slate-100 pt-6">
            <div>
              <p className="font-semibold text-slate-600">Contact Number:</p>
              <p className="font-bold text-slate-900">{faculty.mobile || "-"}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-600">Signature of Faculty:</p>
              <p className="mt-4 font-mono text-xs text-slate-300 italic">________________________</p>
            </div>
          </div>

          {/* Signature Grid */}
          <div className="grid grid-cols-2 gap-6 border-t border-slate-300 pt-6">
            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/50 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">HOD</p>
              <div className="h-10 flex items-center justify-center">
                {hodApprovedAt ? (
                  <div className="text-xs text-slate-800">
                    <p className="text-emerald-700 font-bold">✓ Recommended</p>
                    <p className="text-[10px] text-slate-500">Date: {formatISTDate(hodApprovedAt)}</p>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-slate-300 italic">________________________</p>
                )}
              </div>
            </div>

            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/50 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Director</p>
              <div className="h-10 flex items-center justify-center">
                {directorApprovedAt ? (
                  <div className="text-xs text-slate-800">
                    <p className="text-emerald-700 font-bold">✓ Approved</p>
                    <p className="text-[10px] text-slate-500">Date: {formatISTDate(directorApprovedAt)}</p>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-slate-300 italic">________________________</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== CASUAL LEAVE / OTHER FORM LAYOUT ==================== */
        <div className="mx-auto max-w-3xl border-2 border-slate-300 p-8 sm:p-12 bg-white rounded-lg shadow-sm print:border-none print:shadow-none print:p-4 print:my-0">
          
          {/* GVP College Standard Header */}
          <div className="relative flex items-center justify-center border-b border-black pb-4 mb-6">
            <div className="absolute left-0 top-0">
              <img
                src="/gvp-logo.jpg"
                alt="GVP Logo"
                className="h-16 w-16"
              />
            </div>
            <div className="text-center pl-16">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Engineering & Technology Program
              </h3>
              <h1 className="text-md font-extrabold uppercase tracking-wide text-slate-900 leading-tight">
                GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND P.G. COURSES (A)
              </h1>
              <p className="text-[11px] font-medium text-slate-700">
                RUSHIKONDA, VISAKHAPATNAM - 530 045
              </p>
            </div>
          </div>

          {/* Form Title & Date */}
          <div className="flex justify-between items-center mb-6">
            <div className="w-1/4"></div>
            <h2 className="text-center text-md font-extrabold uppercase tracking-wider text-slate-950 underline underline-offset-4 decoration-black">
              LEAVE REQUISITION FORM
            </h2>
            <div className="w-1/4 text-right text-xs font-semibold text-slate-800">
              Date: <span className="underline">{formatISTDate(leaveRequest.createdAt)}</span>
            </div>
          </div>

          {/* Form Info Fields */}
          <div className="space-y-2.5 text-sm leading-relaxed mb-6">
            <div className="flex items-center">
              <span className="w-48 font-semibold text-slate-700">Name of the employee</span>
              <span className="mr-3 font-bold">:</span>
              <span className="font-bold underline text-slate-950 uppercase">{faculty.empName}</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-semibold text-slate-700">Designation</span>
              <span className="mr-3 font-bold">:</span>
              <span className="underline text-slate-900">{faculty.designation}</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-semibold text-slate-700">Department</span>
              <span className="mr-3 font-bold">:</span>
              <span className="underline text-slate-900">{faculty.department?.name}</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-semibold text-slate-700">Date of Leave</span>
              <span className="mr-3 font-bold">:</span>
              <span className="underline font-bold text-slate-950">
                {startDate === endDate 
                  ? formatISTDate(startDate) 
                  : `${formatISTDate(startDate)} to ${formatISTDate(endDate)}`
                }
              </span>
              <span className="ml-2 text-slate-600">({numberOfDays} day{numberOfDays > 1 ? "s" : ""})</span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-semibold text-slate-700">Nature of Leave</span>
              <span className="mr-3 font-bold">:</span>
              <span className="space-x-3 text-slate-800">
                <span className={leaveType === "CL" ? "font-extrabold underline decoration-2 decoration-black" : "text-slate-400"}>Casual</span>
                <span className="text-slate-400">/</span>
                <span className={leaveType === "ML" ? "font-extrabold underline decoration-2 decoration-black" : "text-slate-400"}>Medical</span>
                <span className="text-slate-400">/</span>
                <span className={leaveType !== "CL" && leaveType !== "ML" ? "font-extrabold underline decoration-2 decoration-black" : "text-slate-400"}>Academic</span>
              </span>
            </div>
            <div className="flex items-center">
              <span className="w-48 font-semibold text-slate-700">Leave Purpose</span>
              <span className="mr-3 font-bold">:</span>
              <span className="underline text-slate-900">{reason}</span>
            </div>
            <div className="flex items-center pt-2">
              <span className="w-48 font-bold text-slate-950">Work adjustment</span>
              <span className="mr-3 font-bold">:</span>
            </div>
          </div>

          {/* Work Adjustment Table - 8 rows */}
          <table className="w-full border-collapse border border-black text-center text-xs mb-6">
            <thead>
              <tr className="border-b border-black bg-slate-50 font-bold text-slate-950">
                <th className="border-r border-black px-2 py-2 w-[18%]">Date of Leave</th>
                <th className="border-r border-black px-2 py-2 w-[15%]">Year/ Semester</th>
                <th className="border-r border-black px-2 py-2 w-[15%]">Period Timings</th>
                <th className="border-r border-black px-2 py-2 w-[18%]">Substitute Subject</th>
                <th className="border-r border-black px-2 py-2 w-[20%]">Substitute Name</th>
                <th className="px-2 py-2 w-[14%]">Substitute Signature</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-black h-8 text-slate-900">
                  <td className="border-r border-black px-2 py-1">
                    {idx === 0 ? formatISTDate(startDate) : ""}
                  </td>
                  <td className="border-r border-black px-2 py-1"></td>
                  <td className="border-r border-black px-2 py-1"></td>
                  <td className="border-r border-black px-2 py-1"></td>
                  <td className="border-r border-black px-2 py-1 text-left font-semibold">
                    {idx === 0 && substitute ? substitute.empName : ""}
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] text-slate-400 italic">
                    {idx === 0 && substitute ? "Pending physical sign" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signature of the employee */}
          <div className="flex justify-end mb-8">
            <div className="text-center">
              <div className="h-10 flex items-end justify-center font-mono text-slate-300">
                ___________________________
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1">Signature of the employee</p>
            </div>
          </div>

          {/* Details of leaves (Quota Ledger) */}
          {leaveType === "CL" && (
            <div className="mb-10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">Details of leaves:</h4>
              <table className="w-72 border-collapse border border-black text-center text-xs">
                <thead>
                  <tr className="border-b border-black bg-slate-50 font-bold text-slate-900">
                    <th className="border-r border-black px-4 py-2">Available</th>
                    <th className="border-r border-black px-4 py-2">Required</th>
                    <th className="px-4 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-bold text-slate-950 h-8">
                    <td className="border-r border-black px-4 py-1">{clRemainingBeforeThis}</td>
                    <td className="border-r border-black px-4 py-1 text-blue-600">{numberOfDays}</td>
                    <td className="px-4 py-1 text-emerald-700">
                      {clRemainingBeforeThis - numberOfDays}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Signatures: HOD & Director */}
          <div className="flex justify-between items-center mt-12 pt-6 border-t border-slate-200">
            <div className="text-center w-48">
              <div className="h-12 flex flex-col justify-center items-center">
                {hodApprovedAt ? (
                  <div className="text-xs text-emerald-700 font-bold">
                    <span>✓ Recommended</span>
                    <br />
                    <span className="text-[10px] text-slate-500 font-medium">{formatISTDate(hodApprovedAt)}</span>
                  </div>
                ) : (
                  <div className="font-mono text-slate-300 text-xs">____________________</div>
                )}
              </div>
              <p className="text-xs font-bold text-slate-850 uppercase tracking-wider mt-2">HOD</p>
            </div>

            <div className="text-center w-48">
              <div className="h-12 flex flex-col justify-center items-center">
                {directorApprovedAt ? (
                  <div className="text-xs text-emerald-700 font-bold">
                    <span>✓ Sanctioned</span>
                    <br />
                    <span className="text-[10px] text-slate-500 font-medium">{formatISTDate(directorApprovedAt)}</span>
                  </div>
                ) : (
                  <div className="font-mono text-slate-300 text-xs">____________________</div>
                )}
              </div>
              <p className="text-xs font-bold text-slate-850 uppercase tracking-wider mt-2">Director</p>
            </div>
          </div>

        </div>
      )}

      {/* Script block to trigger window print automatically, and set up print listener */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Listen for click on print button
            document.getElementById("print-btn")?.addEventListener("click", () => {
              window.print();
            });
          `,
        }}
      />
    </div>
  );
}


