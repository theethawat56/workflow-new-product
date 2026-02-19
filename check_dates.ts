import { findAll } from "./src/lib/db/adapter";
import { SheetName } from "./src/lib/db/schema";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function check() {
    const products = await findAll<any>("products" as SheetName);
    console.log("Found products:", products.length);
    products.forEach(p => {
        console.log(`${p.product_name}: GoLive=${p.go_live_date}, LaunchMonth=${p.launch_month}, Status=${p.status}`);
    });
}
check();
