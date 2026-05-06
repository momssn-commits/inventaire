#!/usr/bin/env python3
"""Test exhaustif de l'API REST v1."""
from __future__ import annotations
import json
import sys
import urllib.request
import urllib.error
from typing import Any, Optional, List

BASE = "http://localhost:4040/api/v1"
PASS = FAIL = 0
FAILED: List[str] = []


def req(method, path, body=None, token=None, timeout=10):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "null")
        except Exception:
            return e.code, None


def t(name: str, expected, actual):
    global PASS, FAIL
    if expected == actual:
        PASS += 1
        print(f"  ✅ {name:<60s} {actual}")
    else:
        FAIL += 1
        FAILED.append(f"{name} (attendu={expected!r}, reçu={actual!r})")
        print(f"  ❌ {name:<60s} expected={expected!r} actual={actual!r}")


def ts(name: str, ok: bool, info: str = ""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  ✅ {name:<60s} {info}")
    else:
        FAIL += 1
        FAILED.append(name)
        print(f"  ❌ {name:<60s} (faux)")


# 1. PUBLIC
print("=== 1. ENDPOINTS PUBLICS ===")
t("GET /health", 200, req("GET", "/health")[0])
t("GET /openapi.json", 200, req("GET", "/openapi.json")[0])
status, body = req("GET", "/openapi.json")
ts("OpenAPI version 1.0.0", body and body.get("info", {}).get("version") == "1.0.0")

# 2. AUTH
print("\n=== 2. AUTHENTIFICATION ===")
t("POST /auth/login (no body)", 400, req("POST", "/auth/login")[0])
t("POST /auth/login (mauvais mdp)", 401, req("POST", "/auth/login", {"email": "admin@inventaire.fr", "password": "wrong"})[0])
t("POST /auth/login (email inconnu)", 401, req("POST", "/auth/login", {"email": "x@y.fr", "password": "x"})[0])
t("POST /auth/login (manquant)", 422, req("POST", "/auth/login", {})[0])
status, body = req("POST", "/auth/login", {"email": "admin@inventaire.fr", "password": "admin123"})
t("POST /auth/login (succès)", 200, status)
TOKEN = body["data"]["token"]
ts("Login → token JWT", isinstance(TOKEN, str) and len(TOKEN) > 50)
ts("Login → user inclus", body["data"]["user"]["email"] == "admin@inventaire.fr")

t("GET /auth/me sans token", 401, req("GET", "/auth/me")[0])
t("GET /auth/me Bearer invalide", 401, req("GET", "/auth/me", token="xxx")[0])
status, me = req("GET", "/auth/me", token=TOKEN)
t("GET /auth/me", 200, status)
ts("me.role=admin", me["data"]["role"] == "admin")
ts("me.company.code=DEMO", me["data"]["company"]["code"] == "DEMO")

# 3. STATS
print("\n=== 3. STATS ===")
status, stats = req("GET", "/stats", token=TOKEN)
t("GET /stats", 200, status)
ts("stats.products>0", stats["data"]["counters"]["products"] > 0, str(stats["data"]["counters"]["products"]))
ts("stats.lots>=3446", stats["data"]["counters"]["lots"] >= 3446, str(stats["data"]["counters"]["lots"]))
ts("stats.warehouses=4", stats["data"]["counters"]["warehouses"] == 4, str(stats["data"]["counters"]["warehouses"]))

# 4. PRODUITS — pagination, filtres, tri
print("\n=== 4. PRODUITS — pagination, filtres, tri ===")
status, p = req("GET", "/products?per_page=3", token=TOKEN)
t("GET /products", 200, status)
ts("perPage respecté", p["meta"]["perPage"] == 3 and len(p["data"]) <= 3)
ts("pageCount calculé", p["meta"]["pageCount"] >= 1)

status, p = req("GET", "/products?type=storable", token=TOKEN)
ts("Filtre type=storable", all(x["type"] == "storable" for x in p["data"]))

status, p = req("GET", "/products?tracking=serial&per_page=5", token=TOKEN)
ts("Filtre tracking=serial", all(x["tracking"] == "serial" for x in p["data"]))

status, p = req("GET", "/products?q=CHAISE", token=TOKEN)
ts("Recherche q=CHAISE", p["meta"]["total"] > 0, f"{p['meta']['total']} résultats")

status, p = req("GET", "/products?sort=-name&per_page=2", token=TOKEN)
names = [x["name"] for x in p["data"]]
ts("Tri sort=-name", len(names) >= 2 and names[0] >= names[1], f"{names[0]!r}>{names[1]!r}")

status, p = req("GET", "/products?sort=name&per_page=2", token=TOKEN)
names = [x["name"] for x in p["data"]]
ts("Tri sort=name", len(names) >= 2 and names[0] <= names[1], f"{names[0]!r}<{names[1]!r}")

# 5. PRODUITS — CRUD (SKU dynamique pour idempotence)
print("\n=== 5. PRODUITS — CRUD ===")
import time
SKU = f"TEST-AUDIT-{int(time.time() * 1000)}"
status, body = req("POST", "/products", {"sku": SKU, "name": "Produit test audit", "cost": 100}, token=TOKEN)
t("POST /products", 201, status)
PROD_ID = body["data"]["id"]
ts("POST → id retourné", PROD_ID and len(PROD_ID) > 10)

t("POST /products doublon SKU", 409, req("POST", "/products", {"sku": SKU, "name": "Doublon"}, token=TOKEN)[0])
t("POST /products validation", 422, req("POST", "/products", {}, token=TOKEN)[0])

t("GET /products/[id]", 200, req("GET", f"/products/{PROD_ID}", token=TOKEN)[0])
t("GET /products/inexistant", 404, req("GET", "/products/non-existing-uuid", token=TOKEN)[0])

t("PATCH /products/[id]", 200, req("PATCH", f"/products/{PROD_ID}", {"cost": 250}, token=TOKEN)[0])
status, body = req("GET", f"/products/{PROD_ID}", token=TOKEN)
ts("PATCH appliqué", body["data"]["cost"] == 250, f"cost={body['data']['cost']}")

t("DELETE /products/[id]", 200, req("DELETE", f"/products/{PROD_ID}", token=TOKEN)[0])
t("GET après delete (soft)", 404, req("GET", f"/products/{PROD_ID}", token=TOKEN)[0])

# 6. ENTREPÔTS / EMPLACEMENTS
print("\n=== 6. ENTREPÔTS / EMPLACEMENTS ===")
t("GET /warehouses", 200, req("GET", "/warehouses", token=TOKEN)[0])
status, w = req("GET", "/warehouses", token=TOKEN)
ts("4 entrepôts", w["meta"]["total"] == 4, str(w["meta"]["total"]))
WH_ID = w["data"][0]["id"]
status, w = req("GET", f"/warehouses/{WH_ID}", token=TOKEN)
ts("warehouse + locations", len(w["data"]["locations"]) > 0, f"{len(w['data']['locations'])} locations")

t("GET /locations?warehouse_id", 200, req("GET", f"/locations?warehouse_id={WH_ID}", token=TOKEN)[0])

# 7. LOTS / TRAÇABILITÉ
print("\n=== 7. LOTS / TRAÇABILITÉ ===")
status, l = req("GET", "/lots", token=TOKEN)
t("GET /lots", 200, status)
ts("lots > 3000", l["meta"]["total"] > 3000, str(l["meta"]["total"]))

status, body = req("GET", "/lots/5000437", token=TOKEN)
t("GET /lots/5000437", 200, status)
ts("lot.product.name", body["data"]["lot"]["product"]["name"] == "CANAPE METALLIQUE 1 PLACE", body["data"]["lot"]["product"]["name"])
ts("lot has currentStock", len(body["data"]["currentStock"]) > 0)
ts("lot has location", body["data"]["currentStock"][0]["location"]["fullPath"].startswith("SIEGE"), body["data"]["currentStock"][0]["location"]["fullPath"])

t("GET /lots/inexistant", 404, req("GET", "/lots/lot-inexistant-xyz", token=TOKEN)[0])

# 8. STOCK & SCAN
print("\n=== 8. STOCK & SCAN ===")
t("GET /stock", 200, req("GET", "/stock", token=TOKEN)[0])
status, s = req("GET", f"/stock?warehouse_id={WH_ID}&only_internal=true&per_page=5", token=TOKEN)
ts("stock filtré", s["meta"]["total"] > 0, str(s["meta"]["total"]))

status, body = req("POST", "/scan", {"code": "5000437"}, token=TOKEN)
t("POST /scan", 200, status)
ts("scan → matchCount>=1", body["data"]["matchCount"] >= 1)

status, body = req("POST", "/scan", {"code": "(01)03012345678901(10)L-2026-A(17)271231"}, token=TOKEN)
ts("scan GS1 → gtin", body["data"]["decoded"].get("gtin") == "03012345678901")
ts("scan GS1 → lot", body["data"]["decoded"].get("lot") == "L-2026-A")
ts("scan GS1 → expDate", body["data"]["decoded"].get("expirationDate") == "2027-12-31")

t("POST /scan (invalide)", 422, req("POST", "/scan", {}, token=TOKEN)[0])

# 9. PARTENAIRES
print("\n=== 9. PARTENAIRES ===")
status, body = req("POST", "/partners", {"name": "Audit Test Supplier", "type": "supplier", "email": "test@audit.fr"}, token=TOKEN)
t("POST /partners", 201, status)

status, body = req("GET", "/partners?q=Audit", token=TOKEN)
ts("partner créé visible", body["meta"]["total"] >= 1, str(body["meta"]["total"]))

# 10. MOUVEMENTS
print("\n=== 10. MOUVEMENTS ===")
t("GET /pickings", 200, req("GET", "/pickings", token=TOKEN)[0])

# 11. MODULE STOCK
print("\n=== 11. MODULE STOCK ===")
status, body = req("GET", "/stock/alerts", token=TOKEN)
t("GET /stock/alerts", 200, status)
ts("alerts.summary présent", "summary" in body["data"])

status, body = req("GET", "/stock/abc", token=TOKEN)
t("GET /stock/abc", 200, status)
ts("abc.summary.totalProducts", body["data"]["summary"]["totalProducts"] >= 0)
ts("abc.items[].abc dans A/B/C", all(x["abc"] in ("A", "B", "C") for x in body["data"]["items"]))

t("POST /stock/transfer (validation)", 422, req("POST", "/stock/transfer", {}, token=TOKEN)[0])
t("POST /stock/transfer (qty=0)", 422, req("POST", "/stock/transfer", {"productId": "x", "fromLocationId": "y", "toLocationId": "z", "qty": 0}, token=TOKEN)[0])
t("POST /stock/transfer (produit inconnu)", 404, req("POST", "/stock/transfer", {"productId": "uuid-inexistant", "fromLocationId": "x", "toLocationId": "y", "qty": 1}, token=TOKEN)[0])

# 12. ISOLATION MULTI-TENANT
print("\n=== 12. ISOLATION MULTI-TENANT ===")
status, p = req("GET", "/products?per_page=1", token=TOKEN)
ts("companyId attendu", p["data"][0]["companyId"] == "00000000-0000-0000-0000-00000000c0de", p["data"][0]["companyId"])

# 12. PAGINATION EDGE CASES
print("\n=== 12. PAGINATION CAS LIMITES ===")
status, body = req("GET", "/products?per_page=999", token=TOKEN)
ts("per_page max=100", body["meta"]["perPage"] == 100, str(body["meta"]["perPage"]))
status, body = req("GET", "/products?per_page=0", token=TOKEN)
ts("per_page min=1", body["meta"]["perPage"] >= 1, str(body["meta"]["perPage"]))
status, body = req("GET", "/products?page=999", token=TOKEN)
ts("page hors limite → vide", len(body["data"]) == 0)

# 13. RBAC : vérifier qu'un user normal ne peut pas faire d'opérations admin (à implémenter ?)

print("\n" + "=" * 50)
print(f"RÉSULTAT : {PASS} PASS / {FAIL} FAIL")
print("=" * 50)
if FAIL > 0:
    print("\nTests échoués :")
    for x in FAILED:
        print(f"  - {x}")
    sys.exit(1)
sys.exit(0)
