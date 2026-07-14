import Hero from "../components/Hero";
import KPIGrid from "../components/KPIGrid";

export default function ExecutiveSummary({

    revenue,

    orders,

    averageOrder,

    productsSold,

    metrics,

}) {

    return (

        <>

            <Hero

                revenue={revenue}

                orders={orders}

                averageOrder={averageOrder}

                productsSold={productsSold}

            />

            <KPIGrid

                metrics={metrics}

            />

        </>

    )

}