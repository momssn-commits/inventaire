import { NextResponse } from 'next/server';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Inventaire — API REST v1',
    version: '1.0.0',
    description:
      "API REST de la solution Inventaire. Conforme au cahier des charges CDC-INVENTAIRE-V1.0. " +
      "Authentification : Bearer JWT (POST /v1/auth/login) ou cookie de session (web).",
    contact: { name: 'Inventaire' },
  },
  servers: [{ url: '/api/v1', description: 'Serveur courant' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      CookieAuth: { type: 'apiKey', in: 'cookie', name: 'inv_session' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          perPage: { type: 'integer' },
          pageCount: { type: 'integer' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sku: { type: 'string' },
          name: { type: 'string' },
          barcode: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['storable', 'consumable', 'service'] },
          tracking: { type: 'string', enum: ['none', 'lot', 'serial'] },
          salePrice: { type: 'number' },
          cost: { type: 'number' },
          minQty: { type: 'number' },
          maxQty: { type: 'number' },
          companyId: { type: 'string' },
        },
      },
      Warehouse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          city: { type: 'string', nullable: true },
          receptionSteps: { type: 'integer' },
          deliverySteps: { type: 'integer' },
        },
      },
      Location: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          fullPath: { type: 'string' },
          type: { type: 'string' },
          warehouseId: { type: 'string', nullable: true },
          parentId: { type: 'string', nullable: true },
          barcode: { type: 'string', nullable: true },
        },
      },
      Lot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', description: 'N° de lot ou de série' },
          productId: { type: 'string' },
          isSerial: { type: 'boolean' },
          condition: { type: 'string', nullable: true },
          brand: { type: 'string', nullable: true },
          specifications: { type: 'string', nullable: true },
          serviceName: { type: 'string', nullable: true },
        },
      },
      Picking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reference: { type: 'string' },
          type: { type: 'string', enum: ['receipt', 'delivery', 'internal', 'manufacturing', 'return'] },
          state: { type: 'string', enum: ['draft', 'confirmed', 'assigned', 'done', 'cancelled'] },
          partnerId: { type: 'string', nullable: true },
          fromWarehouseId: { type: 'string', nullable: true },
          toWarehouseId: { type: 'string', nullable: true },
          scheduledAt: { type: 'string', format: 'date-time', nullable: true },
          doneAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Système'], summary: 'Vérification de santé', security: [],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentification'], summary: 'Connexion', security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'JWT retourné dans la réponse + cookie posé',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        tokenType: { type: 'string', example: 'Bearer' },
                        expiresIn: { type: 'integer' },
                        user: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Identifiants invalides', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/me': {
      get: { tags: ['Authentification'], summary: 'Session courante', responses: { '200': { description: 'OK' }, '401': { description: 'Non authentifié' } } },
    },
    '/auth/logout': {
      post: { tags: ['Authentification'], summary: 'Déconnexion', responses: { '200': { description: 'OK' } } },
    },
    '/stats': {
      get: { tags: ['Tableau de bord'], summary: 'Statistiques globales', responses: { '200': { description: 'OK' } } },
    },
    '/products': {
      get: {
        tags: ['Produits'], summary: 'Liste paginée des produits',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['storable', 'consumable', 'service'] } },
          { name: 'tracking', in: 'query', schema: { type: 'string', enum: ['none', 'lot', 'serial'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'per_page', in: 'query', schema: { type: 'integer', default: 25, maximum: 100 } },
          { name: 'sort', in: 'query', schema: { type: 'string', example: 'name,-createdAt' } },
        ],
        responses: { '200': { description: 'Liste de produits' } },
      },
      post: {
        tags: ['Produits'], summary: 'Créer un produit',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sku', 'name'],
                properties: {
                  sku: { type: 'string' }, name: { type: 'string' },
                  type: { type: 'string', default: 'storable' },
                  tracking: { type: 'string', default: 'none' },
                  barcode: { type: 'string' },
                  salePrice: { type: 'number' },
                  cost: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Produit créé' }, '422': { description: 'Validation' }, '409': { description: 'Conflit SKU' } },
      },
    },
    '/products/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Produits'], summary: 'Détail d\'un produit', responses: { '200': { description: 'OK' }, '404': { description: 'Inconnu' } } },
      patch: { tags: ['Produits'], summary: 'Mettre à jour' },
      delete: { tags: ['Produits'], summary: 'Soft-delete' },
    },
    '/warehouses': {
      get: { tags: ['Entrepôts'], summary: 'Liste des entrepôts' },
      post: {
        tags: ['Entrepôts'], summary: 'Créer un entrepôt',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['code', 'name'], properties: { code: { type: 'string' }, name: { type: 'string' } } },
            },
          },
        },
      },
    },
    '/warehouses/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Entrepôts'], summary: 'Détail entrepôt + emplacements' },
    },
    '/locations': {
      get: { tags: ['Emplacements'], summary: 'Liste des emplacements' },
      post: { tags: ['Emplacements'], summary: 'Créer un emplacement' },
    },
    '/lots': {
      get: { tags: ['Lots / N° série'], summary: 'Recherche de lots' },
    },
    '/lots/{name}': {
      parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Lots / N° série'], summary: 'Détail + traçabilité ascendante & descendante' },
    },
    '/partners': {
      get: { tags: ['Partenaires'], summary: 'Liste fournisseurs/clients' },
      post: { tags: ['Partenaires'], summary: 'Créer un partenaire' },
    },
    '/stock': {
      get: {
        tags: ['Stock'], summary: 'Lignes de stock par produit/emplacement/lot',
        parameters: [
          { name: 'product_id', in: 'query', schema: { type: 'string' } },
          { name: 'location_id', in: 'query', schema: { type: 'string' } },
          { name: 'warehouse_id', in: 'query', schema: { type: 'string' } },
          { name: 'only_internal', in: 'query', schema: { type: 'boolean' } },
          { name: 'only_positive', in: 'query', schema: { type: 'boolean' } },
        ],
      },
    },
    '/stock/transfer': {
      post: {
        tags: ['Stock'],
        summary: 'Transfert atomique entre deux emplacements',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'fromLocationId', 'toLocationId', 'qty'],
                properties: {
                  productId: { type: 'string' },
                  fromLocationId: { type: 'string' },
                  toLocationId: { type: 'string' },
                  qty: { type: 'number', minimum: 0.01 },
                  lotId: { type: 'string', nullable: true },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Transfert effectué (Picking interne créé)' },
          '404': { description: 'Produit introuvable' },
          '422': { description: 'Stock insuffisant ou validation' },
        },
      },
    },
    '/stock/alerts': {
      get: {
        tags: ['Stock'],
        summary: 'Alertes stock (rupture, sous-seuil, sur-stock, vieillissement)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/stock/abc': {
      get: {
        tags: ['Stock'],
        summary: 'Classification ABC (Pareto) par valeur cumulée',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/scan': {
      post: {
        tags: ['Codes-barres'], summary: 'Scan d\'un code-barres (GS1, EAN, QR…)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', example: '(01)03012345678901(10)L-2026-A(17)271231' } } },
            },
          },
        },
        responses: { '200': { description: 'Décodage GS1 + correspondances trouvées en base' } },
      },
    },
    '/pickings': {
      get: { tags: ['Mouvements'], summary: 'Liste des mouvements (réceptions, expéditions, transferts)' },
      post: { tags: ['Mouvements'], summary: 'Créer un mouvement' },
    },
    '/pickings/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Mouvements'], summary: 'Détail d\'un mouvement' },
    },
    '/pickings/{id}/validate': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: { tags: ['Mouvements'], summary: 'Valider et appliquer le mouvement (atomique)' },
    },
    '/purchase-orders': {
      get: { tags: ['Achats'], summary: 'Liste des bons de commande' },
      post: { tags: ['Achats'], summary: 'Créer un bon de commande' },
    },
    '/purchase-orders/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Achats'], summary: 'Détail d\'un bon de commande' },
    },
    '/quality/alerts': {
      get: { tags: ['Qualité'], summary: 'Liste des alertes qualité' },
      post: { tags: ['Qualité'], summary: 'Créer une alerte qualité' },
    },
  },
  tags: [
    { name: 'Système' },
    { name: 'Authentification' },
    { name: 'Tableau de bord' },
    { name: 'Produits' },
    { name: 'Entrepôts' },
    { name: 'Emplacements' },
    { name: 'Lots / N° série' },
    { name: 'Partenaires' },
    { name: 'Stock' },
    { name: 'Codes-barres' },
    { name: 'Mouvements' },
    { name: 'Achats' },
    { name: 'Qualité' },
  ],
};

export function GET() {
  return NextResponse.json(spec);
}
