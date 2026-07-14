export default function EmptyState({
    title,
    description,
}) {
    return (
        <div
            className="card"
            style={{
                padding: "5rem",
                textAlign: "center",
            }}
        >
            <div
                style={{
                    fontSize: "4rem",
                    marginBottom: "1rem",
                }}
            >
                📊
            </div>

            <h2>{title}</h2>

            <p
                style={{
                    color: "var(--color-muted)",
                    maxWidth: 500,
                    margin: "auto",
                    lineHeight: 1.7,
                }}
            >
                {description}
            </p>
        </div>
    )
}