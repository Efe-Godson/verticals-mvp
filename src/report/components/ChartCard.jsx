export default function ChartCard({
    title,
    subtitle,
    children,
    height = 360,
}) {
    return (
        <div
            className="card"
            style={{
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                minHeight: height,
            }}
        >
            <div>
                <div
                    style={{
                        fontSize: ".8rem",
                        color: "var(--color-muted)",
                        marginBottom: ".3rem",
                    }}
                >
                    {subtitle}
                </div>

                <h3
                    style={{
                        margin: 0,
                        fontSize: "1.2rem",
                        fontWeight: 700,
                    }}
                >
                    {title}
                </h3>
            </div>

            <div
                style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {children}
            </div>
        </div>
    )
}