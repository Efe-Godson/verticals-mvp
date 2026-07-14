import {
    ResponsiveContainer,
    LineChart,
    Line,
    Tooltip,
    CartesianGrid,
    XAxis,
} from "recharts"

export default function RevenueTrend({
    data,
}) {
    return (
        <ResponsiveContainer
            width="100%"
            height={280}
        >
            <LineChart data={data}>
                <CartesianGrid
                    strokeDasharray="3 3"
                />

                <XAxis
                    dataKey="date"
                />

                <Tooltip />

                <Line
                    type="monotone"
                    dataKey="revenue"
                    strokeWidth={3}
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}