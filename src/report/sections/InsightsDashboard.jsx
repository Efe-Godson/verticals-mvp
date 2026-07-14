import SectionHeader from "../components/SectionHeader";
import InsightPanel from "../components/InsightPanel";

export default function InsightsDashboard({

    insights,

}) {

    return (

        <>

            <SectionHeader

                subtitle="AI"

                title="Business Insights"

            />

            <InsightPanel

                insights={insights}

            />

        </>

    )

}