export default function calculateMetrics(form, submissions) {

    const metrics = []

    const cartField = form.fields.find(f => f.type === "cart")

    if (cartField) {

        let revenue = 0

        let orders = 0

        let quantity = 0

        submissions.forEach(sub => {

            const cart = sub.data[cartField.id]

            if (!cart) return

            revenue += Number(cart.total || 0)

            orders++

            cart.items.forEach(item => {

                quantity += Number(item.quantity)

            })

        })

        metrics.push({

            label: "Revenue",

            value: `₦${revenue.toLocaleString()}`,

            icon: "💰"

        })

        metrics.push({

            label: "Orders",

            value: orders.toLocaleString(),

            icon: "🧾"

        })

        metrics.push({

            label: "Products Sold",

            value: quantity.toLocaleString(),

            icon: "📦"

        })

        metrics.push({

            label: "Average Order",

            value: orders
                ? `₦${Math.round(revenue/orders).toLocaleString()}`
                : "₦0",

            icon: "💳"

        })

    }

    else{

        metrics.push({

            label:"Responses",

            value:submissions.length,

            icon:"📝"

        })

    }

    return metrics

}