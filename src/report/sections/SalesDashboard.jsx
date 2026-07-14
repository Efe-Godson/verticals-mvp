import SectionHeader from "../components/SectionHeader";
import ChartCard from "../components/ChartCard";

import RevenueBarChart from "../charts/RevenueBarChart";
import RevenueTrend from "../charts/RevenueTrend";

export default function SalesDashboard({

    revenueChart,

    quantityChart,

    trendChart,

    categoryChart,

}) {

    return (

        <>

            <SectionHeader

                subtitle="Sales"

                title="Sales Dashboard"

            />

            <div

                style={{

                    display:"grid",

                    gridTemplateColumns:

                        "repeat(auto-fit,minmax(420px,1fr))",

                    gap:"1.5rem",

                    marginBottom:"3rem",

                }}

            >

                <ChartCard

                    title="Revenue by Product"

                    subtitle="Where your money comes from"

                >

                    <RevenueBarChart

                        data={revenueChart}

                    />

                </ChartCard>

                <ChartCard

                    title="Products Sold"

                    subtitle="Quantity purchased"

                >

                    <RevenueBarChart

                        data={

                            quantityChart.map(item=>({

                                name:item.name,

                                revenue:item.quantity,

                            }))

                        }

                    />

                </ChartCard>

                <ChartCard

                    title="Revenue Trend"

                    subtitle="Performance over time"

                >

                    <RevenueTrend

                        data={trendChart}

                    />

                </ChartCard>

                <ChartCard

                    title="Category Performance"

                    subtitle="Coming Soon"

                >

                    {categoryChart}

                </ChartCard>

            </div>

        </>

    )

}