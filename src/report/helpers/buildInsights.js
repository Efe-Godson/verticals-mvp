export default function buildInsights(form, submissions){

    const insights=[]

    const cartField=form.fields.find(

        f=>f.type==="cart"

    )

    if(!cartField){

        return insights

    }

    let revenue=0

    let orders=0

    const products={}

    submissions.forEach(sub=>{

        const cart=sub.data[cartField.id]

        if(!cart) return

        revenue+=cart.total

        orders++

        cart.items.forEach(item=>{

            products[item.name] ??=0

            products[item.name]+=

                item.price*item.quantity

        })

    })

    const topProduct=

        Object.entries(products)

        .sort((a,b)=>b[1]-a[1])[0]

    insights.push({

        icon:"💰",

        color:"#22c55e",

        title:"Revenue",

        description:

        `Revenue reached ₦${revenue.toLocaleString()}.`

    })

    if(topProduct){

        insights.push({

            icon:"⭐",

            color:"#0070f3",

            title:"Top Product",

            description:

            `${topProduct[0]} generated ₦${topProduct[1].toLocaleString()}.`

        })

    }

    if(orders){

        insights.push({

            icon:"🧾",

            color:"#f59e0b",

            title:"Average Order",

            description:

            `Average order value is ₦${

                Math.round(revenue/orders)

                .toLocaleString()

            }.`

        })

    }

    return insights

}