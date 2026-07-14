function Insight({

    icon,

    title,

    description,

    color,

}) {

    return (

        <div

            style={{

                display: "flex",

                gap: "1rem",

                padding: "1rem",

                borderRadius: "12px",

                background: "#fafafa",

            }}

        >

            <div

                style={{

                    fontSize: "1.6rem",

                    color,

                }}

            >

                {icon}

            </div>

            <div>

                <div

                    style={{

                        fontWeight: 700,

                        marginBottom: ".35rem",

                    }}

                >

                    {title}

                </div>

                <div

                    style={{

                        color: "var(--color-muted)",

                        lineHeight: 1.6,

                    }}

                >

                    {description}

                </div>

            </div>

        </div>

    )

}

export default function InsightPanel({

    insights = [],

}) {

    return (

        <div

            className="card"

            style={{

                padding: "2rem",

                marginBottom: "3rem",

            }}

        >

            <h2

                style={{

                    marginTop: 0,

                    marginBottom: "2rem",

                }}

            >

                Business Highlights

            </h2>

            <div

                style={{

                    display: "grid",

                    gap: "1rem",

                }}

            >

                {insights.map((item, index) => (

                    <Insight

                        key={index}

                        {...item}

                    />

                ))}

            </div>

        </div>

    )

}