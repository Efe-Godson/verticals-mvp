import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";

import Hero from "./report/Hero";
import KPIGrid from "./report/KPIGrid";
import PrimaryCharts from "./report/PrimaryCharts";
import InsightPanel from "./report/InsightPanel";
import LoadingSkeleton from "./report/LoadingSkeleton";
import EmptyState from "./report/EmptyState";
import SectionHeader from "./report/SectionHeader";

import RevenueBarChart from "./report/RevenueBarChart";
import RevenueTrend from "./report/RevenueTrend";

import calculateMetrics from "./report/helpers/calculateMetrics";
import buildRevenueChart from "./report/helpers/buildRevenueChart";
import buildQuantityChart from "./report/helpers/buildQuantityChart";
import buildTrendChart from "./report/helpers/buildTrendChart";
import buildInsights from "./report/helpers/buildInsights";

export default function NewReport() {

    const { id } = useParams();

    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState(null);

    const [submissions, setSubmissions] = useState([]);

    const [error, setError] = useState("");

    useEffect(() => {

        async function load() {

            setLoading(true);

            const { data: formData, error: formError } =
                await supabase
                    .from("forms")
                    .select("*")
                    .eq("id", id)
                    .single();

            if (formError) {

                setError(formError.message);

                setLoading(false);

                return;

            }

            const { data: records, error: recordsError } =
                await supabase
                    .from("submissions")
                    .select("*")
                    .eq("form_id", id)
                    .order("created_at");

            if (recordsError) {

                setError(recordsError.message);

                setLoading(false);

                return;

            }

            setForm(formData);

            setSubmissions(records || []);

            setLoading(false);

        }

        load();

    }, [id]);

    const metrics = useMemo(() => {

        if (!form) return [];

        return calculateMetrics(form, submissions);

    }, [form, submissions]);

    const revenueChart = useMemo(() => {

        if (!form) return [];

        return buildRevenueChart(form, submissions);

    }, [form, submissions]);

    const quantityChart = useMemo(() => {

        if (!form) return [];

        return buildQuantityChart(form, submissions);

    }, [form, submissions]);

    const trendChart = useMemo(() => {

        if (!form) return [];

        return buildTrendChart(form, submissions);

    }, [form, submissions]);

    const insights = useMemo(() => {

        if (!form) return [];

        return buildInsights(form, submissions);

    }, [form, submissions]);

    if (loading) {

        return (

            <div className="page">

                <LoadingSkeleton />

            </div>

        );

    }

    if (error) {

        return (

            <div className="page">

                <h2>{error}</h2>

            </div>

        );

    }

    if (!form) {

        return (

            <div className="page">

                Form not found.

            </div>

        );

    }

    if (!submissions.length) {

        return (

            <div className="page">

                <EmptyState

                    title="No records yet"

                    description="Once customers begin submitting your form, your business dashboard will automatically appear."

                />

            </div>

        );

    }

    const revenueMetric =

        metrics.find(

            m => m.label === "Revenue"

        );

    const ordersMetric =

        metrics.find(

            m => m.label === "Orders"

        );

    const quantityMetric =

        metrics.find(

            m => m.label === "Products Sold"

        );

    const averageMetric =

        metrics.find(

            m => m.label === "Average Order"

        );

    return (

        <div

            className="page"

            style={{

                maxWidth: 1500,

                paddingBottom: "5rem",

            }}

        >            <Hero

                revenue={
                    Number(
                        revenueMetric?.value
                            ?.replace("₦", "")
                            ?.replaceAll(",", "") || 0
                    )
                }

                orders={
                    Number(
                        ordersMetric?.value
                            ?.replaceAll(",", "") || 0
                    )
                }

                averageOrder={
                    Number(
                        averageMetric?.value
                            ?.replace("₦", "")
                            ?.replaceAll(",", "") || 0
                    )
                }

                productsSold={
                    Number(
                        quantityMetric?.value
                            ?.replaceAll(",", "") || 0
                    )
                }

            />

            <SectionHeader

                subtitle="Overview"

                title="Business Performance"

            />

            <KPIGrid

                metrics={metrics}

            />

            <SectionHeader

                subtitle="Analytics"

                title="Primary Charts"

            />

            <PrimaryCharts

                revenueChart={

                    <RevenueBarChart

                        data={revenueChart}

                    />

                }

                quantityChart={

                    <RevenueBarChart

                        data={

                            quantityChart.map(item => ({

                                name: item.name,

                                revenue: item.quantity,

                            }))

                        }

                    />

                }

                trendChart={

                    <RevenueTrend

                        data={trendChart}

                    />

                }

                categoryChart={

                    <div

                        style={{

                            display: "flex",

                            alignItems: "center",

                            justifyContent: "center",

                            height: "100%",

                            color: "#888",

                            fontSize: "1rem",

                        }}

                    >

                        Category analysis coming next…

                    </div>

                }

            />

            <SectionHeader

                subtitle="AI"

                title="Business Highlights"

            />

            <InsightPanel

                insights={insights}

            />

            <SectionHeader

                subtitle="Deep Dive"

                title="Performance Breakdown"

            />

            <div

                style={{

                    display: "grid",

                    gridTemplateColumns:

                        "repeat(auto-fit,minmax(380px,1fr))",

                    gap: "1.5rem",

                    marginBottom: "3rem",

                }}

            >

                <div

                    className="card"

                    style={{

                        padding: "2rem",

                    }}

                >

                    <h3

                        style={{

                            marginTop: 0,

                        }}

                    >

                        Revenue Distribution

                    </h3>

                    <p

                        style={{

                            color: "var(--color-muted)",

                            lineHeight: 1.8,

                        }}

                    >

                        This section will evolve into an automatic Pareto

                        analysis showing which products generate most of your

                        revenue.

                    </p>

                </div>

                <div

                    className="card"

                    style={{

                        padding: "2rem",

                    }}

                >

                    <h3

                        style={{

                            marginTop: 0,

                        }}

                    >

                        Opportunities

                    </h3>

                    <p

                        style={{

                            color: "var(--color-muted)",

                            lineHeight: 1.8,

                        }}

                    >

                        The analytics engine will soon recommend pricing,

                        inventory and promotional opportunities based on

                        customer behaviour.

                    </p>

                </div>

            </div>

            <SectionHeader

                subtitle="Records"

                title="Submission Summary"

            />

            <div

                className="card"

                style={{

                    padding: "2rem",

                    marginBottom: "4rem",

                }}

            >

                <div

                    style={{

                        display: "grid",

                        gridTemplateColumns:

                            "repeat(auto-fit,minmax(220px,1fr))",

                        gap: "2rem",

                    }}

                >

                    <div>

                        <div

                            style={{

                                color: "var(--color-muted)",

                                fontSize: ".85rem",

                            }}

                        >

                            Total Records

                        </div>

                        <div

                            style={{

                                fontSize: "2rem",

                                fontWeight: 700,

                            }}

                        >

                            {submissions.length.toLocaleString()}

                        </div>

                    </div>

                    <div>

                        <div

                            style={{

                                color: "var(--color-muted)",

                                fontSize: ".85rem",

                            }}

                        >

                            Form

                        </div>

                        <div

                            style={{

                                fontSize: "1.25rem",

                                fontWeight: 600,

                            }}

                        >

                            {form.name}

                        </div>

                    </div>

                    <div>

                        <div

                            style={{

                                color: "var(--color-muted)",

                                fontSize: ".85rem",

                            }}

                        >

                            Latest Submission

                        </div>

                        <div

                            style={{

                                fontSize: "1.1rem",

                                fontWeight: 600,

                            }}

                        >

                            {

                                new Date(

                                    submissions[submissions.length - 1]

                                        ?.created_at

                                ).toLocaleString()

                            }

                        </div>

                    </div>

                </div>

            </div></div>