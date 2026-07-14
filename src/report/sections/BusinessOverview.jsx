import SectionHeader from "../components/SectionHeader";

export default function BusinessOverview({

    form,

    submissions,

}) {

    return (

        <>

            <SectionHeader

                subtitle="Overview"

                title="Submission Summary"

            />

            <div

                className="card"

                style={{

                    padding:"2rem",

                }}

            >

                <div

                    style={{

                        display:"grid",

                        gridTemplateColumns:

                            "repeat(auto-fit,minmax(220px,1fr))",

                        gap:"2rem",

                    }}

                >

                    <div>

                        <small>Total Records</small>

                        <h2>

                            {

                                submissions.length

                                    .toLocaleString()

                            }

                        </h2>

                    </div>

                    <div>

                        <small>Form</small>

                        <h2>

                            {form.name}

                        </h2>

                    </div>

                    <div>

                        <small>Latest Submission</small>

                        <h2>

                            {

                                new Date(

                                    submissions.at(-1)?.created_at

                                ).toLocaleString()

                            }

                        </h2>

                    </div>

                </div>

            </div>

        </>

    )

}