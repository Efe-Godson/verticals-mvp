import calculateMetrics from "./calculateMetrics";
import buildRevenueChart from "./buildRevenueChart";
import buildQuantityChart from "./buildQuantityChart";
import buildTrendChart from "./buildTrendChart";
import buildInsights from "./buildInsights";

export default function buildDashboard(form, submissions) {

    const metrics = calculateMetrics(form, submissions);

    const revenueChart = buildRevenueChart(form, submissions);

    const quantityChart = buildQuantityChart(form, submissions);

    const trendChart = buildTrendChart(form, submissions);

    const insights = buildInsights(form, submissions);

    const revenue =
        Number(
            metrics.find(m => m.label === "Revenue")
                ?.value
                ?.replace("₦", "")
                ?.replaceAll(",", "")
        ) || 0;

    const orders =
        Number(
            metrics.find(m => m.label === "Orders")
                ?.value
                ?.replaceAll(",", "")
        ) || 0;

    const averageOrder =
        Number(
            metrics.find(m => m.label === "Average Order")
                ?.value
                ?.replace("₦", "")
                ?.replaceAll(",", "")
        ) || 0;

    const productsSold =
        Number(
            metrics.find(m => m.label === "Products Sold")
                ?.value
                ?.replaceAll(",", "")
        ) || 0;

    return {

        summary: {

            revenue,

            orders,

            averageOrder,

            productsSold,

        },

        metrics,

        charts: {

            revenue: revenueChart,

            quantity: quantityChart,

            trend: trendChart,

            category: [],

        },

        insights,

    };

}