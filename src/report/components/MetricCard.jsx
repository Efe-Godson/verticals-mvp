export default function MetricCard({
    label,
    value,
    change,
    icon,
}) {
    return (
        <div
            className="card"
            style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: ".75rem",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        color: "var(--color-muted)",
                        fontSize: ".85rem",
                    }}
                >
                    {label}
                </div>

                <div
                    style={{
                        fontSize: "1.3rem",
                    }}
                >
                    {icon}
                </div>
            </div>

            <div
                style={{
                    fontSize: "2rem",
                    fontWeight: 800,
                    letterSpacing: "-.03em",
                }}
            >
                {value}
            </div>

            {change && (
                <div
                    style={{
                        fontSize: ".85rem",
                        color: "#22c55e",
                        fontWeight: 600,
                    }}
                >
                    ▲ {change}
                </div>
            )}
        </div>
    )
}