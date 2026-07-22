// Place at: src/report/components/HorizontalBarChart.jsx

import { useEffect, useState } from 'react'

// Category chart. Renders as vertical columns when there are 5 or fewer
// categories (easier to compare at a glance), and falls back to the
// horizontal bar list for longer breakdowns (better for many/long labels).
// When data includes `percent`, a small toggle lets the user switch each
// card between showing the raw value or the percentage share.

function toggleBtnStyle(active) {
    return {
        border: "none",
        borderRadius: "5px",
        padding: ".2rem .55rem",
        fontSize: ".72rem",
        fontWeight: 600,
        cursor: "pointer",
        background: active ? "#fff" : "transparent",
        color: active ? "#000" : "var(--color-muted)",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
    }
}

function HorizontalBarChart({
    title,
    data,
    bare = false,
    formatValue = (v) => v.toLocaleString(),
    maxBars = 10,
}) {

    const shown = (data || []).slice(0, maxBars)
    const maxValue = Math.max(...shown.map(d => d.count), 1)
    const useColumns = shown.length > 0 && shown.length <= 5
    const hasPercent = shown.some(d => d.percent !== undefined)

    const [showPercent, setShowPercent] = useState(false)

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        const resize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [])

    const labelWidth = isMobile ? 85 : 110
    const valueWidth = isMobile ? 60 : 80
    const barHeight = isMobile ? 24 : 20
    const gap = isMobile ? ".45rem" : ".7rem"
    const labelFont = isMobile ? ".78rem" : ".82rem"
    const valueFont = isMobile ? ".76rem" : ".8rem"

    function valueText(d) {
        if (showPercent && d.percent !== undefined) return `${d.percent}%`
        return formatValue(d.count)
    }

    const header = (title || hasPercent) && (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: bare ? ".5rem" : ".6rem",
                gap: ".6rem",
            }}
        >
            {title ? (
                <div style={{ fontSize: ".85rem", color: "var(--color-muted)" }}>
                    {title}
                </div>
            ) : <div />}

            {hasPercent && (
                <div
                    style={{
                        display: "flex",
                        gap: "2px",
                        background: "#f2f2f2",
                        borderRadius: "6px",
                        padding: "2px",
                        flexShrink: 0,
                    }}
                >
                    <button onClick={() => setShowPercent(false)} style={toggleBtnStyle(!showPercent)}>
                        Value
                    </button>
                    <button onClick={() => setShowPercent(true)} style={toggleBtnStyle(showPercent)}>
                        %
                    </button>
                </div>
            )}
        </div>
    )

    let content

    if (shown.length === 0) {

        content = (
            <p
                style={{
                    color: "#999",
                    fontSize: ".85rem",
                    margin: 0,
                }}
            >
                No data yet.
            </p>
        )

    } else if (useColumns) {

        content = (

            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent:
                        shown.length <= 3 ? "center" : "space-between",
                    gap: isMobile ? ".8rem" : "1.4rem",
                    height: isMobile ? "180px" : "220px",
                    padding: "0 .5rem",
                }}
            >

                {shown.map(d => (

                    <div
                        key={d.label}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            flex:
                                shown.length <= 3
                                    ? "0 1 90px"
                                    : "1 1 0",
                            minWidth: 0,
                            height: "100%",
                            justifyContent: "flex-end",
                        }}
                    >

                        <div
                            style={{
                                fontSize: valueFont,
                                color: "#000",
                                marginBottom: ".4rem",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {valueText(d)}
                        </div>

                        <div
                            style={{
                                width: "100%",
                                maxWidth: isMobile ? "44px" : "56px",
                                height: `${Math.max(
                                    (d.count / maxValue) *
                                        (isMobile ? 120 : 150),
                                    4
                                )}px`,
                                background:
                                    "var(--color-primary, #0070f3)",
                                borderRadius: "5px 5px 0 0",
                            }}
                        />

                        <div
                            title={d.label}
                            style={{
                                marginTop: ".5rem",
                                fontSize: labelFont,
                                color: "#000",
                                textAlign: "center",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                            }}
                        >
                            {d.label}
                        </div>

                    </div>

                ))}

            </div>

        )

    } else {

        content = (

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".6rem",
                    width: "100%",
                }}
            >

                {shown.map(d => (

                    <div
                        key={d.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap,
                            width: "100%",
                        }}
                    >

                        {/* Label */}

                        <div
                            title={d.label}
                            style={{
                                width: labelWidth,
                                flexShrink: 0,
                                fontSize: labelFont,
                                color: "#000",
                                textAlign: "right",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {d.label}
                        </div>

                        {/* Bar */}

                        <div
                            style={{
                                flex: 1,
                                height: barHeight,
                                background: "#f2f2f2",
                                borderRadius: "6px",
                                overflow: "hidden",
                            }}
                        >

                            <div
                                style={{
                                    width: `${Math.max(
                                        (d.count / maxValue) * 100,
                                        2
                                    )}%`,
                                    height: "100%",
                                    background:
                                        "var(--color-primary, #0070f3)",
                                    borderRadius: "6px",
                                }}
                            />

                        </div>

                        {/* Value */}

                        <div
                            style={{
                                width: valueWidth,
                                flexShrink: 0,
                                fontSize: valueFont,
                                color: "#000",
                                textAlign: "right",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {valueText(d)}
                        </div>

                    </div>

                ))}

            </div>

        )

    }

    if (bare) {

        return (
            <div>
                {header}
                {content}
            </div>
        )

    }

    return (

        <div
            style={{
                border: "1px solid #eee",
                borderRadius: "10px",
                padding: isMobile ? "1rem" : "1.3rem",
            }}
        >
            {header}
            {content}
        </div>

    )

}

export default HorizontalBarChart