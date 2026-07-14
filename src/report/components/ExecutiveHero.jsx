import MetricCard from "./MetricCard"

export default function Hero({
    revenue,
    orders,
    averageOrder,
    productsSold,
}) {
    return (
        <div
            style={{
                marginBottom: "3rem",
            }}
        >
            <div
                className="card"
                style={{
                    padding: "2.5rem",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        color: "var(--color-muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        fontSize: ".8rem",
                        marginBottom: ".5rem",
                    }}
                >
                    Executive Summary
                </div>

                <div
                    style={{
                        fontSize: "3.5rem",
                        fontWeight: 900,
                        letterSpacing: "-.05em",
                    }}
                >
                    ₦{Number(revenue || 0).toLocaleString()}
                </div>

                <div
                    style={{
                        marginTop: ".5rem",
                        color: "var(--color-muted)",
                        fontSize: "1rem",
                    }}
                >
                    Total Revenue
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit,minmax(220px,1fr))",
                    gap: "1rem",
                    marginTop: "1.5rem",
                }}
            >
                <MetricCard
                    label="Orders"
                    value={orders}
                    icon="🧾"
                />

                <MetricCard
                    label="Average Order"
                    value={`₦${Number(
                        averageOrder || 0
                    ).toLocaleString()}`}
                    icon="💳"
                />

                <MetricCard
                    label="Products Sold"
                    value={productsSold}
                    icon="📦"
                />
            </div>
        </div>
    )
}