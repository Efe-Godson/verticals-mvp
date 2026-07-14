import MetricCard from "./MetricCard"

export default function KPIGrid({ metrics }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns:
                    "repeat(auto-fit,minmax(220px,1fr))",
                gap: "1rem",
                marginBottom: "3rem",
            }}
        >
            {metrics.map((metric) => (
                <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    change={metric.change}
                    icon={metric.icon}
                />
            ))}
        </div>
    )
}