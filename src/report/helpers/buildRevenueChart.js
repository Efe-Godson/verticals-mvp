export default function buildRevenueChart(form, submissions){

    const cartField = form.fields.find(

        f=>f.type==="cart"

    )

    if(!cartField) return []

    const revenue = {}

    submissions.forEach(sub=>{

        const cart=sub.data[cartField.id]

        if(!cart) return

        cart.items.forEach(item=>{

            revenue[item.name] ??=0

            revenue[item.name]+=

                item.price*item.quantity

        })

    })

    return Object.entries(revenue)

        .map(([name,revenue])=>({

            name,

            revenue,

        }))

        .sort((a,b)=>b.revenue-a.revenue)

}