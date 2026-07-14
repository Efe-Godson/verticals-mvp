export default function LoadingSkeleton() {
    return (
        <div
            style={{
                display: "grid",
                gap: "1rem",
            }}
        >
            {[1,2,3,4].map(i=>(
                <div
                    key={i}
                    style={{
                        height:180,
                        borderRadius:16,
                        background:"#f4f4f4",
                        animation:"pulse 1.5s infinite",
                    }}
                />
            ))}

            <style>{`

            @keyframes pulse{

                0%{
                    opacity:.45;
                }

                50%{
                    opacity:1;
                }

                100%{
                    opacity:.45;
                }

            }

            `}</style>

        </div>
    )
}