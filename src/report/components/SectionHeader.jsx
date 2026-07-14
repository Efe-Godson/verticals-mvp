export default function SectionHeader({
    title,
    subtitle,
    right,
}) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: "1.25rem",
                gap: "1rem",
                flexWrap: "wrap",
            }}
        >
            <div>
                <div
                    style={{
                        fontSize: ".75rem",
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "var(--color-muted)",
                        marginBottom: ".35rem",
                        fontWeight: 700,
                    }}
                >
                    {subtitle}
                </div>

                <h2
                    style={{
                        margin: 0,
                        fontSize: "1.65rem",
                        fontWeight: 700,
                    }}
                >
                    {title}
                </h2>
            </div>

            {right}
        </div>
    )
}