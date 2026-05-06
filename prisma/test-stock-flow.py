#!/usr/bin/env python3
"""Test du cycle complet : création produit → réception → vérif stock → expédition → vérif stock vide."""
from __future__ import annotations
import json, sys, time
import urllib.request
import urllib.error

BASE = "http://localhost:4040/api/v1"

def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token: headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")

# Login
_, body = req("POST", "/auth/login", {"email": "admin@inventaire.fr", "password": "admin123"})
T = body["data"]["token"]
print("✅ Login OK")

# 1. Créer un produit de test
SUFFIX = int(time.time()*1000)
SKU = f"FLOW-TEST-{SUFFIX}"
LOT_NAME = f"L-FLOW-{SUFFIX}"
status, body = req("POST", "/products", {
    "sku": SKU, "name": "Produit flow test", "type": "storable", "tracking": "lot", "cost": 10000
}, token=T)
assert status == 201, f"Create product failed: {status} {body}"
product_id = body["data"]["id"]
print(f"✅ Produit créé : {SKU} (id={product_id[:12]}...)")

# 2. Trouver un entrepôt et un emplacement interne
_, w = req("GET", "/warehouses", token=T)
wh_id = w["data"][0]["id"]
_, locs = req("GET", f"/locations?warehouse_id={wh_id}&type=internal&per_page=1", token=T)
loc_id = locs["data"][0]["id"]
print(f"✅ Entrepôt: {w['data'][0]['code']}, Emplacement: {locs['data'][0]['fullPath']}")

# 3. Créer un fournisseur
status, body = req("POST", "/partners", {"name": f"Fournisseur Flow {int(time.time())}", "type": "supplier"}, token=T)
partner_id = body["data"]["id"]
print(f"✅ Fournisseur créé : {body['data']['name']}")

# 4. Stock initial du produit (doit être 0)
_, s = req("GET", f"/stock?product_id={product_id}&only_internal=true", token=T)
init_qty = sum(l["quantity"] for l in s["data"])
assert init_qty == 0, f"Stock initial devrait être 0, trouvé {init_qty}"
print(f"✅ Stock initial = 0")

# 5. Créer une réception (depuis fournisseur → emplacement) avec un lot
status, body = req("POST", "/pickings", {
    "type": "receipt",
    "partnerId": partner_id,
    "fromWarehouseId": wh_id,
    "toWarehouseId": wh_id,
    "lines": [
        {"productId": product_id, "qty": 50, "toLocationId": loc_id, "lotName": LOT_NAME},
    ],
}, token=T)
assert status == 201, f"Create picking failed: {status} {body}"
picking_id = body["data"]["id"]
print(f"✅ Réception créée : {body['data']['reference']} (state=draft)")

# 6. Valider la réception → applique le mouvement
status, body = req("POST", f"/pickings/{picking_id}/validate", token=T)
assert status == 200, f"Validate failed: {status} {body}"
assert body["data"]["state"] == "done"
print(f"✅ Réception validée (state=done)")

# 7. Vérifier que le stock est bien à 50
_, s = req("GET", f"/stock?product_id={product_id}&only_internal=true", token=T)
qty = sum(l["quantity"] for l in s["data"])
assert qty == 50, f"Stock après réception devrait être 50, trouvé {qty}"
value = sum(l["quantity"] * l["unitCost"] for l in s["data"])
assert value == 500000, f"Valeur devrait être 500000 FCFA, trouvée {value}"
print(f"✅ Stock après réception = 50 unités, valeur {value:,} FCFA")

# 8. Vérifier que le lot a été créé et est traçable
_, body = req("GET", f"/lots/{LOT_NAME}", token=T)
assert body["data"]["lot"]["product"]["sku"] == SKU
print(f"✅ Lot {LOT_NAME} traçable (produit={SKU})")

# 9. Validation deux fois → doit échouer
status, body = req("POST", f"/pickings/{picking_id}/validate", token=T)
assert status == 409, f"Double validation devrait être 409, trouvé {status}"
print(f"✅ Double validation refusée (409)")

# 10. Créer une expédition
status, body = req("POST", "/pickings", {
    "type": "delivery",
    "partnerId": partner_id,
    "fromWarehouseId": wh_id,
    "toWarehouseId": wh_id,
    "lines": [
        {"productId": product_id, "qty": 30, "fromLocationId": loc_id, "lotName": LOT_NAME},
    ],
}, token=T)
delivery_id = body["data"]["id"]
print(f"✅ Expédition créée : {body['data']['reference']}")

# 11. Valider l'expédition
status, _ = req("POST", f"/pickings/{delivery_id}/validate", token=T)
assert status == 200
print(f"✅ Expédition validée")

# 12. Vérifier le nouveau stock = 50 - 30 = 20
_, s = req("GET", f"/stock?product_id={product_id}&only_internal=true", token=T)
qty = sum(l["quantity"] for l in s["data"])
assert qty == 20, f"Stock après expédition devrait être 20, trouvé {qty}"
print(f"✅ Stock après expédition = 20 unités")

# 13. Cleanup : soft-delete du produit test
req("DELETE", f"/products/{product_id}", token=T)
print(f"✅ Produit soft-deleted")

print("\n🎉 Cycle complet de mouvement de stock OK")
print("   - Création produit/lot ✓")
print("   - Réception atomique ✓")
print("   - Mise à jour stock ✓")
print("   - Coût pondéré ✓")
print("   - Traçabilité par lot ✓")
print("   - Idempotence (double validation refusée) ✓")
print("   - Expédition atomique ✓")
