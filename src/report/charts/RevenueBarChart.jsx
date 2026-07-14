import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    Tooltip,
    CartesianGrid,
} from "recharts"

export default function RevenueBarChart({
    data,
}) {
    return (
        <ResponsiveContainer
            width="100%"
            height={280}
        >
            <BarChart data={data}>
                <CartesianGrid
                    strokeDasharray="3 3"
                />

                <XAxis
                    dataKey="name"
                />

                <Tooltip />

                <Bar
                    dataKey="revenue"
                    radius={[8,8,0,0]}
                />
            </BarChart>
        </ResponsiveContainer>
    )
}