"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface AttendanceGraphProps {
    data: {
        month: string;
        percentage: number;
        total: number;
        attended: number;
    }[];
}

export default function AttendanceGraph({ data }: AttendanceGraphProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-slate-500">No trend data available</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload;
            return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 font-bold text-slate-900">{label}</p>
                    <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                            <span className="text-slate-600">Percentage:</span>
                            <span className="font-bold text-blue-600">{point.percentage}%</span>
                        </p>
                        <p className="text-xs text-slate-500">
                            Attended: {point.attended} / {point.total} classes
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-lg font-bold text-slate-900">Attendance Trend</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                    >
                        <defs>
                            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                                {/* Top is 0% (100% Value). Bottom is 100% (0% Value) */}
                                {/* Zone 1: Green (75% to 100%) -> 0% to 25% height */}
                                <stop offset="0%" stopColor="#16a34a" />{/* green-600 */}
                                <stop offset="25%" stopColor="#16a34a" />

                                {/* Zone 2: Orange (65% to 74%) -> 25% to 35% height */}
                                <stop offset="25%" stopColor="#ea580c" />{/* orange-600 */}
                                <stop offset="35%" stopColor="#ea580c" />

                                {/* Zone 3: Red (< 65%) -> 35% to 100% height */}
                                <stop offset="35%" stopColor="#dc2626" />{/* red-600 */}
                                <stop offset="100%" stopColor="#dc2626" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 12 }}
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 65, 75, 100]} // Added 65, 75 for visual ref
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} />
                        <Line
                            type="monotone"
                            dataKey="percentage"
                            stroke="url(#attendanceGradient)"
                            strokeWidth={5}
                            dot={{ r: 6, strokeWidth: 3, fill: "#fff", stroke: "#64748b" }} // Thicker dots too
                            activeDot={{ r: 8 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
