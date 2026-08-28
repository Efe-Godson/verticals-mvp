// Place at: src/report/components/HorizontalBarChart.jsx

import { useState } from 'react'
import ChartTooltip, { useChartTooltip } from './ChartTooltip'
import useIsMobile from '../../hooks/useIsMobile'

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
        background: active ? "var(--color-surface)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-muted)",
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
    const [hovered, setHovered] = useState(null)
    const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip()

    const isMobile = useIsMobile(768)

    // A fixed px label width either wastes space or truncates too hard
    // depending on how much room the row actually has (e.g. a focus-mode
    // page vs a normal one), and that available width isn't knowable here -
    // a percentage of the row claims more room wherever there's more to
    // give instead of needing hand-tuning per context.
    const labelWidth = isMobile ? "44%" : 110
    const valueWidth = isMobile ? 58 : 80
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
                        background: "var(--color-bg)",
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
                    color: "var(--color-muted)",
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
                        onMouseEnter={(e) => { setHovered(d.label); showTooltip(e, d.label, valueText(d)) }}
                        onMouseMove={moveTooltip}
                        onMouseLeave={() => { setHovered(null); hideTooltip() }}
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
                                color: "var(--color-text)",
                                marginBottom: ".4rem",
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
                                fontWeight: hovered === d.label ? 700 : 400,
                            }}
                        >
                            {valueText(d)}
                        </div>

                        <div
                            style={{
                                width: "100%",
                                maxWidth: isMobile ? "44px" : "56px",
                                height: isMobile ? "120px" : "150px",
                                background: "var(--color-primary-soft)",
                                borderRadius: "5px 5px 0 0",
                                display: "flex",
                                alignItems: "flex-end",
                                opacity: hovered === null || hovered === d.label ? 1 : 0.55,
                                transition: "opacity .12s ease",
                                cursor: "default",
                            }}
                        >
                            <div
                                style={{
                                    width: "100%",
                                    height: `${Math.max(
                                        (d.count / maxValue) *
                                            (isMobile ? 120 : 150),
                                        4
                                    )}px`,
                                    background: "var(--color-primary)",
                                    borderRadius: "5px 5px 0 0",
                                }}
                            />
                        </div>

                        <div
                            title={d.label}
                            style={{
                                marginTop: ".5rem",
                                fontSize: labelFont,
                                color: "var(--color-text)",
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
                        onMouseEnter={(e) => { setHovered(d.label); showTooltip(e, d.label, valueText(d)) }}
                        onMouseMove={moveTooltip}
                        onMouseLeave={() => { setHovered(null); hideTooltip() }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap,
                            width: "100%",
                            padding: "2px 0",
                            borderRadius: "4px",
                            background: hovered === d.label ? "var(--color-bg)" : "transparent",
                            transition: "background .12s ease",
                        }}
                    >

                        {/* Label */}

                        <div
                            title={d.label}
                            style={{
                                width: labelWidth,
                                flexShrink: 0,
                                fontSize: labelFont,
                                color: "var(--color-text)",
                                fontWeight: hovered === d.label ? 600 : 400,
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
                                background: "var(--color-primary-soft)",
                                borderRadius: "6px",
                                overflow: "hidden",
                                cursor: "default",
                            }}
                        >

                            <div
                                style={{
                                    width: `${Math.max(
                                        (d.count / maxValue) * 100,
                                        2
                                    )}%`,
                                    height: "100%",
                                    background: "var(--color-primary)",
                                    borderRadius: "6px",
                                    opacity: hovered === null || hovered === d.label ? 1 : 0.55,
                                    transition: "opacity .12s ease",
                                }}
                            />

                        </div>

                        {/* Value */}

                        <div
                            style={{
                                width: valueWidth,
                                flexShrink: 0,
                                fontSize: valueFont,
                                color: "var(--color-text)",
                                fontWeight: hovered === d.label ? 700 : 400,
                                textAlign: "right",
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
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
                <ChartTooltip tooltip={tooltip} />
            </div>
        )

    }

    return (

        <div
            style={{
                border: "1px solid var(--color-border)",
                borderRadius: "10px",
                padding: isMobile ? "1rem" : "1.3rem",
            }}
        >
            {header}
            {content}
            <ChartTooltip tooltip={tooltip} />
        </div>

    )

}

export default HorizontalBarChart