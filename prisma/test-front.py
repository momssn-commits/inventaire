#!/usr/bin/env python3
"""Test des pages front avec auth cookie."""
from __future__ import annotations
import urllib.request
import urllib.error
import json
import sys
import re
from http.cookiejar import CookieJar

BASE = "http://localhost:4040"
PASS = FAIL = 0
FAILED = []

# Login pour obtenir le token, puis poser le cookie inv_session manuellement
import urllib.parse
login_data = json.dumps({"email": "admin@inventaire.fr", "password": "admin123"}).encode()
r = urllib.request.Request(f"{BASE}/api/v1/auth/login", data=login_data, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(r) as resp:
    body = json.loads(resp.read())
TOKEN = body["data"]["token"]


def fetch(path, expect_status=200, expect_contains=None, expect_not_contains=None, follow=False):
    global PASS, FAIL
    url = BASE + path
    req = urllib.request.Request(url)
    req.add_header("Cookie", f"inv_session={TOKEN}")
    try:
        opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler() if follow else type("NoR", (urllib.request.HTTPRedirectHandler,), {"http_error_302": lambda *a, **k: None})())
        with opener.open(req, timeout=15) as resp:
            status = resp.status
            content = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status = e.code
        content = e.read().decode("utf-8", errors="replace") if e.fp else ""

    ok = status == expect_status
    if expect_contains and ok:
        ok = all(c in content for c in (expect_contains if isinstance(expect_contains, list) else [expect_contains]))
    if expect_not_contains and ok:
        ok = all(c not in content for c in (expect_not_contains if isinstance(expect_not_contains, list) else [expect_not_contains]))

    name = f"GET {path}"
    extras = f"({status})"
    if ok:
        PASS += 1
        print(f"  ✅ {name:<55s} {extras}")
    else:
        FAIL += 1
        FAILED.append(f"{name} status={status}")
        print(f"  ❌ {name:<55s} expected={expect_status}, got={status}, len={len(content)}")
        if not ok and expect_contains:
            for c in (expect_contains if isinstance(expect_contains, list) else [expect_contains]):
                if c not in content:
                    print(f"       ↳ manque : {c!r}")
        if expect_not_contains and ok:
            for c in (expect_not_contains if isinstance(expect_not_contains, list) else [expect_not_contains]):
                if c in content:
                    print(f"       ↳ contient (interdit) : {c!r}")


print("=== Pages publiques ===")
fetch("/login", 200, expect_contains=["Inventaire", "admin@inventaire.fr"])
fetch("/api/docs", 200, expect_contains=["swagger-ui"])

print("\n=== Pages authentifiées ===")
pages = [
    ("/dashboard", ["Bonjour", "Tableau de bord", "Connexion front"]),
    ("/produits", ["Produits", "M1"]),
    ("/produits/nouveau", ["Nouveau produit", "SKU"]),
    ("/entrepots", ["Entrepôts", "M2"]),
    ("/emplacements", ["Emplacements"]),
    ("/operations", ["Mouvements", "M3"]),
    ("/operations/nouveau", ["Nouveau mouvement", "réception"]),
    ("/inventaire", ["Comptages"]),
    ("/reassort", ["Réassort", "M4"]),
    ("/codes-barres", ["Mode entrepôt", "M5"]),
    ("/qualite", ["Contrôle qualité", "M6"]),
    ("/achats", ["Achats", "M7"]),
    ("/achats/nouveau", ["bon de commande"]),
    ("/fabrication", ["Fabrication", "M8"]),
    ("/maintenance", ["Maintenance", "M9"]),
    ("/reparations", ["Réparations", "M11"]),
    ("/rapports", ["Rapports"]),
    ("/tracabilite", ["Traçabilité"]),
    ("/partenaires", ["Partenaires"]),
    ("/parametres", ["Paramètres", "API REST v1"]),
    # Module Stock
    ("/stock", ["Gestion de stock", "Valeur totale"]),
    ("/stock/alertes", ["Alertes stock", "Ruptures"]),
    ("/stock/transfert", ["Transfert rapide", "Nouveau transfert"]),
    ("/stock/abc", ["Analyse ABC"]),
]
for path, expected in pages:
    fetch(path, 200, expect_contains=expected)

print("\n=== Pages avec dynamique ===")
# Première fiche produit
status, body = 200, None
import urllib.request
req = urllib.request.Request(f"{BASE}/api/v1/products?per_page=1")
req.add_header("Authorization", f"Bearer {TOKEN}")
with urllib.request.urlopen(req) as resp:
    body = json.loads(resp.read())
prod_id = body["data"][0]["id"]
fetch(f"/produits/{prod_id}", 200, expect_contains=["Caractéristiques", "Stock par emplacement"])

# Recherche traçabilité
fetch("/tracabilite?q=5000437", 200, expect_contains=["CANAPE METALLIQUE", "Position actuelle"])

# Page introuvable
fetch("/produits/uuid-inconnu-xxx", 404)

# Sans auth → redirection vers login
print("\n=== Sans authentification ===")
req = urllib.request.Request(f"{BASE}/dashboard")
class NoFollow(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoFollow())
try:
    with opener.open(req, timeout=10) as resp:
        status = resp.status
except urllib.error.HTTPError as e:
    status = e.code

if status in (302, 307):
    PASS += 1
    print(f"  ✅ {'GET /dashboard sans cookie':<55s} (redirect {status})")
else:
    FAIL += 1
    FAILED.append(f"redirect manquant pour /dashboard")
    print(f"  ❌ {'GET /dashboard sans cookie':<55s} status={status}")

print("\n" + "=" * 50)
print(f"RÉSULTAT : {PASS} PASS / {FAIL} FAIL")
print("=" * 50)
if FAIL:
    print("\nÉchecs :")
    for x in FAILED: print(f"  - {x}")
    sys.exit(1)
sys.exit(0)
