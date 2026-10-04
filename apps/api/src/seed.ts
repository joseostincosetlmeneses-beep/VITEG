import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "./db.js";
import { Customer, CustomerAddress, Product, User, Zone } from "./models/index.js";

await connectDatabase();
const passwordHash = await bcrypt.hash("Viteg2026!", 12);

const [admin, driver] = await Promise.all([
  User.findOneAndUpdate(
    { tenantId: "default", email: "admin@viteg.mx" },
    { $set: { firstName: "Ana", lastName: "Administradora", passwordHash, role: "ADMIN", status: "ACTIVE" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ),
  User.findOneAndUpdate(
    { tenantId: "default", email: "repartidor@viteg.mx" },
    { $set: { firstName: "Carlos", lastName: "Hernández", passwordHash, role: "DRIVER", status: "ACTIVE", employeeNumber: "REP-001" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
]);

const zone = await Zone.findOneAndUpdate(
  { tenantId: "default", name: "Centro" },
  { $set: { description: "Zona centro", color: "#0EA5E9", isActive: true } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

await Promise.all([
  Product.findOneAndUpdate(
    { tenantId: "default", code: "AGUA20" },
    { $set: { name: "Garrafón de agua 20 L", category: "AGUA", price: 45, unit: "pieza", logisticsPriority: 60, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ),
  Product.findOneAndUpdate(
    { tenantId: "default", code: "HIELO5" },
    { $set: { name: "Bolsa de hielo 5 kg", category: "HIELO", price: 38, unit: "bolsa", logisticsPriority: 100, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
]);

let customer = await Customer.findOne({ tenantId: "default", phone: "2460000000" });
if (!customer) {
  customer = await Customer.create({ tenantId: "default", type: "NEGOCIO", businessName: "Abarrotes Lupita", phone: "2460000000", status: "ACTIVE" });
  await CustomerAddress.create({
    tenantId: "default",
    customerId: customer._id,
    alias: "Sucursal Centro",
    street: "Av. Juárez",
    exteriorNumber: "23",
    neighborhood: "Centro",
    city: "Huamantla",
    state: "Tlaxcala",
    reference: "Junto a la farmacia",
    zoneId: zone._id,
    location: { latitude: 19.3139, longitude: -97.9248 },
    status: "ACTIVE"
  });
}

console.log("Datos demo creados", { admin: admin.email, driver: driver.email, password: "Viteg2026!" });
await disconnectDatabase();

