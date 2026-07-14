export default function buildQuantityChart(form, submissions){

    const cartField=form.fields.find(

        f=>f.type==="cart"

    )

    if(!cartField) return []

    const quantity={}

    submissions.forEach(sub=>{

        const cart=sub.data[cartField.id]

        if(!cart) return

        cart.items.forEach(item=>{

            quantity[item.name] ??=0

            quantity[item.name]+=item.quantity

        })

    })

    return Object.entries(quantity)

        .map(([name,quantity])=>({

            name,

            quantity,

        }))

        .sort((a,b)=>b.quantity-a.quantity)

}