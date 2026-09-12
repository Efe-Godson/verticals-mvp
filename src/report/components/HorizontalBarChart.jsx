// Place at: src/report/components/HorizontalBarChart.jsx

import { useMemo, useState } from 'react'
import ChartTooltip, { useChartTooltip } from './ChartTooltip'
import useIsMobile from '../../hooks/useIsMobile'
import { compactNumber } from '../helpers/analysisUtils'
import PieChart from './PieChart'
import FocusModeModal from '../focus/FocusModeModal'
import FocusRankingControl from '../focus/FocusRankingControl'
import FocusResultsTable from '../focus/FocusResultsTable'
import AboutThisVisual from '../focus/AboutThisVisual'

// Category chart.
//  - Desktop: vertical columns for <=5 categories, a horizontal bar list past
//    that.
//  - Phone: vertical columns only for 2-3 (a narrow column can't hold a longer
//    label), otherwise the horizontal stacked list. For <=5 a "Bars / Donut"
//    switch also offers a doughnut view.
// A header toggle switches the value labels between the number (Auto / K / M /
// Full rounding) and a percentage share.

const VALUE_FORMATS = [['auto', 'Auto'], ['k', 'K'], ['m', 'M'], ['full', 'Full']]

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
    focusTitle,
    sourceLabel,
    unitLabel = 'items',
    getRecords,
    recordColumns,
    embedded = false,
    description,
}) {

    const all = data || []
    const shown = all.slice(0, maxBars)
    const maxValue = Math.max(...shown.map(d => d.count), 1)
    const isMobile = useIsMobile(768)

    // Focus Mode (redesign brief §5-16): the chart above only ever shows
    // `maxBars` rows, but `all` already holds the complete breakdown - see
    // Cartreport.jsx / CategoryCountChart.jsx, which pass the full sorted
    // array in, not a pre-limited one. Focus Mode just exposes what's
    // already there; it never re-queries.
    const [focusOpen, setFocusOpen] = useState(false)
    const [rankMode, setRankMode] = useState('top')
    const [rankN, setRankN] = useState(maxBars)
    const [drillRow, setDrillRow] = useState(null)

    const focusChartRows = useMemo(() => {
        const num = (d) => Number(d.count) || 0
        const sorted = [...all].sort((a, b) => rankMode === 'bottom' ? num(a) - num(b) : num(b) - num(a))
        return rankN ? sorted.slice(0, rankN) : sorted
    }, [all, rankMode, rankN])

    // Vertical columns need room for a label under each bar. Desktop can give
    // that up to 5 across; a phone only for 2-3 before the labels start
    // breaking mid-word ("WhatsApp" -> "Whats\nApp"), past which the
    // horizontal stacked list (full-width label per row) is used instead.
    const columnCap = isMobile ? 3 : 5
    const useColumns = shown.length > 0 && shown.length <= columnCap

    // For a small set on a phone, offer a doughnut as an alternative view.
    const canPickType = isMobile && shown.length > 1 && shown.length <= 5
    const [chartType, setChartType] = useState('bars') // 'bars' | 'donut'
    const asDonut = canPickType && chartType === 'donut'

    // Two denominators for the % labels:
    //   shownTotal - sum of the bars actually on screen (the top N)
    //   fullTotal  - sum of the whole breakdown, rows past the top N included
    // "%" is a share of what's shown; "% all" is a share of everything. They
    // only differ when the list is capped, so "% all" only appears then.
    const num = (d) => Number(d.count) || 0
    const shownTotal = shown.reduce((s, d) => s + num(d), 0)
    const fullTotal = all.reduce((s, d) => s + num(d), 0)
    const hasHidden = all.length > shown.length
    const canPercent = shownTotal > 0

    const [hovered, setHovered] = useState(null)
    const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip()

    // One strip of options for the value labels:
    //   'auto'/'k'/'m'/'full' - the number itself, rounded that way
    //   'pct'                 - share of the bars shown here (top N add to ~100%)
    //   'pctAll'              - share of the whole breakdown (only when the list
    //                           is capped and there are rows past the top N)
    // Phones default to 'auto' (a full "₦4,036,000" collides above a narrow
    // column); desktop defaults to the caller's full formatted number.
    const [valueMode, setValueMode] = useState(isMobile ? 'auto' : 'full')

    // Keep whatever the caller's formatter wraps a number in - a leading "₦"
    // or a trailing "%" - so the abbreviated form stays "₦4.0M" / "45%".
    const fmtSample = String(formatValue(1234))
    const valuePrefix = (fmtSample.match(/^[^\d\s.,-]+/) || [''])[0]
    const valueSuffix = (fmtSample.match(/[^\d\s.,-]+$/) || [''])[0]

    // Responsive label column: a share of the row (so it scales with the
    // container - focus mode, a paired half-tile, a phone) rather than a
    // fixed px width that truncated product names hard. Labels also wrap to
    // two lines instead of ellipsising at one.
    const labelWidth = isMobile ? "46%" : "clamp(120px, 32%, 300px)"
    const valueWidth = isMobile ? 58 : 84
    const barHeight = isMobile ? 24 : 20
    const gap = isMobile ? ".45rem" : ".7rem"
    const labelFont = isMobile ? ".78rem" : ".82rem"
    const valueFont = isMobile ? ".76rem" : ".8rem"

    function valueText(d) {
        if (valueMode === 'pct') {
            return `${shownTotal > 0 ? Math.round((num(d) / shownTotal) * 100) : 0}%`
        }
        if (valueMode === 'pctAll') {
            return `${fullTotal > 0 ? Math.round((num(d) / fullTotal) * 100) : 0}%`
        }
        if (valueMode === 'full') return formatValue(d.count)
        // 'auto' | 'k' | 'm' - abbreviated, keeping the caller's ₦ / % wrap.
        return valuePrefix + compactNumber(d.count, valueMode) + valueSuffix
    }

    const showValueToggle = shown.length > 0 && !asDonut

    const header = (title || canPickType || showValueToggle) && (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: bare ? ".5rem" : ".6rem",
                gap: ".5rem",
                flexWrap: "wrap",
            }}
        >
            {title ? (
                <div style={{ fontSize: ".85rem", color: "var(--color-muted)", minWidth: 0, flex: "1 1 auto" }}>
                    {title}
                </div>
            ) : <div />}

            <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", flexShrink: 0 }}>
                {canPickType && (
                    <div style={{ display: "flex", gap: "2px", background: "var(--color-bg)", borderRadius: "6px", padding: "2px" }}>
                        <button onClick={() => setChartType('bars')} style={toggleBtnStyle(chartType === 'bars')} title="Bar chart">Bars</button>
                        <button onClick={() => setChartType('donut')} style={toggleBtnStyle(chartType === 'donut')} title="Doughnut chart">Donut</button>
                    </div>
                )}

                {showValueToggle && (
                    <div style={{ display: "flex", gap: "2px", background: "var(--color-bg)", borderRadius: "6px", padding: "2px" }}>
                        {VALUE_FORMATS.map(([mode, label]) => (
                            <button
                                key={mode}
                                onClick={() => setValueMode(mode)}
                                style={toggleBtnStyle(valueMode === mode)}
                                title={`Show values as ${label === 'Full' ? 'the full number' : label}`}
                            >
                                {label}
                            </button>
                        ))}
                        {canPercent && (
                            <button
                                onClick={() => setValueMode('pct')}
                                style={{ ...toggleBtnStyle(valueMode === 'pct'), marginLeft: "3px" }}
                                title="Share of the bars shown here"
                            >
                                %
                            </button>
                        )}
                        {hasHidden && (
                            <button
                                onClick={() => setValueMode('pctAll')}
                                style={toggleBtnStyle(valueMode === 'pctAll')}
                                title={`Share of the whole breakdown, not just the top ${maxBars}`}
                            >
                                % all
                            </button>
                        )}
                    </div>
                )}

                {!embedded && shown.length > 0 && (
                    <button
                        type="button"
                        data-html2canvas-ignore="true"
                        onClick={() => setFocusOpen(true)}
                        title="Focus mode - explore the complete result"
                        style={{
                            border: "1px solid var(--color-border)", borderRadius: "6px",
                            padding: ".2rem .5rem", fontSize: ".78rem", lineHeight: 1,
                            background: "var(--color-surface)", color: "var(--color-muted)", cursor: "pointer",
                        }}
                    >
                        ⤢
                    </button>
                )}
            </div>
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

    } else if (asDonut) {

        content = <PieChart data={shown.map(d => ({ label: d.label, count: num(d) }))} />

    } else if (useColumns) {

        content = (

            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent:
                        shown.length <= 3 ? "center" : "space-between",
                    gap: isMobile ? "1rem" : "1.4rem",
                    height: isMobile ? "126px" : "220px",
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
                                    ? (isMobile ? "0 1 96px" : "0 1 90px")
                                    : "1 1 0",
                            minWidth: 0,
                            height: "100%",
                            justifyContent: "flex-end",
                        }}
                    >

                        <div
                            title={formatValue(d.count)}
                            style={{
                                fontSize: isMobile ? ".72rem" : valueFont,
                                color: "var(--color-text)",
                                marginBottom: ".4rem",
                                whiteSpace: "nowrap",
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontVariantNumeric: "tabular-nums",
                                fontWeight: hovered === d.label ? 700 : 400,
                            }}
                        >
                            {valueText(d)}
                        </div>

                        <div
                            style={{
                                width: "100%",
                                maxWidth: isMobile ? "48px" : "56px",
                                height: isMobile ? "74px" : "150px",
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
                                            (isMobile ? 74 : 150),
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
                                fontSize: isMobile ? ".72rem" : labelFont,
                                color: "var(--color-text)",
                                textAlign: "center",
                                lineHeight: 1.2,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflowWrap: "break-word",
                                width: "100%",
                            }}
                        >
                            {d.label}
                        </div>

                    </div>

                ))}

            </div>

        )

    } else if (isMobile) {

        // Phone: the desktop 3-column row (fixed label + bar + fixed value)
        // never fits a ~300px card without the value text spilling past the
        // edge. Stack each row instead - label + value share the top line
        // (label ellipsises, value can't be squeezed), full-width bar below.
        content = (
            <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", width: "100%" }}>
                {shown.map(d => (
                    <div key={d.label} style={{ display: "flex", flexDirection: "column", gap: ".25rem", minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: ".6rem" }}>
                            <span
                                title={d.label}
                                style={{
                                    minWidth: 0, flex: 1,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    fontSize: labelFont, color: "var(--color-text)",
                                }}
                            >
                                {d.label}
                            </span>
                            <span
                                style={{
                                    flexShrink: 0, fontSize: valueFont, fontWeight: 700,
                                    fontVariantNumeric: "tabular-nums", color: "var(--color-text)",
                                }}
                            >
                                {valueText(d)}
                            </span>
                        </div>
                        <div style={{ height: 6, background: "var(--color-primary-soft)", borderRadius: "6px", overflow: "hidden" }}>
                            <div
                                style={{
                                    width: `${Math.max((d.count / maxValue) * 100, 2)}%`,
                                    height: "100%", background: "var(--color-primary)", borderRadius: "6px",
                                }}
                            />
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
                                lineHeight: 1.25,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                wordBreak: "break-word",
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

    const focusModal = focusOpen && (
        <FocusModal
            title={focusTitle || title || 'Breakdown'}
            sourceLabel={sourceLabel}
            unitLabel={unitLabel}
            all={all}
            formatValue={formatValue}
            rankMode={rankMode}
            rankN={rankN}
            onRank={(m, n) => { setRankMode(m); setRankN(n) }}
            focusChartRows={focusChartRows}
            getRecords={getRecords}
            recordColumns={recordColumns}
            drillRow={drillRow}
            onDrill={setDrillRow}
            description={description}
            onClose={() => { setFocusOpen(false); setDrillRow(null) }}
        />
    )

    if (bare) {

        return (
            <>
                <div>
                    {header}
                    {content}
                    <ChartTooltip tooltip={tooltip} />
                </div>
                {focusModal}
            </>
        )

    }

    return (

        <>
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
            {focusModal}
        </>

    )

}

// Focus Mode for a bar/category breakdown (brief §5-16). Kept in this file
// since it exists only to expose data HorizontalBarChart already holds -
// see the `all` array above, which is never limited to `maxBars`.
function FocusModal({
    title, sourceLabel, unitLabel, all, formatValue,
    rankMode, rankN, onRank, focusChartRows,
    getRecords, recordColumns, drillRow, onDrill,
    description, onClose,
}) {
    const focusTotal = all.reduce((s, d) => s + (Number(d.count) || 0), 0)
    const rows = all.map(d => ({ key: d.label, label: d.label, value: Number(d.count) || 0 }))

    const columns = [
        { key: 'label', label: unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1), align: 'left', sortable: true },
        { key: 'value', label: 'Value', align: 'right', sortable: true, defaultDir: 'desc', format: r => formatValue(r.value) },
        {
            key: 'pct', label: '% of total', align: 'right', sortable: true, searchable: false,
            sortValue: r => r.value,
            format: r => `${focusTotal > 0 ? Math.round((r.value / focusTotal) * 100) : 0}%`,
        },
    ]

    const records = drillRow && getRecords ? getRecords(drillRow.label) || [] : null
    const derivedRecordColumns = records && records.length > 0
        ? (recordColumns || Object.keys(records[0]).map(k => ({
            key: k,
            label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
            align: typeof records[0][k] === 'number' ? 'right' : 'left',
            sortable: true,
        })))
        : []

    return (
        <FocusModeModal
            onClose={onClose}
            title={title}
            subtitle={sourceLabel ? `${sourceLabel} • ${all.length} ${unitLabel}` : `${all.length} ${unitLabel}`}
            breadcrumbLabel={drillRow ? drillRow.label : null}
            onBreadcrumbBack={() => onDrill(null)}
            controls={!drillRow && (
                <FocusRankingControl mode={rankMode} n={rankN} onChange={onRank} />
            )}
            chart={!drillRow && (
                <HorizontalBarChart data={focusChartRows} formatValue={formatValue} maxBars={focusChartRows.length} bare embedded />
            )}
            table={drillRow ? (
                records && records.length > 0 ? (
                    <FocusResultsTable
                        columns={derivedRecordColumns}
                        rows={records}
                        rowKey={(r, i) => r.id || i}
                        countLabel={`${records.length} record${records.length === 1 ? '' : 's'}`}
                        searchPlaceholder="Search records..."
                    />
                ) : (
                    <div style={{ padding: '1.5rem 0', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                        No underlying records found for this item.
                    </div>
                )
            ) : (
                <FocusResultsTable
                    columns={columns}
                    rows={rows}
                    countLabel={`All ${unitLabel} · ${rows.length}`}
                    searchPlaceholder={`Search ${unitLabel}...`}
                    defaultSort={{ key: 'value', dir: 'desc' }}
                    onRowClick={getRecords ? (row) => onDrill(row) : undefined}
                />
            )}
            footer={
                <AboutThisVisual
                    description={description || `${title} is calculated from the complete result behind this chart, sorted from highest to lowest.`}
                    meta={[
                        { label: 'Chart display', value: rankN ? `${rankMode === 'bottom' ? 'Bottom' : 'Top'} ${rankN}` : 'All' },
                        { label: 'Full result', value: `${rows.length} ${unitLabel}` },
                    ]}
                />
            }
        />
    )
}

export default HorizontalBarChart