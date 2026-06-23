import { prisma } from "./prisma";

/**
 * Get or create the leave quota record for a faculty in a given calendar year.
 */
export async function getOrCreateFacultyLeaveQuota(facultyId: string, calendarYear: string) {
  let quota = await prisma.facultyLeaveQuota.findUnique({
    where: {
      facultyId_calendarYear: {
        facultyId,
        calendarYear,
      },
    },
  });

  if (!quota) {
    quota = await prisma.facultyLeaveQuota.create({
      data: {
        facultyId,
        calendarYear,
        clQuota: 8,
        clConsumed: 0,
        odConsumed: 0,
        alConsumed: 0,
        mlConsumed: 0,
      },
    });
  }

  return quota;
}

/**
 * Re-evaluate and reconcile consumed leave balances for a faculty member
 * in a given calendar year by querying approved LeaveRequests.
 */
export async function recalculateLeaveBalances(facultyId: string, calendarYear: string) {
  const startOfYear = new Date(`${calendarYear}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${calendarYear}-12-31T23:59:59.999Z`);

  // Fetch all approved requests in the calendar year
  const approvedRequests = await prisma.leaveRequest.findMany({
    where: {
      facultyId,
      status: "APPROVED",
      startDate: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
  });

  let clConsumed = 0;
  let odConsumed = 0;
  let alConsumed = 0;
  let mlConsumed = 0;

  for (const req of approvedRequests) {
    if (req.leaveType === "CL") clConsumed += req.numberOfDays;
    else if (req.leaveType === "OD") odConsumed += req.numberOfDays;
    else if (req.leaveType === "AL") alConsumed += req.numberOfDays;
    else if (req.leaveType === "ML") mlConsumed += req.numberOfDays;
  }

  // Ensure quota record exists
  await getOrCreateFacultyLeaveQuota(facultyId, calendarYear);

  // Update consumed columns
  const updatedQuota = await prisma.facultyLeaveQuota.update({
    where: {
      facultyId_calendarYear: {
        facultyId,
        calendarYear,
      },
    },
    data: {
      clConsumed,
      odConsumed,
      alConsumed,
      mlConsumed,
    },
  });

  return updatedQuota;
}
