from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os, uuid, csv, io, jwt, bcrypt, time
from pymongo import ReturnDocument

ROOT_DIR = Path(__file__).parent
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
app = FastAPI()
api_router = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"
ADMIN_PASSWORD_HASH = bcrypt.hashpw(os.environ["ADMIN_PASSWORD"].encode("utf-8"), bcrypt.gensalt())
failed_logins = {}

def now_iso(): return datetime.now(timezone.utc).isoformat()
def token_for(username: str):
    return jwt.encode({"sub": username, "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)

async def current_admin(request: Request):
    token = request.cookies.get("access_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token: raise HTTPException(401, "Silakan login terlebih dahulu")
    try: return jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError: raise HTTPException(401, "Sesi login sudah berakhir")

def verify_pin(pin: Optional[str]):
    expected = os.environ.get("TRANSACTIONS_PIN", "0707")
    if not pin or str(pin) != str(expected):
        raise HTTPException(401, "PIN salah")

class LoginInput(BaseModel): username: str; password: str
class PinInput(BaseModel): pin: str
class ProductInput(BaseModel): name: str; price: float
class ProductUpdate(BaseModel): name: str; price: float
class OrderItem(BaseModel): product_id: str; name: str; price: float; qty: int = Field(gt=0)
class OrderInput(BaseModel):
    customer_name: str = "Walk-in"
    order_type: str
    payment_method: str
    paid_amount: float
    cash_amount: Optional[float] = 0
    qris_amount: Optional[float] = 0
    items: List[OrderItem]
class DeleteOrdersInput(BaseModel):
    pin: str
    ids: Optional[List[str]] = None

@api_router.post("/auth/login")
async def login(body: LoginInput, response: Response):
    key = body.username.lower()
    attempts = [stamp for stamp in failed_logins.get(key, []) if time.time() - stamp < 900]
    if len(attempts) >= 5: raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi dalam 15 menit")
    valid = body.username == os.environ["ADMIN_USERNAME"] and bcrypt.checkpw(body.password.encode("utf-8"), ADMIN_PASSWORD_HASH)
    if not valid:
        failed_logins[key] = attempts + [time.time()]
        raise HTTPException(401, "Username atau password salah")
    failed_logins.pop(key, None)
    token = token_for(body.username)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=43200)
    return {"username": body.username, "role": "admin", "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(admin=Depends(current_admin)): return {"username": admin["sub"], "role": "admin"}

@api_router.post("/auth/verify-pin")
async def verify_pin_route(body: PinInput, admin=Depends(current_admin)):
    verify_pin(body.pin)
    return {"ok": True}

@api_router.get("/products")
async def products(admin=Depends(current_admin)):
    return await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(1000)

@api_router.post("/products")
async def create_product(body: ProductInput, admin=Depends(current_admin)):
    product = {"id": str(uuid.uuid4()), "name": body.name.strip(), "price": body.price, "created_at": now_iso()}
    if not product["name"] or product["price"] < 0: raise HTTPException(400, "Nama dan harga produk wajib diisi")
    await db.products.insert_one(product.copy())
    return product

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, admin=Depends(current_admin)):
    name = body.name.strip()
    if not name or body.price < 0: raise HTTPException(400, "Nama dan harga produk wajib diisi")
    result = await db.products.update_one({"id": product_id}, {"$set": {"name": name, "price": body.price, "updated_at": now_iso()}})
    if not result.matched_count: raise HTTPException(404, "Produk tidak ditemukan")
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    return product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin=Depends(current_admin)):
    result = await db.products.delete_one({"id": product_id})
    if not result.deleted_count: raise HTTPException(404, "Produk tidak ditemukan")
    return {"id": product_id, "deleted": True}

@api_router.get("/orders")
async def orders(admin=Depends(current_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api_router.post("/orders")
async def create_order(body: OrderInput, admin=Depends(current_admin)):
    total = sum(item.price * item.qty for item in body.items)
    if not body.items: raise HTTPException(400, "Pesanan belum memiliki produk")
    cash = float(body.cash_amount or 0)
    qris = float(body.qris_amount or 0)
    is_split = body.payment_method == "split"
    if is_split:
        if cash <= 0 or qris <= 0: raise HTTPException(400, "Nominal cash dan QRIS wajib diisi")
        if cash + qris < total: raise HTTPException(400, "Total split belum mencukupi")
        paid = cash + qris
    else:
        paid = float(body.paid_amount)
        if paid < total: raise HTTPException(400, "Nominal pembayaran belum mencukupi")
    counter = await db.counters.find_one_and_update({"_id": "orders"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    order = {
        "id": f"{counter['seq']:04d}",
        "customer_name": body.customer_name or "Walk-in",
        "order_type": body.order_type,
        "payment_method": body.payment_method,
        "paid_amount": paid,
        "cash_amount": cash if is_split else 0,
        "qris_amount": qris if is_split else 0,
        "total": total,
        "items": [item.model_dump() for item in body.items],
        "status": "new",
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())
    return order

@api_router.patch("/orders/{order_id}/done")
async def complete_order(order_id: str, admin=Depends(current_admin)):
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": "done", "completed_at": now_iso()}})
    if not result.matched_count: raise HTTPException(404, "Pesanan tidak ditemukan")
    return {"id": order_id, "status": "done"}

@api_router.post("/orders/delete")
async def delete_orders(body: DeleteOrdersInput, admin=Depends(current_admin)):
    verify_pin(body.pin)
    if body.ids is None:
        result = await db.orders.delete_many({"status": "done"})
    else:
        if not body.ids: raise HTTPException(400, "Pilih minimal satu transaksi")
        result = await db.orders.delete_many({"id": {"$in": body.ids}, "status": "done"})
    return {"deleted": result.deleted_count}

@api_router.get("/orders.csv")
async def orders_csv(admin=Depends(current_admin)):
    rows = await db.orders.find({"status": "done"}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    output = io.StringIO(); writer = csv.writer(output)
    writer.writerow(["Nomor", "ID Order", "Tipe Pembayaran", "Produk & Qty", "Total"])
    for index, order in enumerate(rows, 1):
        products = "; ".join(f"{item['name']} x{item['qty']}" for item in order["items"])
        pm = order["payment_method"]
        if pm == "split":
            pm = f"split (cash {int(order.get('cash_amount', 0))} + qris {int(order.get('qris_amount', 0))})"
        writer.writerow([index, order["id"], pm, products, order["total"]])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=housebakery-transactions.csv"})

@api_router.get("/reports")
async def report(date: Optional[str] = None, admin=Depends(current_admin)):
    target = date or datetime.now(timezone.utc).date().isoformat()
    rows = await db.orders.find({"status": "done", "created_at": {"$regex": f"^{target}"}}, {"_id": 0}).to_list(5000)
    summary = {}
    for order in rows:
        for item in order["items"]: summary[item["name"]] = summary.get(item["name"], 0) + item["qty"]
    return {"date": target, "orders": len(rows), "total": sum(o["total"] for o in rows), "products": [{"name": name, "qty": qty} for name, qty in summary.items()]}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=[os.environ["FRONTEND_URL"]], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    existing = await db.orders.find({}, {"_id": 0, "id": 1}).to_list(5000)
    highest = max([int(row["id"]) for row in existing if str(row.get("id", "")).isdigit()] or [-1])
    await db.counters.update_one({"_id": "orders"}, {"$max": {"seq": highest}}, upsert=True)

@app.on_event("shutdown")
async def shutdown_db_client(): client.close()
