export default function buildTrendChart(form, submissions){

    const cartField=form.fields.find(

        f=>f.type==="cart"

    )

    if(!cartField) return []

    const days={}

    submissions.forEach(sub=>{

        const cart=sub.data[cartField.id]

        if(!cart) return

        const day=new Date(

            sub.created_at

        ).toLocaleDateString("en-GB")

        days[day] ??=0

        days[day]+=cart.total

    })

    return Object.entries(days).map(

        ([date,revenue])=>({

            date,

            revenue,

        })

    )

}